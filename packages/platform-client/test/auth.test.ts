import { describe, expect, it } from "vitest";

import { PlatformAuthClient } from "../src/auth.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformAuthClient", () => {
  it("通过请求体传输刷新令牌，避免令牌进入 URL", async () => {
    const transport = new RecordingTransport({});
    const client = new PlatformAuthClient(transport);

    await client.refresh("refresh-token-value");

    expect(transport.calls).toEqual([
      {
        path: "/auth/refresh",
        options: {
          method: "POST",
          body: { refreshToken: "refresh-token-value" },
          accessToken: null,
          retryUnauthorized: false,
        },
      },
    ]);
  });
});
