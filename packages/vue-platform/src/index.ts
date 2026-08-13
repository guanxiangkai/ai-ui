export { createPlatformPlugin, platformClientKey, usePlatformClient } from "./plugin.js";
export { createPermissionGuard, hasPermissions } from "./permission.js";
export type { PermissionGuardOptions, PermissionMode } from "./permission.js";
export { createPlatformSessionStore } from "./session.js";
export type { PlatformSessionStoreOptions } from "./session.js";
export {
  createBrowserSessionStorage,
  createBrowserSessionStorageWithCodec,
  createMemorySessionStorage,
  createMemorySessionStorageWithValue,
} from "./storage.js";
export type { PlatformSessionCodec, PlatformSessionStorage } from "./storage.js";
export { createWindowSessionTransport } from "./transport.js";
export type {
  PlatformPublicKeyEnvelopeStrategy,
  PlatformSessionTransportSecurity,
  PlatformWindowSessionTransport,
  PlatformWindowSessionTransportOptions,
} from "./transport.js";
