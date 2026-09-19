import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite-plus";
import type { Plugin, UserConfig } from "vite-plus";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationSecurity } from "../src/index.js";
import { verifyApplicationArtifact } from "../src/artifact.js";
import type { ApplicationSecurityOptions } from "../src/index.js";

const directories: string[] = [];
const identity = { application: "fixture-app", release: "fixture-release" };
const keys = generateKeyPairSync("ed25519");

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
  Reflect.deleteProperty(globalThis, "artifactFixture");
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "application-security-"));
  directories.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
  await writeFile(
    join(root, "main.js"),
    `import badge from './badge.svg';
import './style.css';
globalThis.artifactFixture = { badge, load: async () => (await import('./lazy.js')).message() };`,
  );
  await writeFile(
    join(root, "lazy.js"),
    `export const message = () => 'application-protected-result';`,
  );
  await writeFile(join(root, "style.css"), "body { color: blue; }");
  await writeFile(join(root, "badge.svg"), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await mkdir(join(root, "public"));
  await writeFile(join(root, "public/robots.txt"), "User-agent: *");
  return root;
}

function buildFixture(
  root: string,
  security: ApplicationSecurityOptions,
  extra: UserConfig = {},
  plugins: Plugin[] = [],
) {
  return build({
    configFile: false,
    root,
    logLevel: "silent",
    ...extra,
    plugins: [...plugins, applicationSecurity(security)],
    build: { modulePreload: false, assetsInlineLimit: 0, ...extra.build },
  });
}

describe("业务应用真实构建", () => {
  it("混淆后动态导入、CSS、资源引用及完整制品验签正常", async () => {
    const root = await fixture();
    await buildFixture(root, {
      obfuscate: true,
      signing: { ...identity, privateKey: () => keys.privateKey },
    });
    const directory = join(root, "dist");
    await verifyApplicationArtifact({ ...identity, directory, publicKey: keys.publicKey });
    const html = await readFile(join(directory, "index.html"), "utf8");
    const entry = /src="([^"]+\.js)"/u.exec(html)?.[1];
    expect(entry).toBeDefined();
    if (!entry) throw new Error("未生成脚本入口");
    const entryPath = join(directory, entry);
    const code = await readFile(entryPath, "utf8");
    expect(code).not.toMatch(/sourceMappingURL|__VITE_|!~\{/u);
    await import(/* @vite-ignore */ pathToFileURL(entryPath).href);
    const result: unknown = Reflect.get(globalThis, "artifactFixture");
    expect(result).toMatchObject({
      load: expect.any(Function),
      badge: expect.stringMatching(/\.svg$/u),
    });
    if (!result || typeof result !== "object") throw new Error("业务入口未执行");
    const load: unknown = Reflect.get(result, "load");
    if (typeof load !== "function") throw new Error("动态入口不存在");
    expect(await load()).toBe("application-protected-result");
    const badge: unknown = Reflect.get(result, "badge");
    if (typeof badge !== "string") throw new Error("资源路径不存在");
    expect(await readFile(join(directory, badge), "utf8")).toContain("<svg");
    expect(await readdir(join(directory, "assets"))).toEqual(
      expect.arrayContaining([expect.stringMatching(/\.css$/u)]),
    );
  });

  it("关闭功能时保留 Source Map 且不访问签名私钥", async () => {
    const root = await fixture();
    const privateKey = vi.fn(() => keys.privateKey);
    await buildFixture(
      root,
      { enabled: false, obfuscate: true, signing: { ...identity, privateKey } },
      { build: { sourcemap: true } },
    );
    expect(privateKey).not.toHaveBeenCalled();
    expect(await readdir(join(root, "dist/assets"))).toEqual(
      expect.arrayContaining([expect.stringMatching(/\.map$/u)]),
    );
    await expect(readFile(join(root, "dist/application-artifact.json"))).rejects.toThrow();
  });

  it("签名覆盖 public 及前序 closeBundle 写入，之后的修改在部署验签时拒绝", async () => {
    const root = await fixture();
    const plugin: Plugin = {
      name: "postprocess",
      async closeBundle() {
        await writeFile(join(root, "dist/postprocess.txt"), "final");
      },
    };
    await buildFixture(root, { signing: { ...identity, privateKey: () => keys.privateKey } }, {}, [
      plugin,
    ]);
    const options = { ...identity, directory: join(root, "dist"), publicKey: keys.publicKey };
    await verifyApplicationArtifact(options);
    await writeFile(join(root, "dist/robots.txt"), "changed");
    await expect(verifyApplicationArtifact(options)).rejects.toThrow("文件清单不匹配");
  });

  it("拒绝 public 偷带映射文件", async () => {
    const root = await fixture();
    await writeFile(join(root, "public/leak.js.map"), "{}");
    await expect(
      buildFixture(root, { signing: { ...identity, privateKey: () => keys.privateKey } }),
    ).rejects.toThrow("Source Map");
    await expect(readFile(join(root, "dist/application-artifact.json"))).rejects.toThrow();
  });

  it("失败构建移除旧签名且不访问私钥", async () => {
    const root = await fixture();
    await mkdir(join(root, "dist"));
    await writeFile(join(root, "dist/application-artifact.json"), "stale");
    await writeFile(join(root, "main.js"), "invalid javascript !");
    const privateKey = vi.fn(() => keys.privateKey);
    await expect(buildFixture(root, { signing: { ...identity, privateKey } })).rejects.toThrow();
    expect(privateKey).not.toHaveBeenCalled();
    await expect(readFile(join(root, "dist/application-artifact.json"))).rejects.toThrow();
  });

  it.each([
    { write: false },
    { ssr: true },
    { emptyOutDir: false },
    { rolldownOptions: { output: [{}, {}] } },
    { rolldownOptions: { output: { dir: "elsewhere" } } },
  ])("拒绝未支持的构建配置 %j", async (config) => {
    const root = await fixture();
    await expect(buildFixture(root, {}, { build: config })).rejects.toThrow();
  });

  it("拒绝多环境构建", async () => {
    const root = await fixture();
    await expect(buildFixture(root, {}, { environments: { another: {} } })).rejects.toThrow(
      "单输出",
    );
  });

  it("签名真实客户端环境的输出目录", async () => {
    const root = await fixture();
    await buildFixture(
      root,
      { signing: { ...identity, privateKey: () => keys.privateKey } },
      { environments: { client: { build: { outDir: "client-dist" } } } },
    );
    await verifyApplicationArtifact({
      ...identity,
      directory: join(root, "client-dist"),
      publicKey: keys.publicKey,
    });
  });

  it.each([
    { write: false },
    { sourcemap: true },
    { outDir: "../outside" },
    { rolldownOptions: { output: [{}, {}] } },
  ])("拒绝客户端环境绕过约束 %j", async (build) => {
    const root = await fixture();
    await expect(buildFixture(root, {}, { environments: { client: { build } } })).rejects.toThrow();
  });

  it("默认 preload 和动态 CSS 构建不残留占位符", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "lazy.js"),
      "import './lazy.css'; export const message = () => 'lazy';",
    );
    await writeFile(join(root, "lazy.css"), ".lazy { color: red; }");
    await buildFixture(
      root,
      { obfuscate: true, signing: { ...identity, privateKey: () => keys.privateKey } },
      { build: { modulePreload: true } },
    );
    const directory = join(root, "dist");
    await verifyApplicationArtifact({ ...identity, directory, publicKey: keys.publicKey });
    for (const name of await readdir(join(directory, "assets"))) {
      if (name.endsWith(".js"))
        expect(await readFile(join(directory, "assets", name), "utf8")).not.toMatch(
          /__VITE_|!~\{/u,
        );
    }
  });

  it.each(["dist", "parent/dist"])("拒绝目录链符号链接且不删除外部签名 %s", async (outDir) => {
    const root = await fixture();
    const outside = await fixture();
    await mkdir(join(outside, "dist"));
    const destination = outDir === "dist" ? outside : join(outside, "dist");
    await writeFile(join(destination, "application-artifact.json"), "untouched");
    await symlink(outside, join(root, outDir === "dist" ? "dist" : "parent"));
    await expect(buildFixture(root, {}, { build: { outDir } })).rejects.toThrow("符号链接");
    expect(await readFile(join(destination, "application-artifact.json"), "utf8")).toBe(
      "untouched",
    );
  });

  it("写产物阶段失败不获取私钥", async () => {
    const root = await fixture();
    const privateKey = vi.fn(() => keys.privateKey);
    const plugin: Plugin = {
      name: "fail-write",
      writeBundle() {
        throw new Error("write failed");
      },
    };
    await expect(
      buildFixture(root, { signing: { ...identity, privateKey } }, {}, [plugin]),
    ).rejects.toThrow("write failed");
    expect(privateKey).not.toHaveBeenCalled();
    await expect(readFile(join(root, "dist/application-artifact.json"))).rejects.toThrow();
  });
});
