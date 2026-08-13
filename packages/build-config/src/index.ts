import { defineConfig } from "vite-plus";
import type { UserConfig } from "vite-plus";

/** 统一导出 Vite+ 应用配置入口，保持产品构建配置一致。 */
export const defineApplicationConfig = defineConfig;

/** Vite 库构建配置参数。 */
export interface LibraryConfigOptions {
  /** 软件包入口文件，默认为 `src/index.ts`。 */
  entry?: readonly string[];
  /** 不应打进产物的依赖包名。 */
  external?: readonly string[];
  /** 是否生成 TypeScript 声明文件，默认生成。 */
  declarations?: boolean;
  /** 仅对当前软件包生效的 Vite+ 测试配置。 */
  test?: UserConfig["test"];
}

/**
 * 创建 Rollup external 判断器，同时识别包本身及其子路径导入。
 *
 * @param packages 不应打包的依赖包名。
 * @returns 可直接交给 Rollup 的判断函数。
 */
export function createExternalMatcher(packages: readonly string[]): (id: string) => boolean {
  const uniquePackages = [...new Set(packages)];
  return (id) =>
    uniquePackages.some((packageName) => id === packageName || id.startsWith(`${packageName}/`));
}

/**
 * 创建统一的 ESM 软件包构建配置。
 *
 * @param options 入口、外部依赖及声明文件设置。
 * @returns 可供 `vite.config.ts` 直接导出的配置。
 */
export function createLibraryConfig(options: LibraryConfigOptions = {}) {
  return defineConfig({
    pack: {
      entry: [...(options.entry ?? ["src/index.ts"])],
      dts: options.declarations ?? true,
      format: ["esm"],
      sourcemap: true,
      deps: {
        neverBundle: [...(options.external ?? [])],
      },
    },
    lint: {
      options: { typeAware: true, typeCheck: true },
    },
    fmt: {},
    ...(options.test === undefined ? {} : { test: options.test }),
  });
}
