import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignore: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "pnpm-lock.yaml"],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    cache: true,
  },
});
