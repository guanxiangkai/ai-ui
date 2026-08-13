import "./tokens.css";
import "./management.css";

export { default as PlatformErrorState } from "./PlatformErrorState.vue";
export { default as PlatformAgent } from "./PlatformAgent.vue";
export { default as PlatformLogin } from "./PlatformLogin.vue";
export { default as PlatformScheduler } from "./PlatformScheduler.vue";
export { default as PlatformWatermark } from "./PlatformWatermark.vue";
export { default as PlatformSystemDictionary } from "./system/PlatformSystemDictionary.vue";
export { default as PlatformSystemEntity } from "./system/PlatformSystemEntity.vue";
export { default as PlatformSystemLog } from "./system/PlatformSystemLog.vue";
export { default as PlatformSystemImportTemplate } from "./system/PlatformSystemImportTemplate.vue";
export { default as PlatformSystemMenu } from "./system/PlatformSystemMenu.vue";
export { default as PlatformSystemMessage } from "./system/PlatformSystemMessage.vue";
export { default as PlatformSystemRegion } from "./system/PlatformSystemRegion.vue";
export { default as PlatformSystemRole } from "./system/PlatformSystemRole.vue";
export { default as PlatformSystemSetting } from "./system/PlatformSystemSetting.vue";
export { default as PlatformSystemUser } from "./system/PlatformSystemUser.vue";
export { default as PlatformSystemWeather } from "./system/PlatformSystemWeather.vue";
export {
  departmentEntityConfig,
  postEntityConfig,
  tenantEntityConfig,
} from "./system/entity-config.js";
export { fileLogConfig, loginLogConfig, operationLogConfig } from "./system/log-config.js";
export { useLatestRequest } from "./composables/useLatestRequest.js";
export { LatestRequestPolicy } from "./composables/latest-request-policy.js";
export type { RequestCommitPolicy, RequestToken } from "./composables/latest-request-policy.js";
export type {
  LatestRequestCallbacks,
  LatestRequestController,
} from "./composables/useLatestRequest.js";
export type {
  SystemEntityConfig,
  SystemFormField,
  SystemLogColumn,
  SystemLogConfig,
  SystemSearchField,
  SystemTableColumn,
  SystemViewProps,
} from "./system/system-types.js";
export type {
  PlatformErrorStateProps,
  PlatformAgentProps,
  PlatformAgentTab,
  PlatformLoginCredentials,
  PlatformLoginProps,
  PlatformSchedulerProps,
  PlatformSchedulerView,
  PlatformWatermarkConfig,
  PlatformWatermarkProps,
} from "./component-types.js";
export {
  createUserWatermarkText,
  getLeafDepartmentName,
  useUserWatermark,
} from "./watermark/user-watermark.js";
export type {
  UserWatermarkClient,
  UserWatermarkIdentity,
  UseUserWatermarkOptions,
} from "./watermark/user-watermark.js";
