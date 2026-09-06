# @guanxiangkai/vue-platform

## 0.2.1

### Patch Changes

- Updated dependencies
  - @guanxiangkai/platform-client@0.3.0

## 0.2.0

### Minor Changes

- cb3c86d: 统一软件包的 Vite+ 构建配置；通过请求提交策略、传输适配接口与平台客户端工厂复用稳定契约，并新增仅最新请求生效的 Vue 异步控制器，避免快速切换查询时旧响应覆盖新页面状态。刷新令牌改为只通过 JSON 请求体传输，避免进入 URL、代理访问日志和浏览器历史；会话 Store 默认改为内存存储，浏览器持久化必须由产品显式选择。

  四个软件包统一使用 Apache-2.0 许可证并声明公开 GitHub Package；实际包可见性仍在发布后按 GitHub 权限设置复核。

### Patch Changes

- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
- Updated dependencies [2b42bbe]
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
  - @guanxiangkai/platform-client@0.2.0
