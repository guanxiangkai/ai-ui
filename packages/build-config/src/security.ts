import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite-plus";

import {
  artifactManifestName,
  inspectArtifact,
  signApplicationArtifact,
  validateArtifactDirectory,
} from "./artifact.js";
import type { ArtifactSigningOptions } from "./artifact.js";

/** 仅作用于最终业务应用的安全构建选项；省略插件时保持原有构建行为。 */
export interface ApplicationSecurityOptions {
  /** 总开关，默认开启；关闭后不改变构建，不获取私钥。 */
  enabled?: boolean;
  /** 混淆含自有模块的 JS chunk，默认关闭；混合 chunk 会整体处理。 */
  obfuscate?: boolean;
  /** 构建完成时签名；省略或 false 表示不签名。私钥仅在成功输出后获取。 */
  signing?: false | Omit<ArtifactSigningOptions, "directory">;
}

/**
 * 创建业务应用构建加固插件，放在业务插件列表末尾。
 * 启用时禁用 Source Map；仅支持一次性、单输出、写入磁盘的客户端应用构建。
 * 混淆用于提高逆向成本，不是加密；部署端必须独立验签后再发布。
 */
export function applicationSecurity(options: ApplicationSecurityOptions = {}): Plugin {
  let config: ResolvedConfig;
  let directory: string;
  let written = false;
  let failed = false;
  const enabled = options.enabled !== false;
  return {
    name: "guanxiangkai:application-security",
    apply: "build",
    enforce: "post",
    config() {
      if (!enabled) return;
      return { build: { sourcemap: false }, css: { devSourcemap: false } };
    },
    configResolved(resolved) {
      if (!enabled) return;
      config = resolved;
      const environments = Object.keys(config.environments);
      const build = config.environments.client?.build;
      if (
        !build ||
        build.lib ||
        build.ssr ||
        build.watch ||
        build.write === false ||
        Array.isArray(build.rolldownOptions.output) ||
        environments.length !== 1 ||
        environments[0] !== "client"
      ) {
        throw new Error("安全构建仅支持一次性、单输出、写入磁盘的客户端应用");
      }
      const output = build.rolldownOptions.output;
      if (output && (output.dir !== undefined || output.file !== undefined || output.sourcemap)) {
        throw new Error("安全构建必须使用 build.outDir，且不能覆盖输出源码映射选项");
      }
      if (build.sourcemap || config.css.devSourcemap)
        throw new Error("安全构建禁止启用 Source Map");
      directory = resolve(config.root, build.outDir);
      const path = relative(config.root, directory);
      if (!path || path.startsWith("..") || isAbsolute(path))
        throw new Error("安全构建的 outDir 必须位于应用根目录内部的独立子目录");
      if (build.emptyOutDir === false) throw new Error("安全构建不能关闭 emptyOutDir");
    },
    async buildStart() {
      if (!enabled) return;
      written = false;
      failed = false;
      await validateArtifactDirectory(directory, true);
      await rm(join(directory, artifactManifestName), { force: true });
    },
    buildEnd(error) {
      if (error) failed = true;
    },
    renderError() {
      failed = true;
    },
    renderChunk: {
      order: "post",
      async handler(code, chunk) {
        if (!enabled || !options.obfuscate) return;
        const hasApplicationCode = chunk.moduleIds.some(
          (id) => !id.startsWith("\0") && !id.replaceAll("\\", "/").includes("/node_modules/"),
        );
        if (!hasApplicationCode) return;
        const { default: obfuscator } = await import("javascript-obfuscator");
        const prefix = createHash("sha256").update(chunk.name).digest("hex").slice(0, 8);
        return {
          code: obfuscator
            .obfuscate(code, {
              target: "browser-no-eval",
              compact: true,
              seed: 1,
              identifiersPrefix: `a${prefix}`,
              renameGlobals: false,
              renameProperties: false,
              controlFlowFlattening: false,
              deadCodeInjection: false,
              debugProtection: false,
              selfDefending: false,
              disableConsoleOutput: false,
              sourceMap: false,
              stringArray: true,
              stringArrayEncoding: [],
              stringArrayThreshold: 0.5,
              // Vite/Rolldown 尚未替换的资源与 chunk hash 占位符必须保持字面值。
              reservedStrings: ["__VITE_", "!~\\{", "__ROLLUP_"],
            })
            .getObfuscatedCode(),
          map: null,
        };
      },
    },
    writeBundle() {
      written = true;
    },
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        if (!enabled || !written || failed) return;
        if (options.signing) {
          await signApplicationArtifact({ ...options.signing, directory });
        } else {
          await inspectArtifact(directory);
        }
      },
    },
  };
}
