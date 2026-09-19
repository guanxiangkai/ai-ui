import { setImmediate } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createWindowSessionTransport } from "../src/index.js";

interface TestSession {
  token: string;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function serialize(session: TestSession | null): string {
  return JSON.stringify({ session });
}

async function drainPromises(): Promise<void> {
  // 等待当前微任务队列完成，不依赖具体实现中的 Promise 层数。
  await setImmediate();
}

function createTransport(envelope: {
  seal(plaintext: string): Promise<string>;
  open(ciphertext: string): Promise<string>;
}) {
  const listeners = new Set<(event: MessageEvent<unknown>) => void>();
  const postMessage = vi.fn();
  const targetWindow = { postMessage } as unknown as WindowProxy;
  vi.stubGlobal("window", {
    addEventListener: (_type: string, listener: (event: MessageEvent<unknown>) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MessageEvent<unknown>) => void) => {
      listeners.delete(listener);
    },
  });

  return {
    postMessage,
    targetWindow,
    transport: createWindowSessionTransport<TestSession>({
      targetWindow,
      targetOrigin: "https://receiver.example.test",
      codec: {
        decode(value) {
          if (
            typeof value === "object" &&
            value !== null &&
            "token" in value &&
            typeof value.token === "string"
          ) {
            return { token: value.token };
          }
          return null;
        },
      },
      security: { kind: "public-key", envelope },
    }),
    receive: (content: string) => {
      for (const listener of listeners) {
        listener({
          origin: "https://receiver.example.test",
          source: targetWindow,
          data: { type: "guanxiangkai.platform.session", content },
        } as MessageEvent<unknown>);
      }
    },
  };
}

describe("跨窗口会话传输", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("按发布调用顺序保护调用时固定的会话载荷", async () => {
    const firstSeal = deferred<string>();
    const seal = vi.fn().mockReturnValueOnce(firstSeal.promise).mockResolvedValueOnce("cleared");
    const { postMessage, transport } = createTransport({ seal, open: vi.fn() });
    const firstSession = { token: "old" };

    const firstPublish = transport.publish(firstSession);
    const secondPublish = transport.publish(null);
    firstSession.token = "changed-after-publish";
    await drainPromises();
    expect(seal).toHaveBeenCalledExactlyOnceWith(serialize({ token: "old" }));

    firstSeal.resolve("old-session");
    await firstPublish;
    await secondPublish;
    expect(seal).toHaveBeenNthCalledWith(2, serialize(null));
    expect(postMessage.mock.calls).toEqual([
      [
        { type: "guanxiangkai.platform.session", content: "old-session" },
        "https://receiver.example.test",
      ],
      [
        { type: "guanxiangkai.platform.session", content: "cleared" },
        "https://receiver.example.test",
      ],
    ]);
  });

  it("按接收顺序打开会话，避免迟到旧会话覆盖清除消息", async () => {
    const firstOpen = deferred<string>();
    const secondOpen = deferred<string>();
    const open = vi
      .fn()
      .mockReturnValueOnce(firstOpen.promise)
      .mockReturnValueOnce(secondOpen.promise);
    const { receive, transport } = createTransport({ seal: vi.fn(), open });
    const received: Array<TestSession | null> = [];
    transport.subscribe((session) => received.push(session));

    receive("old");
    receive("cleared");
    await drainPromises();
    expect(open).toHaveBeenCalledExactlyOnceWith("old");

    firstOpen.resolve(serialize({ token: "old" }));
    await drainPromises();
    expect(received).toEqual([{ token: "old" }]);
    expect(open).toHaveBeenNthCalledWith(2, "cleared");

    secondOpen.resolve(serialize(null));
    await drainPromises();
    expect(received).toEqual([{ token: "old" }, null]);
  });

  it("单条保护或解封失败不会阻塞后续消息", async () => {
    const seal = vi
      .fn()
      .mockRejectedValueOnce(new Error("seal failed"))
      .mockResolvedValueOnce("next");
    const firstOpen = deferred<string>();
    const open = vi
      .fn()
      .mockReturnValueOnce(firstOpen.promise)
      .mockResolvedValueOnce(serialize({ token: "next" }));
    const { postMessage, receive, transport } = createTransport({ seal, open });

    const failedPublish = transport.publish({ token: "failed" });
    const nextPublish = transport.publish({ token: "next" });
    await expect(failedPublish).rejects.toThrow("seal failed");
    await nextPublish;
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: "guanxiangkai.platform.session", content: "next" },
      "https://receiver.example.test",
    );

    const received: TestSession[] = [];
    transport.subscribe((session) => {
      if (session !== null) received.push(session);
    });
    receive("failed");
    receive("next");
    await drainPromises();
    firstOpen.reject(new Error("open failed"));
    await drainPromises();
    expect(open).toHaveBeenNthCalledWith(2, "next");
    expect(received).toEqual([{ token: "next" }]);
  });

  it("序列化失败会返回拒绝 Promise，且不会阻塞后续发布", async () => {
    const { postMessage, transport } = createTransport({
      seal: vi.fn().mockResolvedValue("next"),
      open: vi.fn(),
    });
    const cyclicSession: TestSession & { self?: unknown } = { token: "failed" };
    cyclicSession.self = cyclicSession;

    await expect(transport.publish(cyclicSession)).rejects.toThrow("circular");
    await transport.publish({ token: "next" });

    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: "guanxiangkai.platform.session", content: "next" },
      "https://receiver.example.test",
    );
  });

  it("退订会抑制在途和排队消息的通知", async () => {
    const firstOpen = deferred<string>();
    const open = vi
      .fn()
      .mockReturnValueOnce(firstOpen.promise)
      .mockResolvedValueOnce(serialize({ token: "next" }));
    const { receive, transport } = createTransport({ seal: vi.fn(), open });
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(listener);

    receive("in-flight");
    receive("queued");
    await drainPromises();
    unsubscribe();
    firstOpen.resolve(serialize({ token: "old" }));
    await drainPromises();

    expect(listener).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledExactlyOnceWith("in-flight");
  });
});
