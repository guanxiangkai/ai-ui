# 业务应用制品安全

`@guanxiangkai/build-config` 为消费基础库的业务项目提供可选构建加固。
`defineApplicationConfig` 继续保留 Vite+ 原有的对象、函数和异步配置用法；应用自行添加
`applicationSecurity` 插件，基础库不自动修改业务项目，也不自动启用加固。

| 能力         | 配置                                            | 作用                                                              |
| ------------ | ----------------------------------------------- | ----------------------------------------------------------------- |
| 总开关       | `enabled`                                       | 省略插件或设为 `false`，保持普通构建；添加插件时默认 `true`       |
| 源码映射限制 | 启用插件即生效                                  | 禁用构建 Source Map，拒绝最终目录中的 `.map` 和 JS/CSS 内映射引用 |
| JS 混淆      | `obfuscate: true`                               | 提高逆向成本，默认关闭；不承诺保密或无法破解                      |
| 制品签名     | `signing: { application, release, privateKey }` | 签名完整文件集合，省略或 `false` 时关闭                           |
| 部署前验签   | `verifyApplicationArtifact`                     | 验证来源、身份、版本及文件增删改；失败抛错                        |

## 在业务项目中配置

以下开关与环境变量名由业务项目维护。普通开发服务不执行安全插件，也不读取私钥。
私钥必须由 CI Secret 或受控挂载提供，不能使用 `VITE_` 前缀、`define`、源码常量或公开目录传递。

```ts
import { createPrivateKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import vue from "@vitejs/plugin-vue";
import { applicationSecurity, defineApplicationConfig } from "@guanxiangkai/build-config";

const obfuscate = process.env.ARTIFACT_OBFUSCATE === "1";
const signing = process.env.ARTIFACT_SIGN === "1";

export default defineApplicationConfig({
  plugins: [
    vue(),
    applicationSecurity({
      enabled: obfuscate || signing,
      obfuscate,
      signing: signing
        ? {
            application: "example-web",
            release: process.env.BUILD_RELEASE ?? "",
            privateKey: async () => {
              const path = process.env.ARTIFACT_SIGNING_KEY_FILE;
              if (!path) throw new Error("未配置签名私钥挂载路径");
              return createPrivateKey(await readFile(path));
            },
          }
        : false,
    }),
  ],
});
```

开启签名时 `BUILD_RELEASE` 必须是非空版本或提交标识，私钥必须是 Ed25519。
基础库不生成、保存或分发生产密钥。插件放在业务插件列表末尾，构建使用现有 `vp build`。
关闭开关即可恢复普通构建；签名生产发布应在部署流水线强制验签，不能因构建端开关被关闭而跳过。

## 部署前验证

构建完成后生成 `dist/application-artifact.json`。它包含应用、版本、每个文件的大小与 SHA-256，
并对规范化清单执行带域分隔的 Ed25519 签名。清单自身是唯一不参与文件摘要的保留文件；
HTML、CSS、JS、资源、`public` 文件和嵌套文件均纳入，不能配置忽略项。

部署系统必须从独立可信配置获取公钥、应用和预期版本，不能从待验的 dist 回填这些值：

```js
import { createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { verifyApplicationArtifact } from "@guanxiangkai/build-config/artifact";

const publicKeyFile = process.env.TRUSTED_ARTIFACT_PUBLIC_KEY_FILE;
if (!publicKeyFile) throw new Error("未配置可信验签公钥");

await verifyApplicationArtifact({
  directory: "./dist",
  application: "example-web",
  release: process.env.EXPECTED_RELEASE ?? "",
  publicKey: createPublicKey(await readFile(publicKeyFile)),
});
// 只有成功返回且构建流程成功退出，才允许后续发布步骤。
```

公钥随发布包一起提供可以作为资料，但不能直接作为信任来源。可信部署配置必须指定本次预期版本，
才能拒绝合法签名的旧版本重放。回滚时显式选择可信旧版本并重新验签。

`./artifact` 是独立的 Node 入口，签名和验签运行时只依赖 Node 内置模块，不加载 Vite+ 或混淆器。
这隔离了运行时模块加载，未改变软件包安装时的依赖关系。文件按 64 KiB 块计算摘要，避免一次读取整份大型资源；
源码映射检测保留跨块关键字及空白状态，UTF-8 字符跨块也不能绕过检查。

验签发生在独占、静止的 staging 目录，成功后不再写入，通过原子目录切换或等价制品发布机制上线。
校验会拒绝目录链及内部文件的符号链接、特殊文件、缺失文件、多余文件和被改动文件；
它不能保护验证后被其他进程继续改写的目录，也不承诺抵御同机攻击者并发替换父目录的竞态。

## 构建生命周期

插件在最终 `closeBundle` 的后置串行阶段检查磁盘输出并签名，覆盖此前完成的构建插件写入。
签名后若还有插件、压缩、替换运行配置、Service Worker 生成等步骤改动 dist，部署前验签将失败。
此时应关闭插件中的 `signing`，在全部后处理成功完成后调用独立的 `signApplicationArtifact`：

```ts
import { signApplicationArtifact } from "@guanxiangkai/build-config/artifact";

await signApplicationArtifact({
  directory: "./dist",
  application: "example-web",
  release: releaseFromTrustedBuild,
  privateKey: loadBuildSigningKey,
});
```

上述 `releaseFromTrustedBuild` 和 `loadBuildSigningKey` 由业务构建脚本提供，密钥读取方式与前例一致。
签名不能替代构建退出状态检查；任何构建失败都必须丢弃本次输出，不得仅以清单存在为发布依据。
重新签名前会移除旧签名；密钥不可用、空制品或源码映射残留时失败，不降级为未签名成功。
保留文件 `application-artifact.json` 不得承载业务内容。

## 支持范围和安全边界

- 支持单客户端环境、单输出、一次性写入磁盘的应用构建；拒绝库模式、SSR、watch、多环境、多输出和 `write: false`。
- 输出目录必须是应用根目录内的独立子目录；不能关闭 `emptyOutDir`，不能用 `rolldownOptions.output.dir/file` 绕过 `build.outDir`。
- 混淆使用固定轻量策略：不改公开属性名，不启用反调试、自保护、控制流平坦化或 `eval`。
  纯第三方 chunk 跳过，含自有模块与第三方模块的混合 chunk 整体处理；没有单独的强度或任意参数透传。
  独立 Worker 构建、`public` 中直接复制的 JS 不经过该混淆钩子，但签名仍覆盖其最终文件。
- 混淆会增加构建时间、体积或运行成本，业务项目启用后仍需验收自己的浏览器流程与性能。
  本仓库的构建样例验证不能替代每个消费应用的验收。
- 本功能没有实现浏览器端“解密运行”。浏览器可执行的逻辑仍能被读取或调试，密钥、授权与核心秘密应保留在服务端。
  如需离线交付包的传输或存储保密，应在部署通道单独做封装加密，解密后再验签；那不等于浏览器代码保密。
- 签名用于部署端验证制品来源与完整性，不会让浏览器自动验签，也不能替代 HTTPS、服务端授权或运行时安全措施。
