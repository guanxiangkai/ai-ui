import type { AuthSession } from "@guanxiangkai/platform-client";
import type { NavigationGuard, RouteLocationNormalized, RouteLocationRaw } from "vue-router";

/** 多权限匹配策略。 */
export type PermissionMode = "all" | "any";

declare module "vue-router" {
  interface RouteMeta {
    /** 无需认证即可访问。 */
    public?: boolean;
    /** 访问路由所需的平台权限编码。 */
    permissions?: readonly string[];
    /** 多权限匹配策略，默认为 all。 */
    permissionMode?: PermissionMode;
  }
}

/**
 * 判断权限集合是否满足要求。
 *
 * @param grantedPermissions 当前用户拥有的权限。
 * @param requiredPermissions 目标操作要求的权限。
 * @param mode 要求全部满足或任一满足。
 */
export function hasPermissions(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[],
  mode: PermissionMode = "all",
): boolean {
  if (requiredPermissions.length === 0) return true;
  const granted = new Set(grantedPermissions);
  return mode === "all"
    ? requiredPermissions.every((permission) => granted.has(permission))
    : requiredPermissions.some((permission) => granted.has(permission));
}

/** 权限路由守卫参数。 */
export interface PermissionGuardOptions {
  /** 获取当前认证会话。 */
  getSession: () => AuthSession | null;
  /** 未登录时决定跳转地址或取消导航。 */
  onUnauthenticated: (to: RouteLocationNormalized) => RouteLocationRaw | false;
  /** 已登录但权限不足时决定跳转地址或取消导航。 */
  onForbidden: (to: RouteLocationNormalized) => RouteLocationRaw | false;
}

/**
 * 创建产品无关的 Vue Router 权限守卫。
 *
 * @param options 会话来源和由产品定义的失败导航策略。
 */
export function createPermissionGuard(options: PermissionGuardOptions): NavigationGuard {
  return (to) => {
    if (to.meta.public === true) return true;

    const session = options.getSession();
    if (session === null) return options.onUnauthenticated(to);

    const requiredPermissions = to.meta.permissions ?? [];
    return hasPermissions(session.permissions, requiredPermissions, to.meta.permissionMode ?? "all")
      ? true
      : options.onForbidden(to);
  };
}
