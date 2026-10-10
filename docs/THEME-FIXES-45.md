# 双主题阶段 4.5 · 发布前问题收敛

日期：2026-10-10。阶段 4 文档提交：`cbec3bba32e2e4f71537ac06f9c70dd5dfaaa243`，说明 `docs: record dual-theme regression results`。只提交 AGENTS.md、DESIGN.md、README.md、docs/QA.md、docs/THEME-REGRESSION-4.md；截图和七份 StyleKit 原件未入提交，没有推送或部署。

## 修复与剩余风险

### Sheet 返回问题：已修复，真机返回手势待验收

修改前稳定复现详情打开档案 Sheet 后返回书架，Sheet / 焦点仍在。原因是 Header 的独立打开状态不随实际路由变化关闭。

BooksWorkspace 只把已接受的 path 传给 Header；路径提交后同步关闭 Sheet。未保存草稿拒绝返回时路径不变，不把一次导航尝试误当导航完成。导航关闭后待 Radix 清理焦点限制时聚焦当前 main，preventScroll 避免焦点再卷动；正常 ESC / 关闭按钮仍返回档案按钮，触发按钮隐藏或已离开 DOM 时回退当前 main。

返回 / 前进测试另定位到既有原生历史自动恢复与应用记忆滚动竞争：旧 Header 对照且不打开 Sheet 时，900px→返回→前进→再次返回也可丢为 0。沿用现有 views.scroll 恢复，在每个已提交历史条目设置 manual，Workspace 退出时恢复进入前的模式；WebKit 需对每个条目设置，不能只在挂载时设置一次。没有新路由器、history 封装或更换 hash 监听 / 草稿保护机制。

已检查普通关闭、实际浏览器 Back / Forward、档案切换、所有书房导航、当前 main 焦点、未保存草稿阻止导航、Shelf 节点与实际离开时滚动位置。菜单正常自动聚焦自身仍可能调整滚动，两主题沿用原行为；不将此调整称为主题状态丢失。iPhone 返回手势与 Safari / 主屏幕切后台恢复仍需真实设备确认。

### 200% 文字布局：已修复，保留原截断规则

较大视口书名原固定 54px 框在字号加倍后只能容一行；改为 3em，正常字号仍为 54px，放大后为 108px，保留两行截断。手机标题原单行省略、作者截断不改。紧凑三列日期取消强制不换行并允许必要的字内换行，避免时间数字串越列；正常字体下测试书目的日期仍为原单行。

Chromium / WebKit 两主题四尺寸的正常字号计算尺寸 / 颜色 / 字体等采样一致，正常截图 PNG 与已验收 3B CSS 对照逐字节相同；暖纸另经原冻结 2051e05 CSS 计算样式对照。手机三列 / 两列均验证。200% 测试中日期各行均在所属列内、无页面横向溢出，tablet / PC 书名框容纳两行，列数 / 封面尺寸不变。white-space / overflow-wrap 规则本身有授权变化，不能宣称每个 CSS 属性文本完全相同。

此测试是 QA 临时加倍实际字体 / 行高，不是 iPhone 系统字号或完整可访问性认证。真正的系统文字、页面缩放、Apple 字体、VoiceOver 尚待验收；原有单行 / 两行省略本身继续存在，完整书名仍由既有 title / accessible name 提供。

### 存储异常白屏：已确认，未修改 SDK / 认证

对当前原生产 bundle 的独立新上下文注入五种故障：

| 读取故障 | 结果 |
| --- | --- |
| window.localStorage getter 不可访问 | 登录页正常，无页面错误；无法保证跨重启会话持久化。 |
| 仅 reading-shelf.theme | 登录正常，主题回退暖纸，无页面错误。 |
| 仅 supabase.gotrue-js.locks.debug | SDK 模块求值抛错，root 无子节点，白屏。 |
| 全部 getItem 异常、写入可用 | 同样白屏。 |
| 仅 sb- 会话键 | 应用显示连接失败 / 重试，未渲染书籍；SDK 另有未处理拒绝日志，不能写成完全无错误。 |

本机锁定依赖的 locks.js:22 顶层 debug 读取未捕获异常；supportsLocalStorage 只验证 getter / 写入删除，不能证明读取正常。官方[当前上游 locks 源码](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/locks.ts)也保留此读取。错误早于 AuthProvider 的 try / catch 和 getClient，修改主题读取、client 的 debug 配置或普通自定义 storage 不能覆盖这处全局读取。

本机常规 Chromium / WebKit 启动没有该组合故障；尚无普通 Safari 或 iPhone PWA 的真实复现，不能量化概率或宣称没有风险。[WebKit 的私密模式说明](https://webkit.org/tracking-prevention/)描述临时会话和关闭后不持久化，不能据此把私密模式直接等同于“读取必抛、写入可用”。真正设备、扩展 / 存储政策或浏览器回归仍可能产生异常边界，P1 条件性启动风险保留。

安全评估：从语义上仅给上游 debug 开关读取加 try / catch、失败时关闭调试，是窄范围候选；但本项目没有已审查的依赖补丁机制。手改 node_modules 不可复现；改 Vite 的依赖预打包 / 生产模块补丁需额外维护与双路径验证；改静态导入为异步初始化影响启动边界，超出本轮保守修复。未确认最小可靠项目内实现，本轮按授权只分析，不修改认证代码、升级 SDK 或构建配置。

不推荐改写全局 Storage.prototype、对认证读取静默返回 null、清空会话或绕过 user / household 验证。后续可单独审查上游修复 / 可复现依赖补丁，并同时验证故障时可见错误、正常会话恢复 / 续期 / 退出、依赖锁和生产启动；本轮没有联系上游或改远端设置。

## 实际修改文件

- src/components/Header.tsx：提交导航后的 Sheet 关闭及区分焦点目标。
- src/components/BooksWorkspace.tsx：传递已接受 path；协调现有记忆滚动与原生历史恢复，退出时恢复原设置。
- src/styles.css：仅书名相对高度、手机紧凑日期换行；不改夜航配色 / 材质、封面、网格或扫描排除。
- scripts/verify-navigation-layout.mjs、scripts/fixtures/navigation-layout.ts：可复跑的针对性浏览器回归，官方 SDK 接本地只读 fixture，外部请求 / 数据写入禁止；生产入口不导入 fixture。
- AGENTS.md、DESIGN.md、README.md、docs/QA.md、docs/THEME-REGRESSION-4.md、本报告：当前范围与验收记录；历史阶段 4 结论保留并链接后续。

## 验证与验收入口

104/104 现有测试、TypeScript / production build、verify-reading-ui 通过。新增 Chromium / WebKit 各 8 个四尺寸双主题用例（共 16），手机三列 / 两列正常像素和 200% 日期检查包含其中。另复验四尺寸主题持久化 / 系统模式 / 存储回退、查询筛选排序与草稿 / blob、封面缓存 / keep-alive；常规模态框保存失败 / 冲突 / 删除撤销、官方 SDK 本地会话与档案隔离、隔离备份 / 恢复均通过。没有实际云端权限或服务器并发复验。

当前生产副本 A→B 的实际 SW waiting / 取消 / 明确确认 / 单次激活刷新通过，夜航保留、1 注册 / 17 静态缓存，无私人 API / 原图缓存。只有 ignored 副本加诊断计数，正式 manifest / SW 配置和代码没有改动。生产构建仍有既有主 JS >500 kB 提示。

截图和 JSON 在 ignored qa/theme-stage45/{chromium,webkit}/，例如 dark-normal-390.png、light-normal-1366.png、dark-text200-390.png、light-text200-1366.png、两列对照，以及 navigation-layout-result.json。均是真实 App / 组件、隔离合成书目和既有原创测试封面，不是正式账号或设计图。其他结果为 state-result.json、modals-result.json、flows-result.json、production-storage-result.json、pwa-result.json、final-audit.json。

可以进入受控 iPhone 真机验收：重点验证 Sheet 返回 / 前进手势、正常关闭焦点、真实字号放大、长页滚动 / 软键盘 / 安全区、冷重启会话 / 主题及 PWA 更新。原阶段 4 人工清单继续适用，静态启动色与夜航色差仍未改。候选尚未部署，需后续授权可访问的验收环境；**不是无条件正式发布结论**，条件性 P1 的修复或接受范围仍需决定。

本轮修复和新文档不提交、不推送、不部署，不修改正式数据。完成后停止等待用户验收。
