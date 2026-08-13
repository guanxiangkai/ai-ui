import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import dts from "vite-plugin-dts";

export default defineConfig({
  // Vite+ 与 Vue 插件当前暴露的插件类型存在递归结构，运行时实现兼容。
  plugins: [vue() as never, dts({ insertTypesEntry: true }) as never],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "style",
    },
    rollupOptions: {
      external: ["@guanxiangkai/platform-client", "element-plus", "vue"],
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
