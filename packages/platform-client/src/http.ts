import { PLATFORM_API_CODES, PLATFORM_HTTP_STATUS } from "./constants.js";
import { PlatformError } from "./error.js";
import {
  addAccessTokenToJsonBody,
  addAccessTokenToQuery,
  assertAccessToken,
} from "./token.js";
import type {
  ApiEnvelope,
  PlatformClientOptions,
  PlatformRequestClient,
  PlatformRequestOptions,
  QueryValue,
  ResponseType,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    isRecord(value) &&
    typeof value.code === "number" &&
    typeof value.message === "string" &&
    "data" in value
  );
}

function envelopeSucceeded(envelope: ApiEnvelope<unknown>): boolean {
  return envelope.code === PLATFORM_API_CODES.SUCCESS;
}

function appendQuery(url: string, query: Readonly<Record<string, QueryValue>> | undefined): string {
  if (query === undefined) return url;

  const [withoutHash, hash = ""] = url.split("#", 2);
  const separator = withoutHash?.includes("?") === true ? "&" : "?";
  const parameters = new URLSearchParams();

  for (const [name, rawValue] of Object.entries(query)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value !== null && value !== undefined) parameters.append(name, String(value));
    }
  }

  const serialized = parameters.toString();
  if (serialized.length === 0) return url;
  return `${withoutHash}${separator}${serialized}${hash.length === 0 ? "" : `#${hash}`}`;
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//iu.test(path)) {
    throw new PlatformError(
      "平台端点必须使用网关内相对路径",
      0,
      "ABSOLUTE_ENDPOINT_REJECTED",
      path,
    );
  }
  return `${baseUrl.replace(/\/+$/u, "")}/${path.replace(/^\/+/, "")}`;
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}

function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (isBodyInit(body)) return body;

  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

async function parseResponse(response: Response, responseType: ResponseType): Promise<unknown> {
  if (response.status === PLATFORM_HTTP_STATUS.NO_CONTENT) return undefined;

  switch (responseType) {
    case "arrayBuffer":
      return response.arrayBuffer();
    case "blob":
      return response.blob();
    case "text":
      return response.text();
    case "json": {
      const text = await response.text();
      return text.length === 0 ? undefined : (JSON.parse(text) as unknown);
    }
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const message = payload.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

/** 支持 Token、租户、超时和平台响应解包的 HTTP 客户端。 */
export class PlatformHttpClient implements PlatformRequestClient {
  private readonly fetchImplementation: typeof globalThis.fetch;

  /**
   * 创建平台 HTTP 客户端。
   *
   * @param options 网关地址、身份提供器和默认请求参数。
   */
  constructor(private readonly options: PlatformClientOptions) {
    const nativeFetch = globalThis.fetch;
    const fetchImplementation =
      options.fetch ?? (nativeFetch === undefined ? undefined : nativeFetch.bind(globalThis));
    if (fetchImplementation === undefined) {
      throw new PlatformError("当前环境没有可用的 Fetch 实现", 0, "FETCH_UNAVAILABLE", undefined);
    }
    this.fetchImplementation = fetchImplementation;
  }

  /**
   * 发起一个类型化平台请求。
   *
   * @param path 网关内相对路径；绝对地址会被拒绝，避免绕过统一网关。
   * @param requestOptions 请求方法、查询参数、请求体及解析方式。
   * @returns 已按平台协议解包的响应数据。
   * @throws {PlatformError} 网络、HTTP 或业务响应失败时抛出。
   */
  async request<T>(path: string, requestOptions: PlatformRequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const externalSignal = requestOptions.signal;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);

    if (externalSignal?.aborted === true) abortFromExternal();
    else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

    const timeoutMs = requestOptions.timeoutMs ?? this.options.defaultTimeoutMs ?? 15_000;
    const timeout =
      timeoutMs > 0
        ? setTimeout(() => controller.abort(new Error(`请求超过 ${timeoutMs} ms`)), timeoutMs)
        : undefined;

    try {
      const responseType = requestOptions.responseType ?? "json";
      let hasRetriedAfterUnauthorized = false;

      while (true) {
        const headers = new Headers(this.options.defaultHeaders);
        new Headers(requestOptions.headers).forEach((value, name) => headers.set(name, value));
        if (!headers.has("Accept")) headers.set("Accept", "application/json");

        let accessToken: string | null | undefined;
        if (requestOptions.accessToken === null) {
          headers.delete("Authorization");
        } else {
          accessToken = requestOptions.accessToken ?? (await this.options.tokenProvider?.());
          if (accessToken !== null && accessToken !== undefined) {
            assertAccessToken(accessToken);
            headers.set("Authorization", `Bearer ${accessToken}`);
          }
        }

        const tenantId = await this.options.tenantProvider?.();
        if (tenantId !== null && tenantId !== undefined && String(tenantId).length > 0) {
          headers.set("X-Tenant-Id", String(tenantId));
        }

        const query =
          accessToken !== null && accessToken !== undefined &&
          this.options.accessTokenPlacement === "query"
            ? addAccessTokenToQuery(requestOptions.query, accessToken)
            : requestOptions.query;
        const requestBody =
          accessToken !== null && accessToken !== undefined &&
          this.options.accessTokenPlacement === "json-body"
            ? addAccessTokenToJsonBody(
                requestOptions.body as Readonly<Record<string, unknown>> | null | undefined,
                accessToken,
              )
            : requestOptions.body;
        const url = appendQuery(joinUrl(this.options.baseUrl, path), query);
        const body = serializeBody(requestBody, headers);
        const init: RequestInit = {
          method: requestOptions.method ?? "GET",
          headers,
          signal: controller.signal,
          credentials: requestOptions.credentials ?? "same-origin",
        };
        if (body !== undefined) init.body = body;

        const requestContext = { path, url, headers, body, init };
        await this.options.transformRequest?.(requestContext);
        await requestOptions.transformRequest?.(requestContext);

        const response = await this.fetchImplementation(url, init);
        let payload = await parseResponse(response, responseType);
        const responseContext = { path, url, response, responseType, payload };
        payload = (await this.options.transformResponse?.(responseContext)) ?? payload;
        payload =
          (await requestOptions.transformResponse?.({ ...responseContext, payload })) ?? payload;

        if (!response.ok) {
          if (
            response.status === PLATFORM_HTTP_STATUS.UNAUTHORIZED &&
            requestOptions.retryUnauthorized !== false &&
            !hasRetriedAfterUnauthorized &&
            this.options.onUnauthorized
          ) {
            hasRetriedAfterUnauthorized = true;
            if (await this.options.onUnauthorized({ ...responseContext, payload })) continue;
          }
          throw new PlatformError(
            errorMessage(payload, `平台请求失败（HTTP ${response.status}）`),
            response.status,
            isRecord(payload) &&
              (typeof payload.code === "string" || typeof payload.code === "number")
              ? payload.code
              : undefined,
            payload,
          );
        }

        if (response.status === PLATFORM_HTTP_STATUS.NO_CONTENT) {
          return undefined as T;
        }

        if (isEnvelope(payload)) {
          if (!envelopeSucceeded(payload)) {
            throw new PlatformError(payload.message, response.status, payload.code, payload);
          }
          return payload.data as T;
        }

        if (responseType === "json") {
          throw new PlatformError(
            "平台服务返回了无效响应信封",
            response.status,
            "INVALID_API_ENVELOPE",
            payload,
          );
        }

        return payload as T;
      }
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      if (controller.signal.aborted) {
        throw new PlatformError(
          "平台请求已取消或超时",
          0,
          "REQUEST_ABORTED",
          controller.signal.reason,
        );
      }
      throw new PlatformError("无法连接平台服务", 0, "NETWORK_ERROR", error);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  }
}
