import { describe, expect, it } from "vitest";

import { fileLogConfig, loginLogConfig, operationLogConfig } from "../src/system/log-config.js";

describe("平台日志配置", () => {
  it("统一使用 status 查询和 status/statusLabel 响应契约", () => {
    for (const config of [loginLogConfig, operationLogConfig, fileLogConfig]) {
      expect(config.statusKey).toBe("status");
      expect(config.columns.some((column) => column.key === "status")).toBe(true);
      expect(config.columns.some((column) => column.key === "uploadStatus")).toBe(false);
    }
    expect(loginLogConfig.columns.some((column) => column.key === "action")).toBe(true);
    expect(operationLogConfig.columns.some((column) => column.key === "operationTypeCode")).toBe(
      true,
    );
    expect(operationLogConfig.columns.some((column) => column.key === "costMs")).toBe(true);
    expect(fileLogConfig.columns.some((column) => column.key === "logTime")).toBe(true);
  });
});
