import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { publint } from "publint";
import { formatMessage } from "publint/utils";

const expectedPackages = new Set([
  "@guanxiangkai/platform-client",
  "@guanxiangkai/vue-platform",
  "@guanxiangkai/ui",
  "@guanxiangkai/build-config",
]);
const expectedRegistry = "https://registry.npmjs.org/";
const expectedLicense = "Apache-2.0";
const semverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const packagesDirectory = resolve("packages");
const entries = await readdir(packagesDirectory, { withFileTypes: true });
const failures = [];

for (const entry of entries) {
  if (!entry.isDirectory()) continue;

  const manifestPath = resolve(packagesDirectory, entry.name, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!expectedPackages.delete(manifest.name)) {
    failures.push(`${entry.name}: 软件包名称不在允许清单中`);
  }
  if (manifest.private === true) {
    failures.push(`${manifest.name}: 可发布软件包不能标记为 private`);
  }
  if (typeof manifest.version !== "string" || !semverPattern.test(manifest.version)) {
    failures.push(`${manifest.name}: 版本必须符合语义化版本规范`);
  }
  if (manifest.publishConfig?.registry !== expectedRegistry) {
    failures.push(`${manifest.name}: 发布注册地址不正确`);
  }
  if (manifest.publishConfig?.access !== "public") {
    failures.push(`${manifest.name}: 开源 npm 软件包的 access 必须为 public`);
  }
  if (manifest.license !== expectedLicense) {
    failures.push(`${manifest.name}: 软件包许可证必须为 ${expectedLicense}`);
  }
  if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
    failures.push(`${manifest.name}: files 必须只显式纳入 dist 等发布文件`);
  }

  // 由第三方校验实际打包后的 exports、类型声明和模块格式，避免只验证 manifest 而漏掉缺失入口。
  const { messages, pkg } = await publint({
    pkgDir: resolve(packagesDirectory, entry.name),
    pack: "pnpm",
    strict: true,
    level: "error",
  });
  for (const message of messages) {
    failures.push(`${manifest.name}: ${formatMessage(message, pkg)}`);
  }
}

for (const missingPackage of expectedPackages) {
  failures.push(`${missingPackage}: 缺少软件包目录`);
}

if (failures.length > 0) {
  throw new Error(`发布元数据检查失败：\n- ${failures.join("\n- ")}`);
}

console.log("四个软件包的公开元数据、实际打包入口、类型声明与模块格式检查通过。");
