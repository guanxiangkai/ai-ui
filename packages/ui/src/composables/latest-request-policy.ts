/** 异步请求的唯一标识。 */
export type RequestToken = number;

/**
 * 决定异步请求是否仍可提交页面状态的策略。
 *
 * <p>控制器只负责 Vue 加载状态与生命周期，时序规则由策略实现，便于在轮询、搜索和详情切换等场景
 * 使用同一控制器而替换并发语义。</p>
 */
export interface RequestCommitPolicy {
  /** 开始一次请求并返回唯一标识。 */
  begin(): RequestToken;
  /** 判断指定请求是否仍拥有提交成功或失败状态的权利。 */
  canCommit(token: RequestToken): boolean;
  /** 使当前请求失效。 */
  invalidate(): void;
}

/** “最后发起者获胜”的请求提交策略。 */
export class LatestRequestPolicy implements RequestCommitPolicy {
  private version = 0;

  /** 开始新请求，同时使此前请求失去提交权。 */
  begin(): RequestToken {
    this.version += 1;
    return this.version;
  }

  /** 仅允许最后开始且尚未失效的请求提交。 */
  canCommit(token: RequestToken): boolean {
    return token === this.version;
  }

  /** 使所有已开始的请求失去提交权。 */
  invalidate(): void {
    this.version += 1;
  }
}
