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

  it("开始新请求时取消前一个请求", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest)!;
    let firstSignal!: AbortSignal;
    const first = controller.run(
      (signal) => {
        firstSignal = signal;
        return new Promise<string>((resolve) => setTimeout(() => resolve("旧结果"), 10));
      },
      { onSuccess: vi.fn(), onError: vi.fn() },
    );
    const second = controller.run(async () => "新结果", {
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(firstSignal.aborted).toBe(true);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    scope.stop();
  });

  it("取消监听器重入时不会覆盖新请求", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest)!;
    const first = deferred<string>();
    const commits: string[] = [];

    const firstRun = controller.run(
      (signal) => {
        signal.addEventListener("abort", () => {
          void controller.run(async () => "重入结果", {
            onSuccess: (value) => commits.push(value),
            onError: vi.fn(),
          });
        });
        return first.promise;
      },
      { onSuccess: (value) => commits.push(value), onError: vi.fn() },
    );

    const secondRun = controller.run(async () => "第二个结果", {
      onSuccess: (value) => commits.push(value),
      onError: vi.fn(),
    });

    first.resolve("旧结果");
    expect(await firstRun).toBe(false);
    expect(await secondRun).toBe(false);
    expect(commits).toEqual(["重入结果"]);
    expect(controller.loading.value).toBe(false);
    scope.stop();
  });

  it("失效监听器重入时保留重入请求", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest)!;
    const commits: string[] = [];
    const first = deferred<string>();
    const running = controller.run(
      (signal) => {
        signal.addEventListener("abort", () => {
          void controller.run(async () => "重入结果", {
            onSuccess: (value) => commits.push(value),
            onError: vi.fn(),
          });
          first.reject(signal.reason);
        });
        return first.promise;
      },
      { onSuccess: vi.fn(), onError: vi.fn() },
    );

    controller.invalidate();
    await expect(running).resolves.toBe(false);
    expect(commits).toEqual(["重入结果"]);
    expect(controller.loading.value).toBe(false);
    controller.invalidate();
    scope.stop();
  });

  it("不会在请求启动前询问自定义策略的提交资格", async () => {
    let requestStarted = false;
    const policy: RequestCommitPolicy = {
      begin: () => 1,
      canCommit: () => {
        expect(requestStarted).toBe(true);
        return true;
      },
      invalidate: vi.fn(),
    };
    const scope = effectScope();
    const controller = scope.run(() => useLatestRequest(policy))!;

    await expect(
      controller.run(
        async () => {
          requestStarted = true;
          return "完成";
        },
        { onSuccess: vi.fn(), onError: vi.fn() },
      ),
    ).resolves.toBe(true);
    scope.stop();
  });

  it("组件卸载期间的取消监听器不会重新启动请求", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest)!;
    const first = deferred<string>();
    let sentSignal!: AbortSignal;
    const request = vi.fn((signal: AbortSignal) => {
      sentSignal = signal;
      signal.addEventListener("abort", () => {
        void controller.run(async () => "不应启动", {
          onSuccess: vi.fn(),
          onError: vi.fn(),
        });
        first.reject(signal.reason);
      });
      return first.promise;
    });
    const running = controller.run(request, { onSuccess: vi.fn(), onError: vi.fn() });
    scope.stop();
    expect(sentSignal.aborted).toBe(true);
    await expect(running).resolves.toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("允许并发策略时旧请求完成不会清掉最新加载状态", async () => {
    let nextToken = 0;
    const policy: RequestCommitPolicy = {
      begin: () => ++nextToken,
      canCommit: () => true,
      invalidate: vi.fn(),
    };
    const scope = effectScope();
    const controller = scope.run(() => useLatestRequest(policy))!;
    const first = deferred<string>();
    const second = deferred<string>();
    const firstRun = controller.run(() => first.promise, { onSuccess: vi.fn(), onError: vi.fn() });
    const secondRun = controller.run(() => second.promise, {
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    first.resolve("先完成");
    await expect(firstRun).resolves.toBe(true);
    expect(controller.loading.value).toBe(true);
    second.resolve("后完成");
    await expect(secondRun).resolves.toBe(true);
    expect(controller.loading.value).toBe(false);
    scope.stop();
  });

  it("最新请求完成后不等待已取消且未结束的旧请求", async () => {
    const scope = effectScope();
    const controller = scope.run(useLatestRequest)!;
    const first = deferred<string>();
    const firstRun = controller.run(() => first.promise, {
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });
    const secondRun = controller.run(async () => "最新结果", {
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    await expect(secondRun).resolves.toBe(true);
    expect(controller.loading.value).toBe(false);
    first.reject(new Error("旧请求最终结束"));
    await expect(firstRun).resolves.toBe(false);
    scope.stop();
  });
});
