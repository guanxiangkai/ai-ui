import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectArtifact,
  signApplicationArtifact,
  verifyApplicationArtifact,
} from "../src/artifact.js";

const directories: string[] = [];
const identity = { application: "fixture-app", release: "commit-123" };
// 一次性测试密钥只存在于进程内，不是部署凭据。
const keys = generateKeyPairSync("ed25519");

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "artifact-test-"));
  directories.push(directory);
  await mkdir(join(directory, "assets"));
  await writeFile(
    join(directory, "index.html"),
    '<script type="module" src="./assets/main.js"></script>',
  );
  await writeFile(join(directory, "assets/main.js"), 'console.log("fixture");');
  await signApplicationArtifact({ ...identity, directory, privateKey: () => keys.privateKey });
  return { ...identity, directory, publicKey: keys.publicKey };
}

describe("业务制品签名", () => {
  it("分块读取二进制文件后摘要与一次性摘要一致", async () => {
    const options = await fixture();
    const content = Buffer.alloc(64 * 1024 * 3 + 29, 0xab);
    await writeFile(join(options.directory, "module.wasm"), content);
    const files = await inspectArtifact(options.directory);
    expect(files.find((file) => file.path === "module.wasm")).toEqual({
      path: "module.wasm",
      size: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  });

  it.each([
    `${"x".repeat(64 * 1024 - 5)}sourceMappingURL=inline`,
    `${"x".repeat(64 * 1024 - 17)}sourceMappingURL\u3000=inline`,
    `sourceMappingURL${" ".repeat(64 * 1024 * 3)}=inline`,
  ])("拒绝跨块关键字、UTF-8空白和长空白映射引用 %#", async (content) => {
    const options = await fixture();
    await writeFile(join(options.directory, "split.js"), content);
    await expect(
      signApplicationArtifact({ ...options, privateKey: () => keys.privateKey }),
    ).rejects.toThrow("源码映射引用");
  });

  it("覆盖全部文件且签名确定，不交付密钥", async () => {
    const options = await fixture();
    await verifyApplicationArtifact(options);
    const first = await readFile(join(options.directory, "application-artifact.json"), "utf8");
    expect(first).toContain("assets/main.js");
    expect(first).not.toContain("KEY");
    await signApplicationArtifact({ ...options, privateKey: () => keys.privateKey });
    expect(await readFile(join(options.directory, "application-artifact.json"), "utf8")).toBe(
      first,
    );
  });

  it.each(["modify", "add", "delete"])("拒绝文件 %s", async (mutation) => {
    const options = await fixture();
    if (mutation === "modify")
      await writeFile(join(options.directory, "assets/main.js"), "tampered");
    if (mutation === "add") await writeFile(join(options.directory, "extra.js"), "injected");
    if (mutation === "delete") await rm(join(options.directory, "index.html"));
    await expect(verifyApplicationArtifact(options)).rejects.toThrow("文件清单不匹配");
  });

  it("拒绝换钥、跨应用和旧版本重放", async () => {
    const options = await fixture();
    await expect(
      verifyApplicationArtifact({
        ...options,
        publicKey: generateKeyPairSync("ed25519").publicKey,
      }),
    ).rejects.toThrow("签名验证失败");
    await expect(
      verifyApplicationArtifact({ ...options, application: "another-app" }),
    ).rejects.toThrow("与预期不符");
    await expect(verifyApplicationArtifact({ ...options, release: "commit-124" })).rejects.toThrow(
      "与预期不符",
    );
  });

  it("拒绝篡改和伪造清单，不能通过清单路径访问目录外文件", async () => {
    const options = await fixture();
    const path = join(options.directory, "application-artifact.json");
    const original = await readFile(path, "utf8");
    await writeFile(path, original.replace("assets/main.js", "../../outside.js"));
    await expect(verifyApplicationArtifact(options)).rejects.toThrow("签名验证失败");
    await writeFile(path, "{}");
    await expect(verifyApplicationArtifact(options)).rejects.toThrow("格式错误");
  });

  it.each(["file", "directory", "manifest", "root"])("拒绝 %s 符号链接", async (kind) => {
    const options = await fixture();
    if (kind === "file")
      await symlink(join(options.directory, "index.html"), join(options.directory, "link.html"));
    if (kind === "directory")
      await symlink(join(options.directory, "assets"), join(options.directory, "linked-assets"));
    if (kind === "manifest") {
      const path = join(options.directory, "application-artifact.json");
      await rm(path);
      await symlink(join(options.directory, "index.html"), path);
    }
    if (kind === "root") {
      const path = `${options.directory}-link`;
      directories.push(path);
      await symlink(options.directory, path);
      options.directory = path;
    }
    await expect(verifyApplicationArtifact(options)).rejects.toThrow();
  });

  it.each(["main.js.map", "inline.js", "inline.css"])(
    "拒绝源码映射 %s 且失败后不保留旧签名",
    async (name) => {
      const options = await fixture();
      await writeFile(
        join(options.directory, name),
        "//# sourceMappingURL=data:application/json;base64,e30=",
      );
      await expect(
        signApplicationArtifact({ ...options, privateKey: () => keys.privateKey }),
      ).rejects.toThrow();
      await expect(
        readFile(join(options.directory, "application-artifact.json")),
      ).rejects.toThrow();
    },
  );

  it("私钥不可用时拒绝产出签名", async () => {
    const options = await fixture();
    await expect(
      signApplicationArtifact({
        ...options,
        privateKey: () => {
          throw new Error("Secret unavailable");
        },
      }),
    ).rejects.toThrow("Secret unavailable");
    await expect(verifyApplicationArtifact(options)).rejects.toThrow();
  });

  it("拒绝非 Ed25519 密钥和空身份", async () => {
    const options = await fixture();
    const wrong = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    await expect(
      verifyApplicationArtifact({ ...options, publicKey: wrong.publicKey }),
    ).rejects.toThrow("Ed25519");
    await expect(verifyApplicationArtifact({ ...options, release: "" })).rejects.toThrow("非空");
    await expect(
      signApplicationArtifact({ ...options, release: "", privateKey: () => keys.privateKey }),
    ).rejects.toThrow("非空");
    await expect(readFile(join(options.directory, "application-artifact.json"))).rejects.toThrow();
  });
});
