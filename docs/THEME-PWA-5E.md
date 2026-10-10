# 双主题阶段 5E · 同源线上 PWA 验收

日期：2026-10-10。当前状态：**用户已确认 iPhone 真机同源 A→B 在线更新六项全部正常，阶段 5E 已通过。** 唯一固定 QA 地址当前指向 B。下文保留准备阶段的历史记录；当前结果以本节为准。

## 最终验收与证据归属

- 用户先确认主屏幕安装 A、登录和夜航正常，首次安装没有错误更新提示；随后明确授权把同一个 QA 别名从 A 切到 B。
- 只读重新核实 A/B 均为同一 reading-shelf 项目的 READY Preview、OWNER 权限、QA 指向 A、真实 SW 文件不同后，使用官方 CLI 切换了已有唯一 QA 别名；没有新域名或部署。
- 当前 QA：reading-shelf-qa-pwa-kkshow-0105-s-projects.vercel.app → dpl_EKuaC23EcjQcnX37cDY2x31mMjpF。
- 切换后匿名首页、/sw.js、/manifest.webmanifest 均 HTTP 302 到 vercel.com；Authentication 仍生效。已授权桌面页面正常加载 CSS / 字体并出现“新版本已准备好”，没有点击更新确认；捕获 error / warn 为 0。浏览器工具无法直接展示 SW 原文，SW 字节通过 Vercel 授权部署文件 API 核验，不声称已在浏览器直接抓取其原文。
- 用户随后确认 iPhone 六项全部正常：首次安装不误报、新版本提示、取消保留当前状态、确认更新仅刷新一次、更新后主题 / 档案 / 会话保持，以及私人数据不进入 SW 缓存。真机结论来自用户反馈，不是桌面测试冒充真机或自动化 CacheStorage 取证；本轮没有获得新的 iOS 版本或缓存原始取证材料。
- 静态缓存审查：A/B 各 17 项静态 precache，无私人 API / 原图运行时缓存规则；不把 SDK 会话 localStorage 或封面内存缓存误称为 SW 缓存。
- Production 一直为 dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv；正式别名、域名、保护、环境元数据、Git 关联及源码均未变。没有自动 Supabase 写入、提交 / 推送代码、重新部署或模拟用户在 iPhone 上确认更新。
- 本地 ignored 证据：qa/theme-stage5e/readiness-current-result.json、remote-sw-result.json、alias-B-result.json、alias-B-browser-result.json、alias-B-update-ready.jpg、final-guard-result.json。均不入 Git。
- 同源真机更新验收已不再阻断发布。SDK 条件性存储白屏仍需用户在最终发布授权中明确接受；manifest 暖纸启动色是已知外观限制。

## 以下为准备阶段历史记录（不代表当前等待状态）

## 文档提交与保护范围

- 5D文档提交：37128d2be53333944f1b53f1c782c623dae392ca。
- 说明：docs: record pre-release technical review。
- 只提交docs/THEME-RELEASE-5D.md；5A未跟踪报告、StyleKit七份原件、截图、环境配置没有纳入。应用源码仍为已验收f44370a，无业务/认证/SDK/样式/封面缓存/manifest/SW源码修改。
- 本次只设置一个Preview别名；没有新部署、新项目、Git集成、域名购买、套餐变更、合并main或Git推送。5E本报告不自动提交。

## 固定地址与版本

[固定 Preview：reading-shelf-qa-pwa-kkshow-0105-s-projects.vercel.app](https://reading-shelf-qa-pwa-kkshow-0105-s-projects.vercel.app)

| 版本 | Deployment ID | 状态与对应关系 |
| --- | --- | --- |
| A，背景增强前 | dpl_JE6eyQKzrmopreNXhrrNpBr8QWr2 | READY，Preview；首装与更新起点，已完成 |
| B，背景增强后 | dpl_EKuaC23EcjQcnX37cDY2x31mMjpF | READY，Preview；固定地址当前指向 B，真机验收通过 |
| 旧正式/回退目标 | dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv | Production，未用于测试、未改变 |

已先只读确认：本机关联reading-shelf / prj_X02GZv5skGa6S4SROqIkcf44fIFj与本人账号/团队一致；本人OWNER权限、现有Hobby套餐。原固定别名仅两个Production地址，无可复用的Preview地址。通过官方CLI alias set仅增加上面的一个*.vercel.app别名，没有购买域名或修改套餐。没有将它登记到Production Domains；项目域名设置与原清单一致。[Vercel官方别名说明](https://vercel.com/docs/cli/alias)

远端A/B部署target均为null（Vercel标准Preview），不是Production；两者同项目且无正式别名。通过官方部署文件GET接口读取各自sw.js，SHA256与原审查上传物一致：A=57a1da6c0c85912eb3ff4875509acb31d91853dae462f4eb766f9fa0db1eaccb，B=afbf4f1b70a2dd2b90b3ac27c158a2631e51f5c07b0b89513cd0f4eea70a2bb1。两版不同，各17项静态precache；差异由真实构建资源产生，没有手改SW制造版本。

## 访问保护实证

新别名绑定A后，无cookie、无bypass header的HTTPS请求实际结果：

| 路径 | 结果 |
| --- | --- |
| / | HTTP302，跳转vercel.com认证 |
| /sw.js | HTTP302，跳转vercel.com认证 |
| /manifest.webmanifest | HTTP302，跳转vercel.com认证 |

随后已登录的Vercel浏览器会话可以打开真实Reading Shelf登录页，A的stylesheet为/assets/index-DqTLQgno.css；默认暖纸，捕获error/warn=0。没有关闭Authentication、加保护例外/共享链接/bypass token或迁移会话。新origin尚无Reading Shelf登录，原域名会话不应直接复制到这里。

复核Production ID、reading-shelf-ten.vercel.app和reading-shelf-kkshow-0105-s-projects.vercel.app的映射、all_except_custom_domains保护、全部环境元数据、Git关联与项目域名设置均未变；已跟踪文件哈希未变。Preview继续复用此前授权的两项公开Supabase客户端配置，本轮没有解密/打印变量值或改变环境项。共享正式数据库不是技术只读角色，仍严格禁止保存/删除/上传/恢复。

## 在线更新验收状态

| 项目 | 本轮实际结果 |
| --- | --- |
| 固定origin / A就位 | 完成，唯一QA别名指向安全Preview A |
| A/B真实SW差异 | 完成，核对远端文件字节，不是本地模拟版本 |
| 首次打开不误报更新 | 新origin实际打开A登录页，多次观测无更新提示；**不是iPhone安装/首次激活验收** |
| 切B / 发现新版本 | 尚未执行，保留A供本人登录和iPhone先准备 |
| 取消更新 / 页面草稿保持 | 尚未执行 |
| 确认后单次刷新 | 尚未执行 |
| 更新后主题 / 档案 / 会话 | 尚未执行，新origin缺少本人Reading Shelf会话 |
| 私人数据不进入SW缓存 | 远端SW静态审查支持：17项仅HTML/CSS/JS/fonts/icons/manifest，导航缓存仅应用入口，无私人API或原图运行时缓存规则。实际CacheStorage条目尚未现场取证，不能写成已完成线上运行时缓存验收。SDK会话localStorage和原内存封面签名缓存保持，不混为SW缓存。 |

已通过异步输入请求本人在右侧登录，或选择先保留A；未收到登录完成/准备A的确认时，不提前切B、不搬运认证token、不自动操作正式数据。本轮没有提交登录表单、书籍表单或任何Supabase自动写入。

## iPhone步骤（当前先完成A）

1. Safari打开上面的固定地址，确认hostname含reading-shelf-qa-pwa，以本人Vercel账号认证，再登录Reading Shelf。不要打开reading-shelf-ten.vercel.app做本次更新试验。
2. 添加到主屏幕，可在本机把图标名称设为“私人书架 QA”以免和正式图标混淆，不修改manifest。若保护阻挡安装/worker/冷启动，记录现象，不关闭保护或使用正式PWA代替。
3. 打开QA PWA，确认A首次无更新提示；选夜航及一个已有档案，只读浏览书架。回复“A已准备”，并如方便在右侧浏览器也完成Reading Shelf登录。**当前不要期待B提示，固定地址仍为A。**
4. 收到“固定地址已切到B”后，再做跨版本验收。应用可见性检查有一小时间隔；若暂时没发现更新，可在书架、没有未保存输入时关闭并重开QA PWA，使用原有启动检查，不修改SW或检查时钟。
5. 出现更新提示后，在新增书籍空表单输入一句虚构测试文字，仅留本地草稿；不保存、不上传。点“更新”后选择“继续当前操作”，确认仍在该页且草稿保留。也可只在书架点“稍后”确认当前界面保留；若稍后隐藏提醒，需要在没有真实草稿时重开再继续测试。
6. 再点“更新”，明确选择“放弃未保存内容并更新”；观察仅刷新一次、无循环刷新。主动放弃的草稿不要求保留；核对夜航、原档案和登录仍在，并只读打开书架/详情。
7. 记录iOS版本、Safari/PWA模式、是否被Vercel保护阻断及结果；桌面结果不能代替真机。本轮不要求本人使用开发者工具或读取私人缓存内容，运行时缓存取证需在可用安全工具下另行明确记录。

别名后续只在这一个QA hostname上从A切B，不新增第二个地址，不触碰生产别名。当前不切换，保留首装起点；不能把打开独立A/B原始部署地址当成同源更新通过。

## 风险与发布阻断

SDK仍为2.117.2。5D生产包故障注入证明：调试键或全部getItem读取抛错但set/remove成功时，顶层初始化可白屏；主题键异常与storage getter整体拒绝能回退登录。尚无普通Safari/iPhone PWA未注入故障的真实复现，保留条件性P1，未升级SDK、改认证或忽略认证错误。详见已提交THEME-RELEASE-5D.md。

固定Preview origin和保护问题已解决；仍待：本人完成新origin登录/准备A、真实A→B线上提示/取消/确认/会话与缓存验收、iPhone PWA反馈，以及SDK兼容边界的明确接受或单独修复决策。不能宣布5E全部完成或正式发布无阻断。manifest静态暖纸启动色继续作为已知外观限制，不在本轮改变。

本轮证据在ignored qa/theme-stage5e/：preflight-result.json、remote-sw-result.json、alias-A-result.json、first-A-observation.json、preview-A-login.jpg、final-guard-result.json。真实登录页截图不是iPhone真机截图；截图/QA/环境数据不入Git。等待本人登录/准备A后继续，同源验收未完成前不执行正式发布。
