import ts from "typescript";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import dts from "unplugin-dts/vite";

import { createExternalMatcher } from "../build-config/src/index.js";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      processor: "vue",
      tsconfigPath: "./tsconfig.build.json",
      entryRoot: "src",
      afterDiagnostic(diagnostics) {
        const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
        if (errors.length > 0) throw new Error(`Vue 声明生成遇到 ${errors.length} 个类型错误`);
      },
    }),
  ],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "style",
    },
    rolldownOptions: {
      external: createExternalMatcher([
        "@guanxiangkai/platform-client",
        "@element-plus/icons-vue",
        "element-plus",
        "vue",
      ]),
    },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
