import type { SystemLogConfig } from "./system-types";

/** 登录日志页面契约。 */
export const loginLogConfig: SystemLogConfig = {
  kind: "login",
  title: "登录日志",
  eyebrow: "Authentication Audit",
  description: "追踪登录、退出、客户端环境和失败原因，支持按账户、IP 与时间范围检索。",
  searchFields: [
    { key: "username", label: "用户名", placeholder: "输入用户名" },
    { key: "clientIp", label: "客户端 IP", placeholder: "输入客户端 IP" },
    { key: "action", label: "登录动作", placeholder: "LOGIN / LOGOUT" },
  ],
  statusKey: "status",
  columns: [
    { key: "username", label: "用户名", minWidth: 140 },
    { key: "action", label: "动作", width: 100 },
    { key: "clientIp", label: "客户端 IP", width: 145 },
    { key: "location", label: "位置", minWidth: 150 },
    { key: "status", label: "结果", width: 90, kind: "status" },
    { key: "message", label: "说明", minWidth: 210 },
    { key: "browser", label: "浏览器", minWidth: 130 },
    { key: "os", label: "操作系统", minWidth: 130 },
    { key: "logTime", label: "登录时间", width: 180, kind: "datetime" },
  ],
};

/** 操作日志页面契约。 */
export const operationLogConfig: SystemLogConfig = {
  kind: "operation",
  title: "操作日志",
  eyebrow: "Operation Audit",
  description: "审计管理端接口操作、执行状态、耗时和请求响应详情。",
  searchFields: [
    { key: "username", label: "用户名", placeholder: "输入用户名" },
    { key: "module", label: "所属模块", placeholder: "输入模块名称" },
    { key: "clientIp", label: "客户端 IP", placeholder: "输入客户端 IP" },
  ],
  statusKey: "status",
  columns: [
    { key: "username", label: "用户名", minWidth: 130 },
    { key: "module", label: "所属模块", minWidth: 150 },
    { key: "operationTypeCode", label: "操作类型", width: 110 },
    { key: "description", label: "操作说明", minWidth: 230 },
    { key: "clientIp", label: "客户端 IP", width: 145 },
    { key: "status", label: "结果", width: 90, kind: "status" },
    { key: "costMs", label: "耗时(ms)", width: 100 },
    { key: "logTime", label: "操作时间", width: 180, kind: "datetime" },
  ],
};

/** 文件上传日志页面契约。 */
export const fileLogConfig: SystemLogConfig = {
  kind: "oss",
  title: "文件日志",
  eyebrow: "Object Storage Audit",
  description: "追踪文件上传、对象存储位置、文件大小和失败记录。",
  searchFields: [
    { key: "username", label: "用户名", placeholder: "输入用户名" },
    { key: "originalName", label: "文件名", placeholder: "输入原始文件名" },
    { key: "bizModule", label: "业务模块", placeholder: "输入业务模块" },
  ],
  statusKey: "status",
  columns: [
    { key: "username", label: "用户名", minWidth: 130 },
    { key: "originalName", label: "原始文件名", minWidth: 240 },
    { key: "bizModule", label: "业务模块", minWidth: 150 },
    { key: "fileSize", label: "文件大小", width: 110, kind: "bytes" },
    { key: "fileSuffix", label: "后缀", width: 80 },
    { key: "status", label: "结果", width: 90, kind: "status" },
    { key: "clientIp", label: "客户端 IP", width: 145 },
    { key: "logTime", label: "上传时间", width: 180, kind: "datetime" },
  ],
};
