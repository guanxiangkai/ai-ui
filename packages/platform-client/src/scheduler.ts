import type { PlatformRequestClient } from "./types.js";

/** 支持的定时表达式类型。 */
export type SchedulerExpressionType = "CRON" | "FIXED_RATE" | "FIXED_DELAY";

/** 本地任务定义与调度引擎的同步状态。 */
export type SchedulerSyncState = "PENDING" | "SYNCED" | "FAILED";

/** 平台标准分页结果。 */
export interface SchedulerPage<T> {
  /** 当前页数据。 */
  records: T[];
  /** 总记录数。 */
  total: number;
  /** 当前页码。 */
  pageNum?: number;
  /** 当前页大小。 */
  pageSize?: number;
}

/** 可调度的业务处理器目录项。 */
export interface SchedulerHandler {
  /** PowerJob 处理器 Bean 名称。 */
  processorInfo: string;
  /** 页面显示名称。 */
  displayName: string;
  /** 用途说明。 */
  description: string;
}

/** 当前租户允许使用的业务应用。 */
export interface SchedulerApplication {
  /** 调度服务中的应用逻辑编码。 */
  code: string;
  /** 页面显示名称。 */
  displayName: string;
  /** PowerJob 应用名称。 */
  appName: string;
  /** 允许选择的处理器白名单。 */
  handlers: SchedulerHandler[];
}

/** 通用定时任务。 */
export interface SchedulerTask {
  id: string;
  taskCode: string;
  taskName: string;
  applicationCode: string;
  applicationName: string;
  processorInfo: string;
  timeExpressionType: SchedulerExpressionType;
  timeExpression: string;
  jobParameters?: string | null;
  maxInstanceNum: number;
  concurrency: number;
  instanceTimeLimit: number;
  instanceRetryNum: number;
  taskRetryNum: number;
  enabled: boolean;
  remark?: string | null;
  powerjobJobId?: number | null;
  syncState: SchedulerSyncState;
  lastSyncTime?: string | null;
  lastSyncMessage?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

/** 创建或更新任务的期望配置。 */
export interface SchedulerTaskInput {
  taskCode: string;
  taskName: string;
  applicationCode: string;
  processorInfo: string;
  timeExpressionType: SchedulerExpressionType;
  timeExpression: string;
  jobParameters?: string | null;
  maxInstanceNum?: number;
  concurrency?: number;
  instanceTimeLimit?: number;
  instanceRetryNum?: number;
  taskRetryNum?: number;
  enabled?: boolean;
  remark?: string | null;
}

/** PowerJob 执行实例的只读视图。 */
export interface SchedulerInstance {
  instanceId: number;
  jobId: number;
  status: number;
  statusCode: string;
  statusLabel: string;
  jobParameters?: string | null;
  instanceParameters?: string | null;
  result?: string | null;
  expectedTriggerTime?: string | null;
  actualTriggerTime?: string | null;
  finishedTime?: string | null;
  runningTimes?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
}

/** 调度管理页面依赖的产品无关客户端契约。 */
export interface SchedulerClient {
  applications(): Promise<SchedulerApplication[]>;
  tasks(query: {
    page: number;
    size: number;
    keyword?: string;
    enabled?: boolean;
  }): Promise<SchedulerPage<SchedulerTask>>;
  create(input: SchedulerTaskInput): Promise<SchedulerTask>;
  update(id: string, input: SchedulerTaskInput): Promise<SchedulerTask>;
  changeEnabled(id: string, enabled: boolean): Promise<SchedulerTask>;
  synchronize(id: string): Promise<SchedulerTask>;
  run(id: string, parameters?: string): Promise<number>;
  instances(
    id: string,
    query: { page: number; size: number },
  ): Promise<SchedulerPage<SchedulerInstance>>;
  delete(id: string): Promise<boolean>;
}

/** 基于平台 HTTP 客户端的通用调度 API。 */
export class PlatformSchedulerClient implements SchedulerClient {
  /**
   * 创建调度 API。
   *
   * @param http 已绑定产品网关、Token 和租户上下文的 HTTP 客户端。
   * @param basePath 调度控制面路径，默认 `/scheduler`。
   */
  constructor(
    private readonly http: PlatformRequestClient,
    private readonly basePath = "/scheduler",
  ) {}

  applications(): Promise<SchedulerApplication[]> {
    return this.http.request(`${this.basePath}/applications`);
  }

  tasks(query: {
    page: number;
    size: number;
    keyword?: string;
    enabled?: boolean;
  }): Promise<SchedulerPage<SchedulerTask>> {
    return this.http.request(`${this.basePath}/tasks`, { query });
  }

  create(input: SchedulerTaskInput): Promise<SchedulerTask> {
    return this.http.request(`${this.basePath}/tasks`, { method: "POST", body: input });
  }

  update(id: string, input: SchedulerTaskInput): Promise<SchedulerTask> {
    return this.http.request(`${this.basePath}/tasks/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input,
    });
  }

  changeEnabled(id: string, enabled: boolean): Promise<SchedulerTask> {
    return this.http.request(`${this.basePath}/tasks/${encodeURIComponent(id)}/enabled`, {
      method: "PUT",
      query: { enabled },
    });
  }

  synchronize(id: string): Promise<SchedulerTask> {
    return this.http.request(`${this.basePath}/tasks/${encodeURIComponent(id)}/sync`, {
      method: "POST",
    });
  }

  run(id: string, parameters?: string): Promise<number> {
    return this.http.request(`${this.basePath}/tasks/${encodeURIComponent(id)}/run`, {
      method: "POST",
      body: parameters === undefined ? undefined : { parameters },
    });
  }

  instances(
    id: string,
    query: { page: number; size: number },
  ): Promise<SchedulerPage<SchedulerInstance>> {
    return this.http.request(`${this.basePath}/tasks/${encodeURIComponent(id)}/instances`, {
      query,
    });
  }

  delete(id: string): Promise<boolean> {
    return this.http.request(`${this.basePath}/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
