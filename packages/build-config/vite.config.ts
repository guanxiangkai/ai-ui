import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/artifact.ts"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    format: ["esm"],
    sourcemap: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
