import { PlatformError } from "./error.js";
import type { QueryValue } from "./types.js";

/** 访问令牌的额外承载位置。Authorization 请求头始终按默认契约发送。 */
export type AccessTokenPlacement = "query" | "json-body";

/**
 * 校验可发送的访问令牌。
 *
 * @param accessToken 待校验的访问令牌。
 * @throws {PlatformError} 令牌为空或包含空白字符时抛出，避免产生歧义的认证请求。
 */
export function assertAccessToken(accessToken: string): void {
  if (typeof accessToken !== "string" || accessToken.length === 0 || /\s/u.test(accessToken)) {
    throw new PlatformError(
      "访问令牌不能为空且不能包含空白字符",
      0,
      "INVALID_ACCESS_TOKEN",
      undefined,
    );
  }
}

function hasTokenField(value: object): boolean {
  return Object.prototype.hasOwnProperty.call(value, "token");
}

/**
 * 返回携带顶层 token 查询参数的新对象，不会修改调用方传入的查询参数。
 *
 * @param query 原查询参数；省略时从仅含 token 的查询参数开始。
 * @param accessToken 要携带的访问令牌。
 * @returns 含 token 的新查询参数对象。
 * @throws {PlatformError} 令牌无效或原查询参数已声明 token 时抛出。
 */
export function addAccessTokenToQuery(
  query: Readonly<Record<string, QueryValue>> | undefined,
  accessToken: string,
): Record<string, QueryValue> {
  assertAccessToken(accessToken);
  if (query !== undefined && hasTokenField(query)) {
    throw new PlatformError(
      "查询参数已包含 token，无法安全添加访问令牌",
      0,
      "TOKEN_FIELD_CONFLICT",
      undefined,
    );
  }
  return { ...query, token: accessToken };
}

/**
 * 返回携带顶层 token 字段的新 JSON 对象，不会修改调用方传入的请求体。
 *
 * @param body 原 JSON 对象；省略时从仅含 token 的对象开始。
 * @param accessToken 要携带的访问令牌。
 * @returns 含 token 的新 JSON 对象。
 * @throws {PlatformError} 令牌无效、请求体不是 JSON 对象或原请求体已声明 token 时抛出。
 */
export function addAccessTokenToJsonBody(
  body: Readonly<Record<string, unknown>> | null | undefined,
  accessToken: string,
): Record<string, unknown> {
  assertAccessToken(accessToken);
  if (body === null || body === undefined) return { token: accessToken };
  const prototype = typeof body === "object" ? Object.getPrototypeOf(body) : undefined;
  if (Array.isArray(body) || (prototype !== Object.prototype && prototype !== null)) {
    throw new PlatformError(
      "JSON 请求体必须是对象，才能添加顶层 token",
      0,
      "TOKEN_BODY_NOT_OBJECT",
      undefined,
    );
  }
  if (hasTokenField(body)) {
    throw new PlatformError(
      "JSON 请求体已包含 token，无法安全添加访问令牌",
      0,
      "TOKEN_FIELD_CONFLICT",
      undefined,
    );
  }
  return { ...body, token: accessToken };
}
