import type { PlatformRequestClient, QueryValue } from "./types.js";

export interface SystemPage<T> {
  records: T[];
  total: number;
  pageNum?: number | undefined;
  pageSize?: number | undefined;
  pages?: number | undefined;
}

export interface SystemOption {
  label: string;
  value: string;
  disabled?: boolean;
  children?: SystemOption[];
}

export interface SystemEntity {
  id: string;
  enabled?: boolean;
  sortOrder?: number;
  createTime?: string;
  updateTime?: string;
  [key: string]: unknown;
}

export type RegionLevel = "province" | "city" | "district" | "street";

/** 国家行政区划目录。 */
export interface SystemRegion extends SystemEntity {
  regionCode: string;
  regionName: string;
  parentId?: string;
  regionLevel: RegionLevel;
  fullName?: string;
  shortName?: string;
  longitude?: number;
  latitude?: number;
  zipCode?: string;
  remark?: string;
  children?: SystemRegion[];
}

export interface RegionSavePayload {
  regionCode: string;
  regionName: string;
  parentId?: string;
  regionLevel: RegionLevel;
  shortName?: string;
  longitude?: number;
  latitude?: number;
  zipCode?: string;
  enabled?: boolean;
  sortOrder?: number;
  remark?: string;
}

export type ImportFileType = "xlsx" | "xls" | "csv";
export type ImportWriteMode = "INSERT" | "UPSERT";
export type ImportDataType =
  | "STRING"
  | "INTEGER"
  | "LONG"
  | "DECIMAL"
  | "BOOLEAN"
  | "LOCAL_DATE"
  | "LOCAL_DATE_TIME"
  | "UUID"
  | "JSON";

/** 通用批量导入的模板定义。 */
export interface SystemImportTemplate extends SystemEntity {
  templateModule: string;
  templateCode: string;
  templateName: string;
  fileType: ImportFileType;
  fileNamePatterns?: string[];
  sheetNames?: string[];
  targetSchema?: string;
  targetTable?: string;
  customImportEnabled?: boolean;
  handlerKey?: string;
  writeMode?: ImportWriteMode;
  headerRowIndex?: number;
  batchSize?: number;
  remark?: string;
}

export interface ImportTemplateSavePayload {
  templateModule: string;
  templateCode: string;
  templateName: string;
  fileType: ImportFileType;
  fileNamePatterns?: string[];
  sheetNames?: string[];
  targetSchema?: string;
  targetTable?: string;
  customImportEnabled?: boolean;
  handlerKey?: string;
  writeMode?: ImportWriteMode;
  headerRowIndex?: number;
  batchSize?: number;
  sortOrder?: number;
  remark?: string;
}

export interface SystemImportMapping extends SystemEntity {
  templateId: string;
  title: string[];
  field: string;
  targetColumn?: string;
  dataType?: ImportDataType;
  formatPattern?: string;
  defaultValue?: string;
  converterKey?: string;
  exactMatch?: boolean;
  required?: boolean;
  multiple?: boolean;
  repeat?: boolean;
  remark?: string;
}

export interface ImportMappingSavePayload {
  templateId: string;
  title: string[];
  field: string;
  targetColumn?: string;
  dataType?: ImportDataType;
  formatPattern?: string;
  defaultValue?: string;
  converterKey?: string;
  exactMatch: boolean;
  required: boolean;
  multiple: boolean;
  repeat: boolean;
  sortOrder?: number;
  remark?: string;
}

/** 当前用户收到的站内消息。 */
export interface SystemMessage extends SystemEntity {
  msgTitle: string;
  msgContent?: string;
  msgType: string;
  msgTypeLabel?: string;
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverName?: string;
  isRead?: boolean;
  readTime?: string;
  display?: boolean;
  priority?: string;
  priorityLabel?: string;
  businessType?: string;
  businessTypeLabel?: string;
  businessId?: string;
}

/** 统一天气快照，写入由内部同步任务负责。 */
export interface SystemWeather {
  id: string;
  weatherDate: string;
  cityCode: string;
  cityName?: string;
  province?: string;
  weatherCondition?: string;
  tempLow?: number;
  tempHigh?: number;
  temperature?: number;
  humidity?: string;
  windDirection?: string;
  windPower?: string;
  weatherIcon?: string;
  aqi?: number;
  aqiLevel?: string;
  collectTime?: string;
}

/** 当前用户的平台设置；产品偏好必须放入独立命名空间。 */
export interface SystemUserSetting {
  language?: string;
  theme?: string;
  fontSize?: number;
  desktopNotification?: boolean;
  soundNotification?: boolean;
  emailNotification?: boolean;
  notificationFrequency?: string;
  autoSave?: boolean;
  loginProtection?: boolean;
  sessionTimeout?: number;
  extensions?: Record<string, unknown>;
}

export type SystemQuery = Readonly<Record<string, QueryValue>>;

export interface UserSummary extends SystemEntity {
  username: string;
  nickname?: string;
  realName?: string;
  email?: string;
  phone?: string;
  roleNames?: string[];
  postNames?: string[];
}

export interface UserDetail extends UserSummary {
  remark?: string;
  gender?: number;
  avatar?: string;
  userType?: "ADMIN" | "USER";
  roles?: Array<{ id: string; roleCode?: string; roleName?: string }>;
  posts?: Array<{
    id: string;
    postCode?: string;
    postName?: string;
    roleCode?: string;
    roleName?: string;
  }>;
}

export interface UserSavePayload {
  id?: string | undefined;
  username: string;
  password?: string | undefined;
  nickname?: string | undefined;
  realName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  gender?: number | undefined;
  avatar?: string | undefined;
  userType: "ADMIN" | "USER";
  roleCodes?: string[] | undefined;
  postCodes?: string[] | undefined;
  sortOrder: number;
  remark?: string | undefined;
}

/** 当前用户可见的部门身份。 */
export interface SystemDepartment extends SystemEntity {
  /** 上级部门标识。 */
  parentId?: string;
  /** 部门名称；平台接口返回当前层级名称。 */
  deptName: string;
}

export type SystemMenuType = "DIRECTORY" | "MENU" | "BUTTON";

export interface SystemMenu extends SystemEntity {
  parentId?: string;
  menuName: string;
  menuTitle?: string;
  menuType: SystemMenuType;
  typeLabel?: string;
  path?: string;
  component?: string;
  permission?: string;
  icon?: string;
  visible?: boolean;
  keepAlive?: boolean;
  isExternal?: boolean;
  sort?: number;
  remark?: string;
  children?: SystemMenu[];
}

export interface SystemMenuPayload {
  id?: string | undefined;
  remark?: string | undefined;
  sortOrder?: number | undefined;
  parentId?: string | undefined;
  menuName: string;
  menuTitle?: string | undefined;
  menuType: SystemMenuType;
  path?: string | undefined;
  component?: string | undefined;
  permission?: string | undefined;
  icon?: string | undefined;
  visible: boolean;
  keepAlive: boolean;
  isExternal: boolean;
  sort?: number | undefined;
}

export interface SystemDictionary extends SystemEntity {
  dictType: string;
  dictLabel: string;
  dictValue: string;
  remark?: string;
  itemCount?: number;
}

export interface SystemDictionaryItem extends SystemEntity {
  dictId: string;
  dictCode?: string;
  itemValue: string;
  itemLabel: string;
  itemStyle?: string;
  itemColor?: string;
  itemCssClass?: string;
  itemSelected?: boolean;
  remark?: string;
}

export type SystemLogKind = "login" | "operation" | "oss";

/** 平台审计日志的统一状态字段。 */
export interface SystemLogRecord extends SystemEntity {
  /** 机器可判定的执行状态。 */
  status: string;
  /** 用于界面展示的执行状态名称。 */
  statusLabel: string;
}

export interface RoleSummary extends SystemEntity {
  roleCode: string;
  roleName: string;
  sort?: number;
  defaultRegistrationRole?: boolean;
}

export interface RoleDetail extends RoleSummary {
  dataScope?: string | number;
  dataScopeLabel?: string;
  remark?: string;
}

export interface RoleSavePayload {
  id?: string;
  remark?: string;
  sortOrder: number;
  roleCode: string;
  roleName: string;
  dataScope: number;
  enabled: boolean;
  sort: number;
  defaultRegistrationRole: boolean;
  permissionIds?: string[];
}

export interface RoleQuery {
  roleName?: string | undefined;
  roleCode?: string | undefined;
  enabled?: boolean | undefined;
  pageNum: number;
  pageSize: number;
}

export type MenuTreeNode = SystemMenu;

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

function compactQuery(query: SystemQuery): Record<string, QueryValue> {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

/** platform-system 的类型安全浏览器客户端。 */
export class PlatformSystemClient {
  constructor(private readonly http: PlatformRequestClient) {}

  listEntities<T extends SystemEntity>(
    basePath: string,
    query: SystemQuery,
  ): Promise<SystemPage<T>> {
    return this.http.request<SystemPage<T>>(`${basePath}/list`, { query: compactQuery(query) });
  }

  getEntity<T extends SystemEntity>(basePath: string, id: string): Promise<T> {
    return this.http.request<T>(`${basePath}/${encodeId(id)}`);
  }

  createEntity(basePath: string, payload: Readonly<Record<string, unknown>>): Promise<string> {
    return this.http.request<string>(basePath, { method: "POST", body: payload });
  }

  updateEntity(
    basePath: string,
    id: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    return this.http.request<void>(`${basePath}/${encodeId(id)}`, { method: "PUT", body: payload });
  }

  updateEntityEnabled(basePath: string, id: string, enabled: boolean): Promise<void> {
    return this.http.request<void>(`${basePath}/${encodeId(id)}/enabled`, {
      method: "PUT",
      query: { enabled },
    });
  }

  deleteEntity(basePath: string, id: string): Promise<void> {
    return this.http.request<void>(`${basePath}/${encodeId(id)}`, { method: "DELETE" });
  }

  listOptions(path: string): Promise<SystemOption[]> {
    return this.http.request<SystemOption[]>(path);
  }

  listUsers(query: SystemQuery): Promise<SystemPage<UserSummary>> {
    return this.listEntities<UserSummary>("/system/user", query);
  }

  getUser(id: string): Promise<UserDetail> {
    return this.getEntity<UserDetail>("/system/user", id);
  }

  createUser(payload: UserSavePayload): Promise<string> {
    return this.http.request<string>("/system/user", { method: "POST", body: payload });
  }

  updateUser(id: string, payload: UserSavePayload): Promise<void> {
    return this.http.request<void>(`/system/user/${encodeId(id)}`, {
      method: "PUT",
      body: payload,
    });
  }

  updateUserEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/user", id, enabled);
  }

  deleteUser(id: string): Promise<void> {
    return this.deleteEntity("/system/user", id);
  }

  resetUserPassword(id: string): Promise<string> {
    return this.http.request<string>("/system/user/resetPassword", {
      method: "POST",
      query: { id },
    });
  }

  assignUserRoles(id: string, roleIds: string[], userType: "ADMIN" | "USER"): Promise<void> {
    return this.http.request<void>(`/system/user/${encodeId(id)}/roles`, {
      method: "PUT",
      body: { roleIds, userType },
    });
  }

  getUserRoleIds(id: string): Promise<string[]> {
    return this.http.request<string[]>(`/system/user/${encodeId(id)}/roles`);
  }

  /** 查询当前用户正在使用的末级部门。 */
  getCurrentDepartment(): Promise<SystemDepartment | null> {
    return this.http.request<SystemDepartment | null>("/system/dept/current");
  }

  getMenuTree(): Promise<SystemMenu[]> {
    return this.http.request<SystemMenu[]>("/system/menu/tree");
  }

  getUserMenus(): Promise<SystemMenu[]> {
    return this.http.request<SystemMenu[]>("/system/menu/user");
  }

  getMenu(id: string): Promise<SystemMenu> {
    return this.getEntity<SystemMenu>("/system/menu", id);
  }

  createMenu(payload: SystemMenuPayload): Promise<string> {
    return this.http.request<string>("/system/menu", { method: "POST", body: payload });
  }

  updateMenu(id: string, payload: SystemMenuPayload): Promise<void> {
    return this.http.request<void>(`/system/menu/${encodeId(id)}`, {
      method: "PUT",
      body: payload,
    });
  }

  updateMenuEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/menu", id, enabled);
  }

  deleteMenu(id: string): Promise<void> {
    return this.deleteEntity("/system/menu", id);
  }

  getRegionTree(code?: string): Promise<SystemRegion[]> {
    return code
      ? this.http.request<SystemRegion[]>("/system/region/tree", { query: { code } })
      : this.http.request<SystemRegion[]>("/system/region/tree");
  }

  getRegionByCode(code: string): Promise<SystemRegion> {
    return this.http.request<SystemRegion>("/system/region/code", { query: { code } });
  }

  getRegion(id: string): Promise<SystemRegion> {
    return this.getEntity<SystemRegion>("/system/region", id);
  }

  createRegion(payload: RegionSavePayload): Promise<string> {
    return this.http.request<string>("/system/region", { method: "POST", body: payload });
  }

  updateRegion(id: string, payload: RegionSavePayload): Promise<void> {
    return this.http.request<void>(`/system/region/${encodeId(id)}`, {
      method: "PUT",
      body: payload,
    });
  }

  updateRegionEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/region", id, enabled);
  }

  deleteRegion(id: string): Promise<void> {
    return this.deleteEntity("/system/region", id);
  }

  listImportTemplates(query: SystemQuery): Promise<SystemPage<SystemImportTemplate>> {
    return this.listEntities<SystemImportTemplate>("/system/import-template", query);
  }

  getImportTemplate(id: string): Promise<SystemImportTemplate> {
    return this.getEntity<SystemImportTemplate>("/system/import-template", id);
  }

  createImportTemplate(payload: ImportTemplateSavePayload): Promise<string> {
    return this.http.request<string>("/system/import-template", { method: "POST", body: payload });
  }

  updateImportTemplate(id: string, payload: ImportTemplateSavePayload): Promise<void> {
    return this.http.request<void>(`/system/import-template/${encodeId(id)}`, {
      method: "PUT",
      body: payload,
    });
  }

  updateImportTemplateEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/import-template", id, enabled);
  }

  deleteImportTemplate(id: string): Promise<void> {
    return this.deleteEntity("/system/import-template", id);
  }

  listImportMappings(query: SystemQuery): Promise<SystemPage<SystemImportMapping>> {
    return this.listEntities<SystemImportMapping>("/system/import-mapping", query);
  }

  getImportMapping(id: string): Promise<SystemImportMapping> {
    return this.getEntity<SystemImportMapping>("/system/import-mapping", id);
  }

  createImportMapping(payload: ImportMappingSavePayload): Promise<string> {
    return this.http.request<string>("/system/import-mapping", { method: "POST", body: payload });
  }

  updateImportMapping(id: string, payload: ImportMappingSavePayload): Promise<void> {
    return this.http.request<void>(`/system/import-mapping/${encodeId(id)}`, {
      method: "PUT",
      body: payload,
    });
  }

  updateImportMappingEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/import-mapping", id, enabled);
  }

  deleteImportMapping(id: string): Promise<void> {
    return this.deleteEntity("/system/import-mapping", id);
  }

  listMessages(query: SystemQuery): Promise<SystemPage<SystemMessage>> {
    return this.listEntities<SystemMessage>("/system/message", query);
  }

  getMessage(id: string): Promise<SystemMessage> {
    return this.getEntity<SystemMessage>("/system/message", id);
  }

  getUnreadMessageCount(): Promise<number> {
    return this.http.request<number>("/system/message/unreadCount");
  }

  listNotices(): Promise<SystemMessage[]> {
    return this.http.request<SystemMessage[]>("/system/message/notices");
  }

  markMessageRead(id: string): Promise<boolean> {
    return this.http.request<boolean>(`/system/message/${encodeId(id)}/read`, { method: "PUT" });
  }

  batchMarkMessagesRead(ids: string[]): Promise<boolean> {
    return this.http.request<boolean>("/system/message/batch/read", {
      method: "PUT",
      body: ids,
    });
  }

  setMessageDisplay(id: string, display: boolean): Promise<boolean> {
    return this.http.request<boolean>(`/system/message/${encodeId(id)}/display`, {
      method: "PUT",
      query: { isDisplay: display },
    });
  }

  getTodayWeather(cityCode: string): Promise<SystemWeather> {
    return this.http.request<SystemWeather>("/system/weather/today", { query: { cityCode } });
  }

  getWeatherForecast(cityCode: string, days = 7): Promise<SystemWeather[]> {
    return this.http.request<SystemWeather[]>("/system/weather/forecast", {
      query: { cityCode, days },
    });
  }

  getCurrentUserSetting(): Promise<SystemUserSetting | null> {
    return this.http.request<SystemUserSetting | null>("/system/setting/current");
  }

  updateCurrentUserSetting(payload: SystemUserSetting): Promise<SystemUserSetting> {
    return this.http.request<SystemUserSetting>("/system/setting/current", {
      method: "PUT",
      body: payload,
    });
  }

  listDictionaries(query: SystemQuery): Promise<SystemPage<SystemDictionary>> {
    return this.listEntities<SystemDictionary>("/system/dict", query);
  }

  getDictionary(id: string): Promise<SystemDictionary> {
    return this.getEntity<SystemDictionary>("/system/dict", id);
  }

  createDictionary(payload: Readonly<Record<string, unknown>>): Promise<string> {
    return this.createEntity("/system/dict", payload);
  }

  updateDictionary(id: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    return this.updateEntity("/system/dict", id, payload);
  }

  updateDictionaryEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/dict", id, enabled);
  }

  deleteDictionary(id: string): Promise<void> {
    return this.deleteEntity("/system/dict", id);
  }

  listDictionaryItems(query: SystemQuery): Promise<SystemPage<SystemDictionaryItem>> {
    return this.listEntities<SystemDictionaryItem>("/system/dictItem", query);
  }

  getDictionaryItem(id: string): Promise<SystemDictionaryItem> {
    return this.getEntity<SystemDictionaryItem>("/system/dictItem", id);
  }

  createDictionaryItem(payload: Readonly<Record<string, unknown>>): Promise<string> {
    return this.createEntity("/system/dictItem", payload);
  }

  updateDictionaryItem(id: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    return this.updateEntity("/system/dictItem", id, payload);
  }

  updateDictionaryItemEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/dictItem", id, enabled);
  }

  deleteDictionaryItem(id: string): Promise<void> {
    return this.deleteEntity("/system/dictItem", id);
  }

  setDefaultDictionaryItem(id: string): Promise<void> {
    return this.http.request<void>(`/system/dictItem/${encodeId(id)}/default`, { method: "PUT" });
  }

  listLogs<T extends SystemEntity>(
    kind: SystemLogKind,
    query: SystemQuery,
  ): Promise<SystemPage<T>> {
    return this.http.request<SystemPage<T>>(`/system/log/${kind}/list`, {
      query: compactQuery(query),
    });
  }

  getLog<T extends SystemEntity>(kind: SystemLogKind, id: string): Promise<T> {
    return this.http.request<T>(`/system/log/${kind}/${encodeId(id)}`);
  }

  clearLogs(kind: SystemLogKind): Promise<boolean> {
    return this.http.request<boolean>(`/system/log/${kind}/clear`, { method: "DELETE" });
  }

  listRoles(query: RoleQuery): Promise<SystemPage<RoleSummary>> {
    return this.listEntities<RoleSummary>("/system/role", { ...query });
  }

  getRole(id: string): Promise<RoleDetail> {
    return this.getEntity<RoleDetail>("/system/role", id);
  }

  createRole(payload: RoleSavePayload): Promise<string> {
    return this.http.request<string>("/system/role", { method: "POST", body: payload });
  }

  updateRole(id: string, payload: RoleSavePayload): Promise<void> {
    return this.http.request<void>(`/system/role/${encodeId(id)}`, {
      method: "PUT",
      body: payload,
    });
  }

  updateRoleEnabled(id: string, enabled: boolean): Promise<void> {
    return this.updateEntityEnabled("/system/role", id, enabled);
  }

  deleteRole(id: string): Promise<void> {
    return this.deleteEntity("/system/role", id);
  }

  getRolePermissionIds(id: string): Promise<string[]> {
    return this.http.request<string[]>(`/system/role/${encodeId(id)}/permissions`);
  }

  saveRolePermissionIds(id: string, permissionIds: string[]): Promise<boolean> {
    return this.http.request<boolean>(`/system/role/${encodeId(id)}/permissions`, {
      method: "PUT",
      body: { permissionIds },
    });
  }
}

/** 允许产品保留自身鉴权、加密和错误恢复传输层的系统管理客户端契约。 */
export type SystemClient = Pick<PlatformSystemClient, keyof PlatformSystemClient>;
