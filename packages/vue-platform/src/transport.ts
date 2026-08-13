import type { MaybePromise } from "@guanxiangkai/platform-client";

import type { PlatformSessionCodec } from "./storage.js";

const MESSAGE_TYPE = "guanxiangkai.platform.session";

/** 使用产品公钥实现的会话信封策略。 */
export interface PlatformPublicKeyEnvelopeStrategy {
  /** 将 UTF-8 会话载荷封装为只可由目标方私钥打开的密文。 */
  seal(plaintext: string): MaybePromise<string>;
  /** 打开并验证目标窗口发送的公钥信封。 */
  open(ciphertext: string): MaybePromise<string>;
}

/** 跨窗口会话传输的安全策略。 */
export type PlatformSessionTransportSecurity =
  | { /** 仅允许向 HTTPS 精确源发送明文。 */ kind: "https" }
  | {
      /** 使用产品提供的非对称公钥信封保护载荷。 */
      kind: "public-key";
      /** 公钥信封实现，不在基础包中保存密钥或派生材料。 */
      envelope: PlatformPublicKeyEnvelopeStrategy;
    };

/** 跨窗口会话传输配置。 */
export interface PlatformWindowSessionTransportOptions<TSession> {
  /** 接收会话的窗口引用。 */
  targetWindow: WindowProxy;
  /** 接收窗口的精确 Origin，禁止使用通配符。 */
  targetOrigin: string;
  /** 接收会话消息时用于拒绝不可信结构的解码器。 */
  codec: PlatformSessionCodec<TSession>;
  /** HTTPS 明文或产品公钥信封策略。 */
  security: PlatformSessionTransportSecurity;
}

/** 可选的跨窗口会话传输器。 */
export interface PlatformWindowSessionTransport<TSession> {
  /** 向已校验目标窗口发送当前会话或清除信号。 */
  publish(session: TSession | null): Promise<void>;
  /** 订阅来自指定窗口与精确 Origin 的会话消息。 */
  subscribe(listener: (session: TSession | null) => void): () => void;
}

interface SessionMessage {
  type: typeof MESSAGE_TYPE;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionMessage(value: unknown): value is SessionMessage {
  return isRecord(value) && value.type === MESSAGE_TYPE && typeof value.content === "string";
}

function isHttpsOrigin(origin: string): boolean {
  try {
    return new URL(origin).protocol === "https:";
  } catch {
    return false;
  }
}

function serializeSession<TSession>(session: TSession | null): string {
  return JSON.stringify({ session });
}

function deserializeSession<TSession>(
  content: string,
  codec: PlatformSessionCodec<TSession>,
): TSession | null | undefined {
  try {
    const decoded: unknown = JSON.parse(content);
    if (!isRecord(decoded) || !("session" in decoded)) return undefined;
    if (decoded.session === null) return null;
    return codec.decode(decoded.session);
  } catch {
    return undefined;
  }
}

/**
 * 创建可选的 Window postMessage 会话传输器。
 *
 * 明文模式仅接受 HTTPS 精确源；如需其他传输边界，产品必须提供基于公钥的信封策略。
 */
export function createWindowSessionTransport<TSession>(
  options: PlatformWindowSessionTransportOptions<TSession>,
): PlatformWindowSessionTransport<TSession> {
  if (typeof window === "undefined") {
    throw new Error("跨窗口会话传输仅可在浏览器环境创建");
  }
  if (options.targetOrigin === "*") {
    throw new Error("跨窗口会话传输必须指定精确 Origin");
  }
  if (options.security.kind === "https" && !isHttpsOrigin(options.targetOrigin)) {
    throw new Error("明文跨窗口会话传输仅允许 HTTPS Origin");
  }

  async function protect(plaintext: string): Promise<string> {
    return options.security.kind === "public-key"
      ? options.security.envelope.seal(plaintext)
      : plaintext;
  }

  async function unprotect(content: string): Promise<string> {
    return options.security.kind === "public-key"
      ? options.security.envelope.open(content)
      : content;
  }

  return {
    async publish(session) {
      const content = await protect(serializeSession(session));
      const message: SessionMessage = { type: MESSAGE_TYPE, content };
      options.targetWindow.postMessage(message, options.targetOrigin);
    },
    subscribe(listener) {
      const receive = (event: MessageEvent<unknown>) => {
        if (event.origin !== options.targetOrigin || event.source !== options.targetWindow) return;
        if (!isSessionMessage(event.data)) return;

        void unprotect(event.data.content)
          .then((content) => {
            const session = deserializeSession(content, options.codec);
            if (session !== undefined) listener(session);
          })
          .catch(() => undefined);
      };
      window.addEventListener("message", receive);
      return () => window.removeEventListener("message", receive);
    },
  };
}
