import { describe, expect, it } from "vitest";

import { PlatformAgentClient } from "../src/index.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformAgentClient", () => {
  it("使用统一定义、调用和审计端点", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformAgentClient(transport);

    await client.definitions({ page: 1, size: 20, providerType: "DIFY" });
    await client.test("agent/1", { message: "ping" });
    await client.invocations({ page: 2, size: 50, state: "FAILED" });

    expect(transport.calls).toEqual([
      {
        path: "/agent/definitions",
        options: { query: { page: 1, size: 20, providerType: "DIFY" } },
      },
      {
        path: "/agent/definitions/agent%2F1/test",
        options: {
          method: "POST",
          body: { message: "ping" },
          timeoutMs: 600_000,
        },
      },
      {
        path: "/agent/invocations",
        options: { query: { page: 2, size: 50, state: "FAILED" } },
      },
    ]);
  });
});
