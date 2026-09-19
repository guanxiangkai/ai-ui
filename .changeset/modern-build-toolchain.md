---
"@guanxiangkai/build-config": minor
"@guanxiangkai/ui": patch
"@guanxiangkai/vue-platform": patch
---

核验并升级满足依赖隔离期的 Vite+、Vue 及构建测试依赖；迁移 Rolldown 配置。新增仅依赖 Node 内置模块的制品签名与验签子路径，摘要改为有界分块读取，避免整块载入大型资源。

将传递依赖 nanoid 的固定版本更新为 3.3.18，修复 GHSA-2v37-7h3g-55p8。

将根工具链与纯 TypeScript 包升级至 TypeScript 7.0.2；Vue UI 包通过独立命名 catalog 保留 SFC 宏解析和声明生成所需的 TypeScript 6.0.3。

库构建支持指定 TypeScript 配置；声明生成只读取发布源码，避免测试和构建配置中的跨包源码引用产生额外声明文件。
