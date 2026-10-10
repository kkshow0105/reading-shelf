# 双主题阶段 6A · 最终发布冻结与检查

日期：2026-10-10。状态：本地技术检查通过，等待用户明确接受 SDK 条件性风险及最终发布授权。本轮只整理并提交发布文档；没有快进 main、推送、部署、回滚、修改别名 / 环境变量或操作正式数据库。QA Preview 保留在 B。

## 冻结候选与 Git 边界

- 分支 qa/nocturne-iphone，开始 HEAD 为 37128d2be53333944f1b53f1c782c623dae392ca。
- 最终候选是包含本报告、THEME-PWA-5E.md、NOCTURNE-IPHONE-PREVIEW.md 的本次文档提交；提交后以 git rev-parse qa/nocturne-iphone 的完整哈希交付。文档本身不能预写其所属提交的哈希，发布时必须核对最终交付值。
- 应用源码冻结在 f44370a18b69d3d7056ec532acdbb9135aa3f3b9，后续仅发布报告；已验收的夜航 5C 背景及 3A/3B 玻璃未变。
- 本地 main=f3e5f7ab1d9d5f1aaded747f594e19ff705e848c；origin/main 和只读 git ls-remote 查到的 GitHub main 均为 2051e05aa19e83e749b268a77a3744dd39670333，默认分支 main。
- origin/main 是 main 的祖先；main 是 QA 的祖先，没有分叉，可以只快进。未执行合并。正式同步前需重新 fetch 与祖先检查；远端有新增提交或分叉则停止重新评估，不强推。
- 本次只提交上述三个发布文档；StyleKit 七份原件、截图、QA 脚本 / 产物、.vercel、环境配置均不纳入。原件保留。

## 最终验证

| 检查 | 结果与范围 |
| --- | --- |
| 自动化测试 | 104/104，通过，无跳过 |
| TypeScript | 现有 tsc --noEmit 通过 |
| Production build | 现有 Vite production 构建通过；配置取自原 reading-shelf Production 的两个公开客户端变量，在进程内注入，未使用 Preview 值替代，未打印或持久化真实 env 文件 |
| 编译配置 / 产物 | 确认编译包含本轮确认的 Production 客户端配置且无测试替身；审查的 21 个静态文件逐字节与已验收 B 相同，CSS / manifest / SW 也相同；17 项静态 precache，无误生成 .backdrop-filter 工具类 |
| 封面 / keep-alive 集成 | scripts/verify-reading-ui.mjs 通过：首次 / 重挂载缓存 URL、单次签名、lazy/async、详情无多余书架、隐藏书架无重复 main / 动画 / portal 控件 |
| 关键浏览器回归 | 已安装 Chromium 与桌面 WebKit，各四视口双主题共 16 例通过：390×844、768×1024、1366×768、1920×1080 |
| 暖纸保护 | 正常字号计算样式、像素与已接受 f3 暖纸基线一致；两主题首屏 PNG 与已验收 5C 对应 PNG 一致 |
| 导航 / 文字 / 状态 | 主题切换书架 DOM 保持、900px 滚动保留、不增读取 / 签名；Sheet 实际返回 / 前进 / ESC / 焦点、草稿导航保护、隔离档案与 200% 文字 / 两列三列检查通过 |
| 受保护代码 | 本轮无源码修改；相对 f443 的应用源码、认证 / 数据层、封面缓存、PWA / manifest、依赖及锁文件相同；双主题开发没有引入新依赖 |

浏览器回归使用本地真实组件与隔离替身、阻断全部外部请求，未请求正式 Supabase。结果是桌面自动化，不替代 iPhone；用户已另行确认 5B 三批 16 项、5C 背景截图和 5E 真机 A→B 六项全部正常。真机反馈见 THEME-PWA-5E.md，不补造设备信息或原始缓存证据。

证据在 ignored qa/theme-stage6a/：tests.log、build.log、build-result.json、preflight-result.json、regression-chromium/、regression-webkit/。本轮本地生产包在 production-dist/，仅供校验，尚未上传。

## Production 只读预检

- 项目 reading-shelf，prj_X02GZv5skGa6S4SROqIkcf44fIFj；scope kkshow-0105-s-projects，现有 OWNER 权限 / Hobby。
- 当前 Production 与保留回退目标：dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv，READY / production，未改变。独立旧部署地址 reading-shelf-8cub0euwf-kkshow-0105-s-projects.vercel.app。
- 正式别名 reading-shelf-ten.vercel.app、reading-shelf-kkshow-0105-s-projects.vercel.app 均未变；项目 Domains 仍只有已验证 reading-shelf-ten.vercel.app，正式首页匿名 HTTPS HTTP 200。
- Vercel Authentication 设置仍 all_except_custom_domains。唯一 QA 别名仍指向 B，匿名访问 HTTP 302 到 vercel.com；不删除 QA 或降低保护。
- Production 的 VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY 均唯一且齐备，与 Preview 各自独立作用域；全部环境元数据与 5E 记录相同。只读确认 Production 对应原 Supabase 项目与公开客户端 key 类型，未读其他解密密钥、未用 service_role。
- 项目无 Git 集成，不建立新的自动部署关联；GitHub main 推送与 Vercel CLI 发布是两个独立步骤。未发现状态与旧记录不符。
- 已检查官方 CLI 62.5.0 deploy / rollback 参数和只读 rollback status；没有实际试回滚。回退可行性是旧版本 READY、项目权限和当前套餐规则支持，不冒称已执行验证。

## 已知风险与用户接受事项

1. **SDK 条件性 P1，尚需明确接受。** Supabase JS / auth-js 2.117.2 的 locks 模块顶层读取 supabase.gotrue-js.locks.debug；当 getItem 对此键或全体读取抛错，但写入 / 删除仍可用时，会在 React 挂载前失败并白屏。5D 隔离故障注入已复现；主题读取异常本身能回退暖纸，不能混称主题 bug。正常 iPhone Safari / 主屏幕 PWA 尚无未注入故障的实际复现，概率未知；触发会完全无法启动，但未发现权限绕过 / 数据损坏。本轮不升级、修补 SDK、改认证或吞掉会话错误。
   发布后遇到白屏：记录时间、iOS / 模式、发生前操作及可安全取得的错误；不提交密码 / token，不自动清除站点数据或唯一草稿。先尝试普通重开 / 刷新；确认同类存储故障后单独授权最小启动错误提示或上游 debug 读取修复，保留认证与归属核验。旧 Production 使用相同 SDK，回滚不能保证解决同类存储白屏；若确属本次发布回归，再按受控回退处理。只有用户明确接受该条件性风险，才建议授权发布。
2. manifest 静态 background_color / theme_color 为 #F4F0E8，夜航运行时 meta 为 #211F1B、画布 #0B1322；启动 / 状态栏可能有暖色差异。已知非阻断性外观限制，本轮不修改 manifest / SW。
3. 主 JS 约 654.26 kB（gzip 193.47 kB），保留既有 >500 kB 体积提示；无新增依赖，非阻断，不临时拆包或调阈值掩盖。

同源线上更新 / iPhone 验收已通过，不再属于未验收阻断。没有发现新增技术阻断；当前等待最终风险接受与发布授权。

## 推荐发布顺序（本轮未执行）

1. 用户明确接受上述 SDK 条件性风险，并授权 main 同步、Production 发布及严重回归时的受控回退。记录完整候选哈希；重新核对 Git / 线上身份与旧 Production ID。
2. 只读 fetch origin main；确认远端仍是候选祖先且工作区无跟踪修改。切 main，以 git merge --ff-only <候选完整哈希> 快进，核对 main 精确等于候选，再 git push origin main:main，不使用 force。若分叉 / 并发推进则停止，不自动改写或混入未验收源码。
3. 从确认提交导出独立干净源码目录，保护当前未跟踪文件；关联仅原项目。使用同项目 Production 配置和官方 CLI production 构建，审核 .vercel/output/static 仅实际静态资源。不能直接上传 Preview 包、整个工作目录、参考原件或截图。推荐 vercel pull --environment=production、vercel build --prod，再 vercel deploy --prebuilt --prod --skip-domain --scope kkshow-0105-s-projects；全程不打印配置值、不加 Git 集成 / 新项目 / bypass。发布授权后才能运行这些命令。
4. 新的 Production 候选 READY 后，先用其独立 URL 只读检查、确认环境和产物；核实旧正式地址仍原部署，再 vercel promote <新 Production ID> --scope kkshow-0105-s-projects。不可 promote 当前 Preview B 代替独立 Production 构建。[官方 skip-domain / promote 说明](https://vercel.com/docs/cli/deploy)
5. 复核两个正式别名、新 Production ID、保护与资源；只读检查用户登录、已有藏书 / 封面 / 详情 / 菜单、默认暖纸及夜航持久化。不自动执行新增 / 编辑 / 删除 / 上传 / 恢复。
6. 用户在原正式 iPhone PWA 上检查更新提示、取消和确认更新，以及主题 / 档案 / 会话保持。Preview 真机通过不自动证明正式 origin 本次更新已通过；不强制删缓存或注销 worker。
7. 严重回归时，经过明确授权，执行 vercel rollback dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv --scope kkshow-0105-s-projects，复核域名 / 保护 / 回退状态。Hobby 只允许直接前一个 Production；发布前和回滚时都要确认 previous target，期间不插入其他生产发布。[官方 rollback 限制](https://vercel.com/docs/cli/rollback)

没有数据库迁移，不需要数据回滚；回退域名不会立刻替换所有已激活 PWA worker，也不能修复当前同版本 SDK 的条件性存储故障。保持正常更新 / 用户确认流程，不丢弃草稿或登录存储，不承诺一键立即恢复全部客户端。
