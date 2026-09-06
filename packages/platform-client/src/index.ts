import { PlatformAuthClient, type AuthClient, type AuthEndpointOptions } from "./auth.js";
import { PlatformAgentClient, type AgentClient } from "./agent.js";
import { PlatformHttpClient } from "./http.js";
import { PlatformSchedulerClient, type SchedulerClient } from "./scheduler.js";
import { PlatformSystemClient, type SystemClient } from "./system.js";
import type { PlatformClientOptions, PlatformRequestClient } from "./types.js";

export type { AuthClient, AuthEndpointOptions, AuthSession, LoginRequest } from "./auth.js";
export { PlatformAgentClient } from "./agent.js";
export type {
  AgentClient,
  AgentDefinition,
  AgentDefinitionInput,
  AgentInvocation,
  AgentInvocationInput,
  AgentInvocationMode,
  AgentInvocationResult,
  AgentInvocationState,
  AgentMessage,
  AgentPage,
  AgentProviderType,
  AgentPublishState,
  AgentSession,
  AgentSessionState,
  AgentVoiceRecord,
} from "./agent.js";
export { hasPlatformPermission, matchesPlatformPermission, PlatformAuthClient } from "./auth.js";
export { digestPassword, generateTemporaryPassword } from "./password.js";
export { PLATFORM_API_CODES, PLATFORM_HTTP_STATUS } from "./constants.js";
export { PlatformError } from "./error.js";
export { PlatformHttpClient } from "./http.js";
export { addAccessTokenToJsonBody, addAccessTokenToQuery, assertAccessToken } from "./token.js";
export type { AccessTokenPlacement } from "./token.js";
export { PlatformSchedulerClient } from "./scheduler.js";
export { PlatformSystemClient } from "./system.js";
export type {
  SchedulerApplication,
  SchedulerClient,
  SchedulerExpressionType,
  SchedulerHandler,
  SchedulerInstance,
  SchedulerPage,
  SchedulerSyncState,
  SchedulerTask,
  SchedulerTaskInput,
} from "./scheduler.js";
export type {
  ImportDataType,
  ImportFileType,
  ImportMappingSavePayload,
  ImportTemplateSavePayload,
  ImportWriteMode,
  MenuTreeNode,
  RegionLevel,
  RegionSavePayload,
  RoleDetail,
  RoleQuery,
  RoleSavePayload,
  RoleSummary,
  SystemDepartment,
  SystemDictionary,
  SystemDictionaryItem,
  SystemClient,
  SystemEntity,
  SystemImportMapping,
  SystemImportTemplate,
  SystemLogKind,
  SystemLogRecord,
  SystemMessage,
  SystemMenu,
  SystemMenuPayload,
  SystemMenuType,
  SystemOption,
  SystemPage,
  SystemQuery,
  SystemRegion,
  SystemUserSetting,
  SystemWeather,
  UserDetail,
  UserSavePayload,
  UserSummary,
} from "./system.js";
export type {
  ApiEnvelope,
  MaybePromise,
  PlatformClientOptions,
  PlatformBody,
  PlatformRequestContext,
  PlatformRequestTransformer,
  PlatformRequestOptions,
  PlatformRequestClient,
  PlatformResponseContext,
  PlatformResponseTransformer,
  PlatformUnauthorizedHandler,
  QueryScalar,
  QueryValue,
  ResponseType,
} from "./types.js";

/** 聚合后的平台客户端。 */
export interface PlatformClient {
  /** 通用 HTTP 客户端。 */
  http: PlatformRequestClient;
  /** 认证 API。 */
  auth: AuthClient;
  /** 通用智能体 API。 */
  agent: AgentClient;
  /** 通用调度管理 API。 */
  scheduler: SchedulerClient;
  /** 通用系统管理 API。 */
  system: SystemClient;
}

/** 平台客户端外观工厂。 */
export class PlatformClientFactory {
  /**
   * 创建共享同一传输、身份与租户上下文的平台客户端外观。
   *
   * @param http 已配置的请求传输，可由产品适配现有鉴权、加密或监控实现。
   * @param authEndpoints 可选认证端点覆盖。
   */
  static fromTransport(
    http: PlatformRequestClient,
    authEndpoints?: AuthEndpointOptions,
  ): PlatformClient {
    return {
      http,
      auth: new PlatformAuthClient(http, authEndpoints),
      agent: new PlatformAgentClient(http),
      scheduler: new PlatformSchedulerClient(http),
      system: new PlatformSystemClient(http),
    };
  }

  /**
   * 从 Fetch 配置创建默认平台客户端外观。
   *
   * @param options HTTP 客户端配置。
   * @param authEndpoints 可选认证端点覆盖。
   */
  static create(
    options: PlatformClientOptions,
    authEndpoints?: AuthEndpointOptions,
  ): PlatformClient {
    return PlatformClientFactory.fromTransport(new PlatformHttpClient(options), authEndpoints);
  }
}

/**
 * 创建平台客户端及认证 API。
 *
 * @param options HTTP 客户端配置。
 * @param authEndpoints 可选认证端点覆盖。
 * @returns 同一网关和身份上下文下的平台客户端。
 */
export function createPlatformClient(
  options: PlatformClientOptions,
  authEndpoints?: AuthEndpointOptions,
): PlatformClient {
  return PlatformClientFactory.create(options, authEndpoints);
}
