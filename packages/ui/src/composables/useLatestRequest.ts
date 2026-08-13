import { onScopeDispose, ref, type Ref } from "vue";

import { LatestRequestPolicy, type RequestCommitPolicy } from "./latest-request-policy.js";

/** 仅处理最新一次异步请求的回调。 */
export interface LatestRequestCallbacks<T> {
  /** 最新请求成功时同步提交页面状态。 */
  onSuccess: (value: T) => void;
  /** 最新请求失败时同步处理错误；已过期请求的错误不会打扰用户。 */
  onError: (error: unknown) => void;
}

/** “仅最新请求生效”控制器。 */
export interface LatestRequestController {
  /** 当前最新请求是否仍在执行。 */
  readonly loading: Readonly<Ref<boolean>>;
  /**
   * 执行请求，只允许当前最新的一次请求提交成功或失败状态。
   *
   * @param request 不应直接修改页面状态的异步请求。
   * @param callbacks 最新请求完成后的状态提交回调。
   * @returns 当前请求是否作为最新请求完成并提交了结果。
   */
  run<T>(request: () => Promise<T>, callbacks: LatestRequestCallbacks<T>): Promise<boolean>;
  /** 使当前请求立即失效；适用于关闭弹窗或清空查询条件。 */
  invalidate(): void;
}

/**
 * 创建“仅最新请求生效”的 Vue 异步控制器。
 *
 * <p>组件卸载时会自动使在途请求失效，避免慢响应覆盖新查询或修改已销毁组件的状态。</p>
 *
 * @param policy 请求提交策略，默认使用“最后发起者获胜”。
 * @returns 可复用的请求执行器和只读加载状态。
 */
export function useLatestRequest(
  policy: RequestCommitPolicy = new LatestRequestPolicy(),
): LatestRequestController {
  const loading = ref(false);

  function invalidate(): void {
    policy.invalidate();
    loading.value = false;
  }

  async function run<T>(
    request: () => Promise<T>,
    callbacks: LatestRequestCallbacks<T>,
  ): Promise<boolean> {
    const token = policy.begin();
    loading.value = true;
    try {
      let value: T;
      try {
        value = await request();
      } catch (error: unknown) {
        if (!policy.canCommit(token)) return false;
        callbacks.onError(error);
        return false;
      }
      if (!policy.canCommit(token)) return false;
      callbacks.onSuccess(value);
      return true;
    } finally {
      if (policy.canCommit(token)) loading.value = false;
    }
  }

  onScopeDispose(invalidate);
  return { loading, run, invalidate };
}
