import { createHash, KeyObject, sign, verify } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";

/** 制品身份，必须来自构建或部署系统的可信配置。 */
export interface ArtifactIdentity {
  /** 业务应用唯一标识。 */
  application: string;
  /** 发布版本或提交标识；验签时必须指定预期值，防止旧版本重放。 */
  release: string;
}

/** 制品签名参数；调用期间目录必须由当前任务独占。 */
export interface ArtifactSigningOptions extends ArtifactIdentity {
  /** 最终制品目录；签名之后不得再修改其中的文件。 */
  directory: string;
  /** 延迟从构建环境的 Secret 获取 Ed25519 私钥，不得从浏览器环境变量读取。 */
  privateKey: () => KeyObject | Promise<KeyObject>;
}

/** 部署前制品验签参数。 */
export interface ArtifactVerificationOptions extends ArtifactIdentity {
  /** 独占、静止的待部署目录；验签后应原子切换且不再写入。 */
  directory: string;
  /** 部署系统独立固定的 Ed25519 公钥，不能从待验制品中获取。 */
  publicKey: KeyObject;
}

interface ArtifactFile {
  path: string;
  size: number;
  sha256: string;
}

interface ArtifactManifest extends ArtifactIdentity {
  schema: typeof schema;
  files: ArtifactFile[];
}

/** 签名清单固定文件名，仅该文件自身不进入摘要集合。 */
export const artifactManifestName = "application-artifact.json";
const schema = "@guanxiangkai/application-artifact/v1";
const domain = `${schema}\n`;
const readBufferSize = 64 * 1024;

/** 以有限状态匹配源码映射引用，保留跨读取块的关键字和任意长度空白。 */
function createSourceMapDetector(): (text: string) => boolean {
  const keyword = "sourceMappingURL";
  let matched = 0;
  return (text) => {
    for (const character of text) {
      if (matched === keyword.length) {
        if (character === "=") return true;
        if (/\s/u.test(character)) continue;
      }
      matched = character === keyword[matched] ? matched + 1 : character === keyword[0] ? 1 : 0;
    }
    return false;
  };
}

function validateIdentity(identity: ArtifactIdentity): void {
  if (
    typeof identity.application !== "string" ||
    !identity.application.trim() ||
    typeof identity.release !== "string" ||
    !identity.release.trim()
  )
    throw new Error("制品 application 和 release 必须是非空字符串");
}

function validateKey(key: KeyObject, type: "private" | "public"): void {
  if (!(key instanceof KeyObject) || key.type !== type || key.asymmetricKeyType !== "ed25519") {
    throw new Error(`制品签名必须使用 Ed25519 ${type === "private" ? "私钥" : "公钥"}`);
  }
}

/** 在读取或删除签名之前拒绝目录链上的符号链接；仅构建前允许目录尚未创建。 */
export async function validateArtifactDirectory(
  directory: string,
  allowMissing = false,
): Promise<void> {
  const ancestors: string[] = [];
  let current = resolve(directory);
  for (;;) {
    ancestors.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const path of ancestors.reverse()) {
    try {
      if (!(await lstat(path)).isDirectory())
        throw new Error("制品目录链只能包含实际目录，不能包含符号链接");
    } catch (error) {
      if (allowMissing && isRecord(error) && error.code === "ENOENT") return;
      throw error;
    }
  }
}

/** 检查完整目录并生成稳定清单；不跟随符号链接，不允许特殊文件。 */
export async function inspectArtifact(directory: string): Promise<ArtifactFile[]> {
  const root = resolve(directory);
  await validateArtifactDirectory(root);
  const files: ArtifactFile[] = [];
  async function visit(relative: string): Promise<void> {
    const entries = await readdir(join(root, relative), { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.name.includes("\\")) throw new Error("制品路径不能包含反斜杠");
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        if (path === artifactManifestName) continue;
        if (/\.map$/iu.test(path)) throw new Error(`安全制品不能包含 Source Map：${path}`);
        const file = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const before = await file.stat();
          if (!before.isFile()) throw new Error(`制品只能包含普通文件：${path}`);
          const hash = createHash("sha256");
          const buffer = Buffer.allocUnsafe(readBufferSize);
          const decoder = new StringDecoder("utf8");
          const detectsSourceMap = /\.(?:[cm]?js|css)$/iu.test(path)
            ? createSourceMapDetector()
            : undefined;
          let size = 0;
          for (;;) {
            const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
            if (bytesRead === 0) break;
            const content = buffer.subarray(0, bytesRead);
            hash.update(content);
            size += bytesRead;
            if (detectsSourceMap?.(decoder.write(content))) {
              throw new Error(`安全制品不能包含源码映射引用：${path}`);
            }
          }
          if (detectsSourceMap?.(decoder.end())) {
            throw new Error(`安全制品不能包含源码映射引用：${path}`);
          }
          const after = await file.stat();
          if (
            before.size !== after.size ||
            size !== after.size ||
            before.mtimeMs !== after.mtimeMs ||
            before.ctimeMs !== after.ctimeMs
          ) {
            throw new Error("签名或验签期间制品被修改");
          }
          files.push({
            path,
            size,
            sha256: hash.digest("hex"),
          });
        } finally {
          await file.close();
        }
      } else {
        throw new Error(`制品不能包含符号链接或特殊文件：${path}`);
      }
    }
  }
  await visit("");
  if (!files.length) throw new Error("不能签名或验签空制品");
  return files;
}

/**
 * 对最终目录的全部普通文件生成 SHA-256 清单并以 Ed25519 签名。
 * 适用于构建后的额外处理完成时；失败会移除旧签名，私钥不会写入制品。
 */
export async function signApplicationArtifact(options: ArtifactSigningOptions): Promise<void> {
  const directory = resolve(options.directory);
  await validateArtifactDirectory(directory);
  const destination = join(directory, artifactManifestName);
  await rm(destination, { force: true });
  validateIdentity(options);
  const key = await options.privateKey();
  validateKey(key, "private");
  const manifest: ArtifactManifest = {
    schema,
    application: options.application,
    release: options.release,
    files: await inspectArtifact(directory),
  };
  const signature = sign(null, Buffer.from(domain + JSON.stringify(manifest)), key).toString(
    "base64",
  );
  // 独占创建并原子替换，避免读取者看到写入一半的签名清单。
  const temporary = join(directory, `${artifactManifestName}.tmp`);
  const file = await open(temporary, "wx");
  try {
    await file.writeFile(`${JSON.stringify({ manifest, signature }, null, 2)}\n`);
    await file.close();
    await rename(temporary, destination);
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 使用部署系统固定的公钥校验签名、应用、版本及完整文件集合。
 * 文件增删改、错误身份、错误密钥或源码映射均抛错；不信任制品携带的公钥。
 */
export async function verifyApplicationArtifact(
  options: ArtifactVerificationOptions,
): Promise<void> {
  validateIdentity(options);
  validateKey(options.publicKey, "public");
  const directory = resolve(options.directory);
  await validateArtifactDirectory(directory);
  const manifestPath = join(directory, artifactManifestName);
  if (!(await lstat(manifestPath)).isFile()) throw new Error("签名清单必须是普通文件");
  const file = await open(manifestPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let envelope: unknown;
  try {
    envelope = JSON.parse(await file.readFile("utf8"));
  } finally {
    await file.close();
  }
  if (
    !isRecord(envelope) ||
    !isRecord(envelope.manifest) ||
    typeof envelope.signature !== "string"
  ) {
    throw new Error("制品签名清单格式错误");
  }
  const manifest = envelope.manifest;
  if (manifest.schema !== schema || !/^[A-Za-z0-9+/]{86}==$/u.test(envelope.signature)) {
    throw new Error("制品签名格式或版本不受支持");
  }
  if (
    !verify(
      null,
      Buffer.from(domain + JSON.stringify(manifest)),
      options.publicKey,
      Buffer.from(envelope.signature, "base64"),
    )
  ) {
    throw new Error("制品签名验证失败");
  }
  if (manifest.application !== options.application || manifest.release !== options.release) {
    throw new Error("制品应用或发布版本与预期不符");
  }
  // 不用不可信清单中的路径读取磁盘；直接比较重新扫描得到的规范文件集合。
  const expected: ArtifactManifest = {
    schema,
    application: options.application,
    release: options.release,
    files: await inspectArtifact(directory),
  };
  if (JSON.stringify(manifest) !== JSON.stringify(expected))
    throw new Error("制品文件清单不匹配，存在新增、缺失或被修改的文件");
}
