import type { SystemViewProps } from "./system-types.js";
import { hasPlatformPermission } from "@guanxiangkai/platform-client";

export function hasSystemPermission(props: SystemViewProps, permission: string): boolean {
  return hasPlatformPermission(props.permissions ?? [], permission, props.superAdmin);
}

export function systemErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}
