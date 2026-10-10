# 双主题阶段 5D · 正式发布前技术收尾

日期：2026-10-10。本轮只提交已验收5C、运行本地验证和只读评估；没有创建域名/别名、新增部署、改保护、合并main、推送或操作正式数据。

## 5C提交

- 分支：qa/nocturne-iphone。
- 提交：f44370a18b69d3d7056ec532acdbb9135aa3f3b9。
- 说明：style: refine nocturne background gradients。
- 仅三个文件：src/styles.css、DESIGN.md、docs/THEME-PRECHECK-5C.md；后两项补记本人已确认iPhone截图验收通过。截图验收不自动覆盖线上更新或极端存储故障。
- 未包含StyleKit七份原件、QA截图、环境配置或原有未跟踪的NOCTURNE-IPHONE-PREVIEW.md。5D本报告暂不提交。

## 同源在线PWA更新：未验证，先报告最小方案

只读API确认：同一reading-shelf项目没有Git关联；项目域名是reading-shelf-ten.vercel.app，现有两个固定别名reading-shelf-ten.vercel.app与reading-shelf-kkshow-0105-s-projects.vercel.app均指向Production。不能借用任何一个来做QA。

现有A/B Preview为不同origin、无稳定别名。Vercel官方区分[独立部署URL与固定分支URL](https://vercel.com/docs/deployments/generated-urls)，并支持[CLI为Preview设置别名](https://vercel.com/docs/cli/alias)。本项目未连接Git，不能把“自动生成固定分支地址”当成现有机制；[CLI分支元数据说明](https://vercel.com/docs/cli/deploy)也不能证明仅填写元数据就会为当前未关联项目建立受保护域名。

结论：技术上可以评估新增专用Preview别名，但当前没有可安全复用的固定Preview origin。用户要求创建新域名前先报告方案，本轮未创建，不能把本地更新通过写成线上六项通过。

### 最小候选方案（尚未执行，需下一步授权）

1. 只在同一项目新增一个专用*.vercel.app Preview别名，例如reading-shelf-qa-pwa-kkshow-0105-s-projects.vercel.app。这个名称仅为提案，未查证全局可用性、未创建，不购买域名、不加Git集成，不登记为Production域名，不触碰两个正式别名。
2. 优先复用两个已READY的Preview，不改SW，不增功能或版本开关：
   - A：dpl_JE6eyQKzrmopreNXhrrNpBr8QWr2，f3e5f7a阶段4.5/5A版本。
   - B：dpl_EKuaC23EcjQcnX37cDY2x31mMjpF，5C背景候选；源码视觉已对应f44370a，但原部署元数据仍记录f3基线+未提交5C候选，不能改称为当时从f443部署。
   - 已核对A/B生成SW字节不同、各17项静态precache，其余worker策略一致，因此具有真实跨版本更新的必要条件，不需要为了更新测试手改SW。
3. 先将专用别名指向A；确保归属本项目、target为Preview、Production ID/别名不变、Authentication设置不变，且无登录cookie的访问仍被Vercel保护。当前保护字段all_except_custom_domains不是新地址必然安全的充分证据，必须核实具体地址的环境分类与响应，不添加保护例外、bypass token或关闭认证。若平台将新地址归到生产/公开类别，则停止，不扩大为生产保护设置变更。
4. 在新的专用origin由本人完成Vercel和Reading Shelf登录；不复制旧域名token或存储。必要的草稿只在新建表单填入虚构文字且不保存，不修改正式书籍、上传、删除、恢复。只清理专用QA origin时也需明确范围，不清理正式PWA。
5. 安装/激活A后，只把该专用别名重指向B。保持同一origin和原SW scope=/；观测新worker等待，不手动SKIP_WAITING或篡改检查间隔来冒充应用更新流程。
6. 检查首次安装无误报；B提示更新；“稍后/继续当前操作”保留页面/未保存草稿；明确放弃并更新后仅一次刷新；主题/档案/会话恢复；只检查CacheStorage键的类型与计数，不输出token或私人响应。取消时保留草稿，不承诺主动确认放弃后草稿仍在。

风险：新增地址归属/保护需实证；Authentication cookie、worker与PWA容器可能受iPhone环境限制；别名切换会更新该QA origin安装的PWA，因此仅本人测试用；共享正式Supabase并非数据库隔离，禁止保存类测试。受保护环境无法验收时仍记录未验证，不降低保护。六项线上跨版本结果目前全部未验证；静态缓存策略检查通过只能支持其中第六项的设计判断，不能替代实际线上CacheStorage验收。

## Supabase SDK条件性白屏评估

当前package.json、lockfile与已安装@supabase/supabase-js/@supabase/auth-js均为2.117.2。

代码位置：node_modules/@supabase/auth-js/src/lib/locks.ts:20–26（发布ESM dist/module/lib/locks.js:19–22），顶层internals.debug读取supabase.gotrue-js.locks.debug；src/lib/helpers.ts:44–79的supportsLocalStorage只确认getter可取得及setItem/removeItem成功，没有验证getItem。src/main.tsx静态导入App，App经AuthProvider/lib/supabase静态加载SDK，错误早于React挂载和AuthProvider的try/catch。[官方上游locks源码](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/locks.ts)仍包含该读取，本轮未确认一个可直接升级解决此问题的版本。

本轮当前生产构建、独立本地上下文、所有外部请求拦截的五种故障复验：

| 条件 | 实际结果 |
| --- | --- |
| 整个localStorage getter抛错 | 登录页可渲染，无该白屏；不保证持久化。 |
| 仅主题偏好键读取抛错 | 默认暖纸，登录页可渲染。 |
| 仅SDK debug键getItem抛错、写入删除正常 | SDK模块求值失败，root无子节点，白屏。 |
| 全部getItem抛错、写入删除正常 | 同样白屏。 |
| 仅认证会话键读取抛错 | 显示连接失败，不开放私人数据；SDK仍有未处理拒绝日志。 |

普通Safari/iPhone PWA实际风险：目前没有未注入故障的真机复现。本人5B共16项及5C截图验收通过；本轮桌面WebKit/Chromium正常启动也通过，但不等于全部iOS版本/设置均无风险。[Web Storage标准](https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute)规定存储getter在权限/不透明origin等情况下可能抛SecurityError，不能直接推导“getItem失败而写入正常”。[WebKit存储清理说明](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)描述删除存储，不是证明这种不对称故障会发生。一般缺失键返回null与会话丢失应区别于此次模块异常。没有统计依据量化发生概率，也不把Safari私密模式直接定性为白屏原因。

风险等级：条件性P1（触发即完全无法启动），实际触发概率未知且暂无常规真机证据；不是权限绕过或已发现的数据损坏。可作为受控个人发布的显式接受边界，但不能宣称已修复；建议在最终授权中明确选择接受此边界还是另开最小修复。

### 安全的最小修复候选（仅评估，均未实现）

- 根因方向：仅捕获非认证的debug开关读取异常，失败时关闭调试；真实会话读取、getUser、家庭权限及认证错误照常处理。优先正式上游修复；若需锁定依赖补丁，必须可复现、审查具体版本和开发/生产双路径，不能直接手改node_modules或临时修改构建缓存。本轮没有升级SDK或建立补丁机制。
- 项目内可见失败方向：在启动入口动态导入App并捕获模块加载失败，展示不渲染私人内容的明确错误与人工刷新入口。可以避免裸白屏，但不会恢复失效存储/会话；属于启动边界调整，需独立授权与首屏、分包、更新、正常登录会话回归，不能当成完全修复SDK。
- 无效/不安全方向：普通React ErrorBoundary、getSupabaseClient外层try/catch或custom storage参数都晚于该顶层读取；全局重写Storage.prototype、对会话读取静默返回null、清除会话、跳过身份/归属核验都不采用。没有通过吞认证错误来伪装成功。

## 其他发布检查

本轮104/104完整测试、TypeScript --noEmit、生产构建、verify-reading-ui通过。生产CSS与已验收5C上传产物字节完全一致；manifest字节一致、17项静态precache、无意外.backdrop-filter工具类。既有654kB主JS提示仍在，本轮不拆包或调高阈值隐藏提示。

复验两引擎四尺寸双主题（390×844、768×1024、1366×768、1920×1080）：暖纸与f3冻结基线的计算样式及PNG相等；暖纸/夜航首屏PNG均与已验收5C对应PNG相等。主题切换不重建Shelf、不丢900px滚动、不增数据读取/签名；导航/Sheet焦点、前进返回、隔离档案、草稿保护和200%文字/三列两列检查通过。另在实际组件界面切夜航、刷新保留；没有正式数据请求。

Zephyr浅白框：源码是既有:focus-visible的2px outline，夜航--focus=#D6DFEB，声明outline-offset=3px（设备缩放/亚像素计算可舍入）。同一档案组件的Tab聚焦和键盘ESC关闭Sheet后实测active=true、focusVisible=true、outline=solid/2px/#D6DFEB；普通指针状态无实线outline，border透明。属于正常键盘焦点外观，没有新增按钮边框，保留无障碍提示。静态截图不能独立反推iPhone当时的输入方式；如果仅触控操作也持续显示，可补具体操作顺序再定位，不因截图移除合理焦点。隔离复现截图：qa/theme-stage5d/profile-keyboard-focus.jpg。

manifest静态background_color/theme_color仍#F4F0E8，夜航运行时meta仍#211F1B，画布#0B1322；本人已通过视觉验收，可接受时属于外观限制而非功能阻断。本轮不修改图标、启动图、manifest、SW或缓存版本。现有内存签名/浏览器图片缓存与SDK会话localStorage保持，Service Worker只预缓存静态资源，无私人API运行时缓存规则；不能误称应用完全不存用户会话。

正式Deployment仍dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv，两个Production别名及all_except_custom_domains保护未变；Preview两个公开环境项与Production各自作用域独立，Preview共享正式Supabase。只读接口未读取任何变量值，本轮没有Vercel写接口/部署命令。

## 推荐最终发布与回退（仅计划）

1. 先决定是否授权新增专用受保护Preview地址，完成上述A→B线上验收；明确接受或单独修复条件性SDK P1。当前不建议宣称无条件正式发布就绪。
2. 最终授权后固定已验收提交f44370a，重新核对工作区/Production公开变量及目标项目，用Production环境构建。沿用官方CLI手动流程；可先创建不分配正式域名的Production候选（--skip-domain）并只读检查，再经授权promote到原正式域名。不直接拿Preview构建或环境标签冒充Production，不因此连接Git或自动推main。
3. 发布前记录当前Production ID及域名映射，保留旧部署；本次无数据/认证/数据库迁移，不需要数据回滚。发布后只读检查默认暖纸、夜航偏好、封面/详情/Sheet和更新提示，不进行正式写入。
4. 若出现严重回归，经明确授权使用Vercel官方rollback恢复旧Production dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv，复核域名与保护。Hobby方案只支持直接前一个Production版本，正式发布前须核实当前套餐和可回退目标，不插入无关Production部署、不自动付费升级。[官方回退说明](https://vercel.com/docs/cli/rollback)
5. 域名回退不等于已安装PWA立即回退：客户端仍可能运行原已激活worker，需正常检查更新和本人确认；不强制清缓存/删除存储/注销worker来丢弃草稿或会话。提前验证线上A→B是评估这一边界的必要依据。

证据均在ignored qa/theme-stage5d/：vercel-readonly-result.json、pwa-static-audit.json、production-storage-result.json、focus-result.json、regression-{chromium,webkit}/navigation-layout-result.json。原参考与5A报告保留；5D本报告未提交。停止等待最终决策，不执行本节计划。
