/**
 * 计算传输给平台认证接口的密码摘要。
 *
 * 输入必须是用户刚输入的原密码；即使原密码恰好是 40 位十六进制文本，也会且只会摘要一次。
 */
export async function digestPassword(rawPassword: string): Promise<string> {
  if (typeof rawPassword !== "string") {
    throw new Error("密码必须是文本");
  }

  if (typeof globalThis.isSecureContext === "boolean" && !globalThis.isSecureContext) {
    throw new Error("当前安全上下文不支持密码摘要");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("当前环境不支持密码摘要");
  }

  const digest = await subtle.digest("SHA-1", new TextEncoder().encode(rawPassword));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * 生成一次性临时密码。
 *
 * 使用 32 字节浏览器安全随机数并编码为 64 位小写十六进制文本；调用方负责仅在必要的安全交付界面短暂保存原值。
 */
export function generateTemporaryPassword(): string {
  if (typeof globalThis.isSecureContext === "boolean" && !globalThis.isSecureContext) {
    throw new Error("当前安全上下文不支持生成临时密码");
  }

  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error("当前环境不支持生成临时密码");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
