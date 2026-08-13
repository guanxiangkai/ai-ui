import type { PlatformRequestClient } from "./types.js";

/** 通用智能体提供方协议。 */
export type AgentProviderType = "OPENAI_COMPATIBLE" | "DIFY";

/** 通用智能体调用形态。 */
export type AgentInvocationMode = "CHAT" | "WORKFLOW";

/** 智能体发布状态。 */
export type AgentPublishState = "DRAFT" | "PUBLISHED";

/** 会话生命周期。 */
export type AgentSessionState = "ACTIVE" | "COMPLETED" | "FAILED";

/** 单次调用状态。 */
export type AgentInvocationState = "RUNNING" | "SUCCEEDED" | "FAILED";

/** 平台标准分页结果。 */
export interface AgentPage<T> {
  records: T[];
  total: number;
  pageNum?: number;
  pageSize?: number;
}

/** 不含提供方密钥的智能体定义。 */
export interface AgentDefinition {
  id: string;
  agentCode: string;
  agentName: string;
  description?: string | null;
  providerType: AgentProviderType;
  invocationMode: AgentInvocationMode;
  endpointUrl: string;
  modelName?: string | null;
  credentialConfigured: boolean;
  systemPrompt?: string | null;
  temperature?: number | null;
  runtimeConfig?: string | null;
  publishState: AgentPublishState;
  revision: number;
  enabled: boolean;
  remark?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

/** 创建或更新智能体定义的期望配置。 */
export interface AgentDefinitionInput {
  agentCode: string;
  agentName: string;
  description?: string | null;
  providerType: AgentProviderType;
  invocationMode: AgentInvocationMode;
  endpointUrl: string;
  modelName?: string | null;
  /** 更新时不传或留空即保留已配置密钥。 */
  credential?: string | null;
  systemPrompt?: string | null;
  temperature?: number | null;
  runtimeConfig?: string | null;
  publishState?: AgentPublishState;
  enabled?: boolean;
  remark?: string | null;
}

/** 会话消息。 */
export interface AgentMessage {
  id: string;
  sequenceNo: number;
  role: string;
  content: string;
  metadataJson?: string | null;
  createTime?: string | null;
}

/** 产品无关的智能体会话。 */
export interface AgentSession {
  id: string;
  sessionCode: string;
  agentId: string;
  agentCode: string;
  userId: string;
  title?: string | null;
  contextNamespace?: string | null;
  contextReference?: string | null;
  contextJson?: string | null;
  messageCount: number;
  sessionState: AgentSessionState;
  startedAt?: string | null;
  endedAt?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  messages?: AgentMessage[];
}

/** 智能体调用审计。 */
export interface AgentInvocation {
  id: string;
  invocationCode: string;
  sessionId: string;
  agentId: string;
  agentCode: string;
  providerType: AgentProviderType;
  modelName?: string | null;
  operation: string;
  invocationState: AgentInvocationState;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  requestSummary?: string | null;
  responseSummary?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createTime?: string | null;
}

/** 语音转写审计。 */
export interface AgentVoiceRecord {
  id: string;
  sessionId?: string | null;
  userId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
  language?: string | null;
  durationSeconds?: number | null;
  transcript?: string | null;
  recognitionStatus: string;
  errorMessage?: string | null;
  createTime?: string | null;
}

/** 智能体调用输入。 */
export interface AgentInvocationInput {
  sessionId?: string | null;
  message: string;
  sessionTitle?: string | null;
  contextNamespace?: string | null;
  contextReference?: string | null;
  variables?: Record<string, unknown>;
}

/** 智能体调用结果。 */
export interface AgentInvocationResult {
  sessionId: string;
  invocationId: string;
  messageId: string;
  text: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

/** 通用智能体页面依赖的客户端契约。 */
export interface AgentClient {
  definitions(query: {
    page: number;
    size: number;
    keyword?: string;
    providerType?: AgentProviderType;
    publishState?: AgentPublishState;
    enabled?: boolean;
  }): Promise<AgentPage<AgentDefinition>>;
  definition(id: string): Promise<AgentDefinition>;
  create(input: AgentDefinitionInput): Promise<AgentDefinition>;
  update(id: string, input: AgentDefinitionInput): Promise<AgentDefinition>;
  changeEnabled(id: string, enabled: boolean): Promise<AgentDefinition>;
  test(id: string, input: AgentInvocationInput): Promise<AgentInvocationResult>;
  invoke(id: string, input: AgentInvocationInput): Promise<AgentInvocationResult>;
  delete(id: string): Promise<boolean>;
  sessions(query: {
    page: number;
    size: number;
    keyword?: string;
    agentId?: string;
    state?: AgentSessionState;
  }): Promise<AgentPage<AgentSession>>;
  session(id: string): Promise<AgentSession>;
  invocations(query: {
    page: number;
    size: number;
    keyword?: string;
    agentId?: string;
    state?: AgentInvocationState;
  }): Promise<AgentPage<AgentInvocation>>;
  voices(query: {
    page: number;
    size: number;
    keyword?: string;
    status?: string;
  }): Promise<AgentPage<AgentVoiceRecord>>;
}

/** 基于平台 HTTP 传输的通用智能体客户端。 */
export class PlatformAgentClient implements AgentClient {
  /** 创建绑定到当前产品网关和租户上下文的客户端。 */
  constructor(
    private readonly http: PlatformRequestClient,
    private readonly basePath = "/agent",
  ) {}

  definitions(
    query: Parameters<AgentClient["definitions"]>[0],
  ): Promise<AgentPage<AgentDefinition>> {
    return this.http.request(`${this.basePath}/definitions`, { query });
  }

  definition(id: string): Promise<AgentDefinition> {
    return this.http.request(`${this.basePath}/definitions/${encodeURIComponent(id)}`);
  }

  create(input: AgentDefinitionInput): Promise<AgentDefinition> {
    return this.http.request(`${this.basePath}/definitions`, { method: "POST", body: input });
  }

  update(id: string, input: AgentDefinitionInput): Promise<AgentDefinition> {
    return this.http.request(`${this.basePath}/definitions/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input,
    });
  }

  changeEnabled(id: string, enabled: boolean): Promise<AgentDefinition> {
    return this.http.request(`${this.basePath}/definitions/${encodeURIComponent(id)}/enabled`, {
      method: "PUT",
      query: { enabled },
    });
  }

  test(id: string, input: AgentInvocationInput): Promise<AgentInvocationResult> {
    return this.http.request(`${this.basePath}/definitions/${encodeURIComponent(id)}/test`, {
      method: "POST",
      body: input,
      timeoutMs: 600_000,
    });
  }

  invoke(id: string, input: AgentInvocationInput): Promise<AgentInvocationResult> {
    return this.http.request(`${this.basePath}/definitions/${encodeURIComponent(id)}/invoke`, {
      method: "POST",
      body: input,
      timeoutMs: 600_000,
    });
  }

  delete(id: string): Promise<boolean> {
    return this.http.request(`${this.basePath}/definitions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  sessions(query: Parameters<AgentClient["sessions"]>[0]): Promise<AgentPage<AgentSession>> {
    return this.http.request(`${this.basePath}/sessions`, { query });
  }

  session(id: string): Promise<AgentSession> {
    return this.http.request(`${this.basePath}/sessions/${encodeURIComponent(id)}`);
  }

  invocations(
    query: Parameters<AgentClient["invocations"]>[0],
  ): Promise<AgentPage<AgentInvocation>> {
    return this.http.request(`${this.basePath}/invocations`, { query });
  }

  voices(query: Parameters<AgentClient["voices"]>[0]): Promise<AgentPage<AgentVoiceRecord>> {
    return this.http.request(`${this.basePath}/voices`, { query });
  }
}
