import type { AgentClient, SchedulerClient } from "@guanxiangkai/platform-client";

/** 通用智能体管理页面标签。 */
export type PlatformAgentTab = "definitions" | "sessions" | "invocations" | "voices";

/** 通用智能体管理页面属性。 */
export interface PlatformAgentProps {
  /** 已绑定当前网关、令牌与租户上下文的智能体客户端。 */
  client: AgentClient;
  /** 页面标题。 */
  title?: string;
  /** 页面说明。 */
  description?: string;
  /** 首次打开的管理标签。 */
  initialTab?: PlatformAgentTab;
  /** 当前用户拥有的权限编码。 */
  permissions?: readonly string[];
  /** 超级管理员不受按钮权限限制。 */
  superAdmin?: boolean;
}

/** 平台登录组件属性。 */
export interface PlatformLoginProps {
  /** 提交期间是否禁用表单。 */
  loading?: boolean;
  /** 服务端返回的错误说明。 */
  error?: string;
  /** 账号字段标签。 */
  usernameLabel?: string;
  /** 密码字段标签。 */
  passwordLabel?: string;
  /** 提交按钮文本。 */
  submitLabel?: string;
}

/** 平台登录组件提交的基础凭据。 */
export interface PlatformLoginCredentials {
  /** 登录账号。 */
  username: string;
  /** 登录密码。 */
  password: string;
}

/** 调度管理页面的功能视图。 */
export type PlatformSchedulerView = "task-config" | "task-records";

/** 平台异常状态组件属性。 */
export interface PlatformErrorStateProps {
  /** 异常状态标题。 */
  title?: string;
  /** 对用户可见的异常说明。 */
  description?: string;
  /** 重试按钮文本；为空时隐藏按钮。 */
  retryLabel?: string;
}

/** 页面身份水印的视觉配置。 */
export interface PlatformWatermarkConfig {
  /** 水印文字颜色。 */
  color?: string;
  /** 水印整体透明度，取值范围为 0 到 0.3。 */
  opacity?: number;
  /** 水印字号，单位为像素。 */
  fontSize?: number;
  /** 水印逆时针旋转角度。 */
  rotate?: number;
  /** 视口内的水印列数。 */
  columns?: number;
  /** 视口内的水印行数。 */
  rows?: number;
  /** 水印覆盖层层级。 */
  zIndex?: number;
}

/** 页面身份水印组件属性。 */
export interface PlatformWatermarkProps extends PlatformWatermarkConfig {
  /** 当前末级部门名称或完整部门路径。 */
  department?: string;
  /** 当前用户姓名。 */
  name?: string;
  /** 是否展示水印。 */
  enabled?: boolean;
}

/** 通用调度管理页面属性。 */
export interface PlatformSchedulerProps {
  /** 已绑定当前产品网关、令牌和租户上下文的调度客户端。 */
  client: SchedulerClient;
  /**
   * 页面展示的调度功能视图。
   * `task-records` 仅分页加载任务供用户筛选，选择单个任务后才请求其执行记录。
   */
  view: PlatformSchedulerView;
  /** 页面标题。 */
  title?: string;
  /** 页面说明。 */
  description?: string;
  /** 当前用户拥有的权限编码。 */
  permissions?: readonly string[];
  /** 超级管理员不受按钮权限限制。 */
  superAdmin?: boolean;
}
