import type { PlatformClient } from "@guanxiangkai/platform-client";
import { inject, type InjectionKey, type Plugin } from "vue";

/** 平台客户端的 Vue 注入键。 */
export const platformClientKey: InjectionKey<PlatformClient> = Symbol("platform-client");

/**
 * 创建向整个 Vue 应用提供平台客户端的插件。
 *
 * @param client 已绑定网关、Token 和租户来源的平台客户端。
 * @returns 可传给 `app.use` 的 Vue 插件。
 */
export function createPlatformPlugin(client: PlatformClient): Plugin {
  return {
    install(app) {
      app.provide(platformClientKey, client);
    },
  };
}

/**
 * 读取当前 Vue 应用的平台客户端。
 *
 * @returns 应用安装时提供的平台客户端。
 * @throws {Error} 未安装平台插件时抛出。
 */
export function usePlatformClient(): PlatformClient {
  const client = inject(platformClientKey);
  if (client === undefined) throw new Error("尚未安装 AI 平台 Vue 插件");
  return client;
}
