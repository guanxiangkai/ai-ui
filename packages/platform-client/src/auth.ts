import type { PlatformRequestClient } from "./types.js";
import { digestPassword } from "./password.js";

/** 平台登录请求。 */
export interface LoginRequest {
  /** 登录账号。 */
  username: string;
  /** 用户刚输入的登录密码，只在本地计算摘要。 */
  password: string;
  /** 可选验证码。 */
  captcha?: string;
  /** 可选验证码会话键。 */
  captchaKey?: string;
}

/** 平台认证会话。 */
export interface AuthSession {
  /** API 访问令牌。 */
  accessToken: string;
  /** 刷新令牌。 */
  refreshToken: string;
  /** 令牌类型，通常为 Bearer。 */
  tokenType: string;
  /** 访问令牌有效时长，单位秒。 */
  expiresIn: number;
  /** 客户端记录的访问令牌绝对过期时间，单位为 Unix 毫秒。 */
  expiresAtMs?: number;
  /** 用户唯一标识。 */
  userId: string | number;
  /** 登录账号。 */
  username: string;
  /** 展示名称。 */
  name: string;
  /** 用户头像地址。 */
  avatar?: string | null;
  /** 用户类型。 */
  userType?: string | number;
  /** 是否为超级管理员。 */
  superAdmin: boolean;
  /** 当前角色编码。 */
  roleCodes: readonly string[];
  /** 当前岗位编码。 */
  postCodes: readonly string[];
  /** 当前权限编码。 */
  permissions: readonly string[];
  /** 主部门标识。 */
  deptId?: string | number | null;
  /** 可访问部门标识。 */
  deptIds: readonly (string | number)[];
}

/** 平台认证端点覆盖配置。 */
export interface AuthEndpointOptions {
  /** 登录端点。 */
  login?: string;
  /** 登出端点。 */
  logout?: string;
  /** 刷新令牌端点。 */
  refresh?: string;
}

/** 产品页面依赖的认证客户端契约。 */
export interface AuthClient {
  /** 使用账号密码创建会话。 */
  login(request: LoginRequest): Promise<AuthSession>;
  /**
   * 注销指定访问令牌；省略时由底层客户端按当前令牌提供器解析。
   *
   * @param accessToken 需要注销的访问令牌。
   */
  logout(accessToken?: string): Promise<void>;
  /** 使用刷新令牌换取新会话。 */
  refresh(refreshToken: string): Promise<AuthSession>;
}

/** 判断单个权限表达式是否精确或按冒号分段通配匹配。 */
export function matchesPlatformPermission(owned: string, required: string): boolean {
  if (owned === "*" || owned === required) return true;
  const ownedSegments = owned.split(":");
  const requiredSegments = required.split(":");
  if (ownedSegments.length > requiredSegments.length) return false;
  return ownedSegments.every(
    (segment, index) => segment === "*" || segment === requiredSegments[index],
  );
}

/** 判断权限集合是否允许访问指定平台能力。 */
export function hasPlatformPermission(
  permissions: readonly string[],
  required: string,
  superAdmin = false,
): boolean {
  return superAdmin || permissions.some((owned) => matchesPlatformPermission(owned, required));
}

/** 平台认证 API。 */
export class PlatformAuthClient implements AuthClient {
  private readonly endpoints: Required<AuthEndpointOptions>;

  /**
   * 创建认证 API。
   *
   * @param http 已配置租户和网关的 HTTP 客户端。
   * @param endpoints 可选端点覆盖。
   */
  constructor(
    private readonly http: PlatformRequestClient,
    endpoints: AuthEndpointOptions = {},
  ) {
    this.endpoints = {
      login: endpoints.login ?? "/auth/login",
      logout: endpoints.logout ?? "/auth/logout",
      refresh: endpoints.refresh ?? "/auth/refresh",
    };
  }

  /** 使用账号密码创建会话。 */
  async login(request: LoginRequest): Promise<AuthSession> {
    const passwordDigest = await digestPassword(request.password);
    const loginRequest = {
      username: request.username,
      ...(request.captcha === undefined ? {} : { captcha: request.captcha }),
      ...(request.captchaKey === undefined ? {} : { captchaKey: request.captchaKey }),
    };

    return this.http.request<AuthSession>(this.endpoints.login, {
      method: "POST",
      body: { ...loginRequest, passwordDigest },
      accessToken: null,
      retryUnauthorized: false,
    });
  }

  /** 注销指定访问令牌；省略时使用底层客户端当前令牌。 */
  logout(accessToken?: string): Promise<void> {
    return this.http.request<void>(this.endpoints.logout, {
      method: "POST",
      ...(accessToken === undefined ? {} : { accessToken }),
      retryUnauthorized: false,
    });
  }

  /** 使用刷新令牌换取新会话。 */
  refresh(refreshToken: string): Promise<AuthSession> {
    return this.http.request<AuthSession>(this.endpoints.refresh, {
      method: "POST",
      body: { refreshToken },
      accessToken: null,
      retryUnauthorized: false,
    });
  }
}
