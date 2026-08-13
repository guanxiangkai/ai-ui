// 任务图会在任何 workspace build 执行前加载配置，因此本地直接读取唯一源码入口。
// package.json 仍声明 build-config 依赖，供 Vite Task 建立发布构建的拓扑顺序。
import { createLibraryConfig } from "../build-config/src/index.js";

export default createLibraryConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
