import { describe, expect, it } from "vitest";

import { createExternalMatcher, createLibraryConfig } from "../src/index.js";

describe("createExternalMatcher", () => {
  it("识别依赖本身和子路径", () => {
    const isExternal = createExternalMatcher(["vue", "@scope/client"]);

    expect(isExternal("vue")).toBe(true);
    expect(isExternal("vue/runtime-dom")).toBe(true);
    expect(isExternal("@scope/client/auth")).toBe(true);
    expect(isExternal("vue-router")).toBe(false);
  });
});

describe("createLibraryConfig", () => {
  it("默认生成单一 ESM 入口", () => {
    const config = createLibraryConfig({
      entry: ["/workspace/src/index.ts"],
      test: { environment: "node", include: ["test/**/*.test.ts"] },
    });

    expect(config.pack).toMatchObject({
      entry: ["/workspace/src/index.ts"],
      format: ["esm"],
      dts: true,
    });
    expect(config.test).toMatchObject({
      environment: "node",
      include: ["test/**/*.test.ts"],
    });
  });
});
