import { effectScope } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useLatestRequest } from "../src/composables/useLatestRequest.js";
import type {
  RequestCommitPolicy,
  RequestToken,
} from "../src/composables/latest-request-policy.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useLatestRequest", () => {
  it("只允许最后发起的请求提交页面状态", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest);
    expect(controller).toBeDefined();
    const first = deferred<string>();
    const second = deferred<string>();
    const commits: string[] = [];
    const onError = vi.fn();

    const firstRun = controller!.run(() => first.promise, {
      onSuccess: (value) => {
        commits.push(value);
      },
      onError,
    });
    const secondRun = controller!.run(() => second.promise, {
      onSuccess: (value) => {
        commits.push(value);
      },
      onError,
    });

    first.resolve("旧响应");
    expect(await firstRun).toBe(false);
    expect(controller!.loading.value).toBe(true);

    second.resolve("新响应");
    expect(await secondRun).toBe(true);
    expect(commits).toEqual(["新响应"]);
    expect(onError).not.toHaveBeenCalled();
    expect(controller!.loading.value).toBe(false);
    scope.stop();
  });

  it("失效后的请求错误不会触发页面错误提示", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest);
    const request = deferred<string>();
    const onError = vi.fn();
    const running = controller!.run(() => request.promise, {
      onSuccess: vi.fn(),
      onError,
    });

    controller!.invalidate();
    request.reject(new Error("网络延迟错误"));

    expect(await running).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    expect(controller!.loading.value).toBe(false);
    scope.stop();
  });

  it("通过策略接口替换请求提交规则", async () => {
    class RecordingPolicy implements RequestCommitPolicy {
      readonly events: string[] = [];
      private activeToken = 0;

      begin(): RequestToken {
        this.activeToken += 1;
        this.events.push(`begin:${this.activeToken}`);
        return this.activeToken;
      }

      canCommit(token: RequestToken): boolean {
        this.events.push(`check:${token}`);
        return token === this.activeToken;
      }

      invalidate(): void {
        this.activeToken += 1;
        this.events.push("invalidate");
      }
    }

    const policy = new RecordingPolicy();
    const scope = effectScope();
    const controller = scope.run(() => useLatestRequest(policy));
    const onSuccess = vi.fn();

    await expect(
      controller!.run(() => Promise.resolve("完成"), { onSuccess, onError: vi.fn() }),
    ).resolves.toBe(true);
    expect(onSuccess).toHaveBeenCalledWith("完成");
    expect(policy.events).toContain("begin:1");
    scope.stop();
    expect(policy.events.at(-1)).toBe("invalidate");
  });

  it("状态提交回调异常不会被重新解释为请求失败", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest);
    const onError = vi.fn();

    await expect(
      controller!.run(() => Promise.resolve("完成"), {
        onSuccess: () => {
          throw new Error("页面状态提交失败");
        },
        onError,
      }),
    ).rejects.toThrow("页面状态提交失败");
    expect(onError).not.toHaveBeenCalled();
    expect(controller!.loading.value).toBe(false);
    scope.stop();
  });
});
