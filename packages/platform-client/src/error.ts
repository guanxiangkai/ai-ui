/** 平台请求的统一错误。 */
export class PlatformError extends Error {
  override readonly name = "PlatformError";

  /**
   * 创建平台错误。
   *
   * @param message 面向调用方的错误说明。
   * @param status HTTP 状态码；请求未到达服务端时为 0。
   * @param code 服务端业务码或客户端错误码。
   * @param details 服务端错误载荷或底层异常。
   */
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | number | undefined,
    readonly details: unknown,
  ) {
    super(message);
  }
}
