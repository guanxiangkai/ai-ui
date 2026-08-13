/** 平台响应信封中的业务码；与 Web Plus 的 `ApiResponse` 契约保持一致。 */
export const PLATFORM_API_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOO_MANY_REQUESTS: 429,
  SYSTEM_ERROR: 500,
} as const;

/** HTTP 传输状态码；仅用于浏览器响应状态判断，不与响应信封业务码混用。 */
export const PLATFORM_HTTP_STATUS = {
  NO_CONTENT: 204,
  UNAUTHORIZED: 401,
} as const;
