import type { SystemClient, SystemLogKind } from "@guanxiangkai/platform-client";

export type SystemFieldType = "text" | "number" | "textarea" | "datetime" | "tree";

export interface SystemFormField {
  key: string;
  label: string;
  type: SystemFieldType;
  required?: boolean;
  placeholder?: string;
  optionsPath?: string;
  span?: 1 | 2;
  min?: number;
  max?: number;
}

export interface SystemSearchField {
  key: string;
  label: string;
  placeholder: string;
}

export interface SystemTableColumn {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  kind?: "text" | "code" | "datetime";
}

export interface SystemEntityConfig {
  permissionPrefix: "system:tenant" | "system:dept" | "system:post";
  basePath: string;
  title: string;
  eyebrow: string;
  description: string;
  entityName: string;
  primaryLabelKey: string;
  searchFields: SystemSearchField[];
  tableColumns: SystemTableColumn[];
  formFields: SystemFormField[];
  initialValues: Record<string, string | number | null>;
}

export interface SystemLogColumn {
  key: string;
  label: string;
  minWidth?: number;
  width?: number;
  kind?: "text" | "status" | "boolean" | "bytes" | "datetime";
}

export interface SystemLogConfig {
  kind: SystemLogKind;
  title: string;
  eyebrow: string;
  description: string;
  searchFields: SystemSearchField[];
  /** 日志 API 统一的状态查询字段。 */
  statusKey: "status";
  columns: SystemLogColumn[];
}

export interface SystemViewProps {
  client: SystemClient;
  permissions?: readonly string[];
  superAdmin?: boolean;
}
