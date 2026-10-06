# 第三阶段原型 · QA 与交付记录

日期：2026-10-05（Asia/Shanghai）。本轮范围为高保真、内存 mock UI；没有接入数据层或部署。

## 环境与验证方式

当前会话可发现 frontend-design、ui-ux-pro-max；shadcn MCP 官方组件只读查询成功。实现与最后审查使用这两个 Skill，视觉 tokens 服从 DESIGN.md。

真实启动 Vite，使用 Codex 已有内置浏览器打开本机页面，实际点击、输入、选择文件、保存、切换和删除；未安装 Playwright、Cypress、浏览器组件或测试框架。截图与布局测量来自浏览器渲染，不是代码推算截图。

React 19.3.0 / React DOM 19.3.0 / Vite 8.3.2 / TypeScript 7.0.2 / Tailwind CSS 4.3.3 / lucide-react 1.52.0；Node.js 22.12.0。直接依赖为 React、React DOM、四个独立 Radix 交互包、lucide-react、clsx、tailwind-merge；开发依赖为 Vite 与 React 插件、TypeScript、Tailwind 与 Vite 插件、三组类型声明。完整版本见 package-lock.json。

## 实测响应式

| 视口 | 实际书架列数 | 首个封面宽 × 高 | 横向滚动 |
|---|---|---|---|
| 390 × 844 | 2 | 165 × 247.5px | 无 |
| 768 × 1024 | 4 | 155 × 232.5px | 无 |
| 1366 × 768 | 6 | 180 × 270px | 无 |
| 1920 × 1080 | 7 | 约 178.28 × 267.42px | 无 |

数值通过渲染后的 getBoundingClientRect / computed grid 读取，保存于本机 qa/geometry.json。该表为内置浏览器的视口模拟结果，不宣称是真实 iPhone 或 Android 设备测试。

390px 下实际检查了书架、详情、添加 / 编辑、筛选 Sheet、档案 Sheet、删除确认 Dialog 与空状态。输入字号 16px、评分组宽 272px、选择区域至少 48 × 48px。手机筛选 Sheet 实测宽 390px、高约 675.2px（80dvh），没有溢出。

1366px 下实际检查了六列书架、详情 240px 封面 + 右侧正文、编辑 180px 封面栏 + 字段栏、桌面档案菜单和筛选 Popover。筛选 Popover 实测宽 320px、底边约 747.64px，位于 768px 高视口内，长条件在面板内滚动。

## 实际交互检查

| 功能 | 操作与结果 |
|---|---|
| 档案入口 | 手机竖向、PC 并列；真实点击进入对应书架；无外层 Card |
| 搜索 | 手机搜索“姜乙”仅剩《悉达多》；PC 搜索“柳鸣九”仅剩《局外人》 |
| 搜索无结果 | 输入不存在的书名，出现文学感空状态，清除后恢复书架 |
| 状态筛选 | 选择暂停、应用，仅显示《面纱》；清除后恢复 12 本 |
| 筛选取消 | 条件面板有草稿、应用 / 取消，关闭不直接提交未应用条件 |
| 排序 | 实际切换评分排序，五星在前、未评分在后；另有最近 / 最早 / 添加时间 / 书名 |
| 档案切换 | 手机 Sheet 与 PC 菜单均真实操作；12 本与 8 本分别显示，查询与排序按档案分别保存 |
| 编辑隔离 | 修改陈禾《悉达多》的评分为四星、笔记与日期，林予对应记录仍是五星、原日期与笔记 |
| 编辑预填 | 书名、作者、译者、状态、日期、评分、短评与封面正确预填 |
| 日期 | 结束日期保存后详情实际显示 2026.08.01 — 2026.08.25；切回在读先确认，不静默删除日期 |
| 图片选择 | 实际通过文件选择器选择本机 JPEG，生成已加载的 blob 预览；无服务器上传 |
| 必填 | 空表单保存显示书名 / 作者错误，焦点到书名；输入保留 |
| 星级键盘 | 四星单选按方向键移到五星；随后可选择四星保存；无隐式滑过保存 |
| 新增 | 添加《冬日读书札记》及短评，保存后在当前档案显示；无封面时文字封面正常 |
| 草稿 | 取消未保存表单弹出继续 / 放弃 / 保留草稿；保留后重新进入，书名与短评恢复 |
| 删除 | 确认显示归属与书名，初始焦点在“保留这本书”；确认后仅当前记录移除 |
| 撤销 | 记录数从 13 变 12，再通过撤销恢复为 13 |
| 刷新 | 再次加载恢复原始 12 + 8 条 mock 数据，不留下 QA 新增记录 |
| 深色 | 通过手机外观选择深色，实际背景 token 为 #211F1B；封面原色保留 |
| 键盘 / Escape | Sheet 焦点保持在浮层内，关闭后返回触发按钮；搜索、菜单、评分可键盘操作 |
| 跳过导航 | Enter 激活“跳到主要内容”后仍在当前书架，焦点为 main-content，不被 hash 路由带回入口 |
| 空档案 | preview=empty 实际显示 0 本与“这里还没有书”，无假统计 |
| Skeleton | preview=loading 显示 6 个固定比例静态占位，animation 为 none，按钮可退出 |
| 资源与日志 | 12 张本地封面实际加载；本地字体正常；最终浏览器检查没有应用 error / warn 日志 |

## 发现并修复的问题

1. TypeScript 7 移除了旧 baseUrl 配置：删除该选项，使用相对 paths，重新构建通过。
2. 日期框显示已修改但 React 状态未同步：原生日期改用 input 事件更新，实际保存后复验两端日期通过。
3. 原跳转链接会改变 hash 页面：改为聚焦 / 滚动 main-content，实际键盘验证不换页。
4. 手机档案 Sheet 关闭焦点恢复不明确：绑定触发按钮恢复焦点；筛选使用正式 Trigger；Escape 与循环检查通过。
5. 路由的延后焦点处理可能干扰紧接导航的输入：改为布局阶段同步处理，复验 PC 切换后搜索通过。
6. 程序聚焦 main 导致整个页面出现大框：只取消非交互 main 的轮廓，所有可操作控件继续保留 focus-visible。
7. 移动日期 / 辅助文字过小：恢复日期 14px、辅助文字 13px；输入维持 16px。
8. 最近条目文案误称“最近在读”：改为“最近阅读”。补充真实长题名场景，书架最多两行、详情完整换行。
9. 字体准备原先包含测试描述中的非 UI 字符：排除测试文件，首个档案页最多需要的三个字体文件合计 245444 bytes，低于 250KB 预算；全四个子集合计 314460 bytes。
10. 补充低宽度重排和菜单层级，保持小控件 48px 命中区和既定层级 tokens。

## 两个 Skill 的最后审查

frontend-design：暖纸 / 墨色 / 克制酒红，宋体题名，封面为主；四个页面没有营销 Hero、统计卡片、Bento、玻璃拟态、夸张圆角或泛滥边框。PC 有留白与书目感；手机双列、单列表单与底部短操作 Sheet。深色仍是暖棕书房。最后截图确认文学 / editorial 方向成立。

ui-ux-pro-max：已检查标签、触控区域、方向键评分、focus-visible、Sheet / Dialog 焦点、Escape、安全删除、反馈与表单输入。正常正文与次级文字使用第二阶段已计算的颜色；减少运动媒体查询移除动画和位移。未把静态规则检查说成完整 WCAG 认证。

## 限制与阶段差异

- 没有真实 iPhone Safari、Android 设备、实体键盘弹出或屏幕阅读器测试。内置浏览器只做视口模拟与语义 / 键盘检查。
- 尝试浏览器放大快捷键时，内置浏览器的 innerWidth 与 devicePixelRatio 均未变化，因此没有声称完成真实 200% 文字 / 400% 页面缩放测试。已提供窄宽度重排与减少运动规则，真机与系统设置仍需后续验证。
- Noto 是当前 UI 字符的本地子集；新输入字符超出覆盖时用系统 fallback。未进行整套字体网络阻断模拟，不声称所有平台 fallback 外观完全一致。
- 设计规范的长期保存、PWA、30 天恢复、云同步和完整备份是后续目标；本轮按用户明确授权只做内存原型，主题也不持久化。删除只提供即时撤销，刷新恢复原始示例，没有虚构“已同步”。
- 按 DESIGN.md 实现了状态 / 星级 / 年份三组基本筛选及五种排序，未扩成高级搜索后台或新增产品页面。没有发现未解决的视觉规范冲突。
- 首次“Git 初始化 + 安装依赖”组合命令被自动审批按旧 Git 约束拒绝。已只读核实用户本轮第三十一节的明确授权，两项操作分别获批执行，未绕过审批；无遗留阻塞。

## 构建、测试与资产

npm run build（含 TypeScript 检查）通过；Node 内置 4 项测试全部通过，覆盖档案边界、日期排序、未评分 / 未记录日期与必填校验。没有安装额外测试框架。

本机截图位于 qa/：profiles-mobile.jpg、profiles-desktop.jpg、shelf-mobile-light.jpg、shelf-desktop-light.jpg、shelf-mobile-dark.jpg，以及 empty-mobile.jpg。截图目录不纳入 Git，以免把临时 QA 素材当成产品资源。最终交付还保留一个可运行浏览器预览。

原有 DESIGN.md / PRODUCT.md / AGENTS.md 保留；新源码、配置、本地资源、许可证、README 与本记录构成原型基线。没有 push，没有创建远端仓库，也没有进入第四阶段。

## 补充：非破坏性封面规则（2026-10-05）

本次按用户新规则更新 DESIGN.md、PRODUCT.md 和第三阶段实现：书架固定 2:3、cover、默认居中；详情和编辑预览完整 contain；cover 引用原始图片，可选 cropPosition { x, y } 为 0～1 的显示对齐参数，旧记录缺字段默认居中。编辑其他信息保留参数，更换图片重置位置。未增加裁剪器、强制裁剪流程、数据库或依赖。

使用独立临时浏览器页，实际上传宽图（1366 × 768 JPEG）和长图（390 × 844 JPEG），用户原有预览会话未用于增删改测试。两图与标准 360 × 540 封面一起在 390px 书架中实测均为 165 × 247.5px，在 1366px PC 中均为 180 × 270px；无横向滚动。三张图片的 object-fit 均为 cover，object-position 为 50% 50%。

上传后编辑预览、保存后详情和书架使用同一个原始 blob 引用，naturalWidth / naturalHeight 保持上传尺寸；没有重新编码或写出裁切图。宽图详情在手机上自然显示为约 160 × 89.95px；长图详情受最大高度 240px 限制，仍以 contain 展示完整原图。正常选择图片后直接预览与保存，没有裁剪弹层。

构建通过；现有测试加上原图引用、位置保留、旧记录默认值和独立草稿对象验证，共 5 项测试通过。浏览器控制台无 error / warn。本机证据：qa/cover-rule-mobile.jpg、qa/cover-rule-desktop.jpg。原始图片在当前 mock 生命周期内保留，刷新后的非持久化行为不变；正式原图持久保存仍由未来数据层实现。

## 补充：手机书架密度对比（2026-10-05）

本轮仅调整手机显示：默认紧凑三列，现有筛选 / 排序旁新增低权重“显示”菜单，另可选舒展两列；最终默认待用户看图确认。偏好是 App 会话内独立 UI 状态，不写入 Book / Profile 模型，不改变搜索、排序、评分或阅读记录。未来只存本机 localStorage，不同步 Supabase；本轮未实现持久化。

390 × 844 实测：紧凑三列每个封面 106 × 159px、列间距 16px；舒展两列每个封面 165 × 247.5px、列间距 20px。两者均严格 2:3、无横向滚动。书名保持 17px、作者 14px；两模式书名均单行 ellipsis、自然高度 25.5px，不再占用两行的 51px。作者单行省略，不添加译者；紧凑状态 / 日期以次级 13px 分两行，星级保持 14px。

实际点击菜单切换，书籍数量和顺序保持不变；进入长书名详情可读完整题名，返回后密度仍保留。PC 1366px 仍六列、1920px 仍七列，书名保持原有 18px / 两行 54px；PC 不显示密度菜单，tablet 布局规则也不改。未接数据库、未新增依赖，上一轮封面原图与位置数据逻辑保留。

对比截图保存为 qa/density-compact-390x844.jpg 与 qa/density-relaxed-390x844.jpg，均为实际渲染的 390 × 844，使用相同档案、排序、主题与原始 mock 封面。代码与构建检查通过；本轮只做现有内置浏览器模拟，不宣称完成真机测试。

## 3.5 视觉验收收尾（2026-10-05）

手机默认紧凑三列现已确认，舒展两列继续通过现有“显示”菜单切换；保持当前会话内状态，不新增持久化。书名 17px、作者 14px，单行 ellipsis；书名自然高度 25.5px，无第二行空白，书架不显示译者。

390 × 844 实际检查书架、详情和默认添加页：三列 gap 16px，所有封面仍为 2:3；日期为单行次级 13px。本年显示“读完 · 09.28”“在读 · 09.24”“暂停 · 08.14”，已有跨年示例显示“读完 · 25.12.22”“弃读 · 24.09.12”，均没有条目内溢出。两列切换后仍显示“读完 · 2026.09.28”，详情保持完整起止日期及译者。

手机顶栏显示完整“林予”及轻微下拉箭头，仍为文字与细短横线；点击打开原有 Sheet，Escape 关闭后焦点恢复到姓名入口。详情辅助文案统一为“阅读札记 / READING NOTES”，主体布局与 contain 展示保持不变。

1366 × 768 实际检查详情、添加及编辑页：添加 / 编辑顶部操作行均有首屏可见的“保存”，位置约 y = 89px，命中高度 48px，沿用原 save 函数和页尾入口。手机顶部保存填色区域约 56 × 40px，命中区域 56 × 48px，酒红主色保留，无阴影。键盘 Enter 提交空表单后显示原有书名 / 作者必填提示，并聚焦书名；没有新增示例记录。深色按钮仍使用既有主题 token，未改深色结构。

全部指定页面无横向滚动、明显错位或异常截断，首屏下方内容正常纵向滚动。额外复查 PC 书架：1366px 六列、1920px 七列，完整日期和 18px / 两行 54px 书名布局保持不变。字体加载正常，浏览器无 error / warn。

npm run build（含 TypeScript 检查）通过，现有 5 项 Node 测试全部通过。最初沙箱中 Node 读取安装目录出现 EPERM，使用获准的沙箱外现有命令复验通过；没有安装依赖或浏览器。没有完成真机、屏幕阅读器或真实文字放大测试，仍保留前述验证限制。

本轮实际截图：qa/polish-shelf-mobile-390x844.jpg、qa/polish-detail-mobile-390x844.jpg、qa/polish-add-mobile-390x844.jpg、qa/polish-detail-desktop-1366x768.jpg、qa/polish-add-desktop-1366x768.jpg。截图为真实页面浅色首屏，不纳入 Git。PRODUCT.md 本轮未修改；未进入 Supabase、数据库、PWA 或其他数据层开发。

## 4A 数据基础验证（2026-10-05）

从 eff9eac 干净基线开始。只新增官方 Supabase JS SDK 2.117.2 及必要传递依赖；未安装 CLI、Docker、数据库、ORM、UI 库、Skill 或 MCP。没有 env、project link 或现有登录凭据迹象；未确认或操作任何远端项目，bucket 初始化脚本也未执行。

production build（含 TypeScript）通过。现有5项测试保留，新增12项数据层测试，共17项通过：状态映射、可空整数评分、日期、归一化位置、UUID路径与归属、返回数据边界、原始 revision 精度、软删除默认过滤与分页、条件更新冲突、PATCH删除 / 恢复、原图字节 / upsert=false、失败及冲突保留原图、缺失配置与高权限 key 拒绝、migration静态安全检查。

SDK测试使用真实包，但 fetch 全部本地拦截，不访问任何 Supabase 服务。初次验证发现 Node 类型剥离不支持参数属性，以及 mock 的零行响应不符合当前 SDK 的数组返回契约；已在本轮新代码 / fixture 内修正并复验通过，没有修改第三阶段源码。

SQL仅作静态审查：四表RLS、列级授权、复合外键、DB时间 / 删除trigger、路径限制、无客户端 membership 写入 / books hard DELETE / Storage UPDATE或DELETE。没有 PostgreSQL / Docker，尚未真实解析或执行migration、FK、trigger、RLS、Storage权限、Auth或并发。已准备17项本地pgTAP回滚测试，但未执行；未将其计为通过。

UI冻结检查：App、全部页面 / 组件、styles.css、现有Book/Profile类型、mock、DESIGN.md与第三阶段对比无diff；原页面未导入新client / repository，仍使用mock。没有重做视觉或本轮整套截图，也没有实现4B数据接入。真实Database类型尚未生成；官方生成流程与迁移 / bucket / 管理员初始化步骤记录在 SUPABASE-4A.md。

PRODUCT.md 与 README明确完整备份为包含manifest、结构化数据和covers原图的ZIP；JSON仅为结构化数据备份。没有实现导出、PWA、持久化、永久删除或定时清理。

## 4A.5 真实远端基础验证（2026-10-06）

目标reading-shelf / agtkrlpiixniouipwdxr / ap-northeast-1已通过官方CLI项目列表、link ref和SQL干净性核验。项目CLI稳定版2.119.0进入dev dependency。既有本轮package/CLI配置改动保留；没有改Clash、Windows网络、UI、CSS、mock、DESIGN.md或用户Book/Profile模型。

部署：初次dry-run仅两份预期SQL，正式push成功，四表 / 6个FK（含复合FK） / 9个索引 / 4个trigger / 全表RLS真实存在。17项原pgTAP安全断言全部通过；新增失败断言抛错门禁，避免CLI仅返回exit0却漏掉not ok。所有测试事务rollback，包括临时pgTAP与fixture，没有持久化测试授权。

扩展约束套件真实测试rating NULL/1/5允许、0/6拒绝；五种status允许、非法值拒绝；x/y 0/0.5/1允许、-0.1/1.1分别拒绝；空书名/作者/家庭名拒绝，profiles家庭FK和membership联合PK正确，created_at默认生成、updated_at递增且created_at保留。

发现并修复：删除Auth用户后，books.deleted_by的ON DELETE SET NULL被原trigger恢复旧actor，触发23503。新增前滚migration 20261006000100_deleted_actor_fk_cleanup.sql，只让外键合法NULL保持，不修改前两份SQL、不删书、不扩GRANT/RLS。重新dry-run / push后，原17项与扩展约束（含Auth actor清理）全部复测通过。

真实Auth/Data API：临时A(owner)、B(member)同家庭，Outside属另一测试家庭。A/B能读household、两个profiles和books，均可在两个档案新增、编辑；数据归属仍独立。软删除由DB记时间与真实Auth actor、默认listBooks排除删除、可恢复。过期updated_at条件更新返回conflict，不覆盖。Outside通过原始SDK请求读不到目标家庭，插入被RLS拒绝，编辑/软删返回零行，原记录不变。未出现42P17或policy recursion。

GRANT实测：anon四表select均42501；成员books/profiles必要操作正常。books hard DELETE、membership INSERT/UPDATE/DELETE均42501。目录核查anon/authenticated不能EXECUTE两个trigger函数，二者非SECURITY DEFINER且search_path固定空；deleted_by不可由客户端写。授权仍为显式列级INSERT/UPDATE，没有GRANT ALL。

Storage实测：通过Storage API初始化private book-covers，10MiB及三种MIME限制符合预期。合法成员上传 / 跨成员读取成功，下载字节与原图一致；Outside读取 / 上传失败；同路径upsert:false重复、upsert:true覆盖、object UPDATE和MOVE失败，DELETE返回拒绝/零删除且原图仍可读。所有写入、移动、删除与清理仅用Storage API，没有storage.objects DML。

签名URL：默认300秒链接可读取；专门1秒链接在2.2秒后实测失效。DB只保留相对path与原文件名。封面替换上传唯一新path后基于原revision更新成功，旧原图保留；再用过期revision替换返回conflict，原引用不变、新上传原图保留。软删后封面仍可读取，支持恢复。

清理：finally仅针对本轮ledger中的UUID与路径，以Storage API删除测试文件，按关联顺序删除测试book/profile/member/household，Auth Admin API删除临时用户；SQL独立确认临时Auth UUID与业务/Storage记录无残留。没有用真实邮箱、真实书籍或邮件发送，没有建立正式家庭。

类型与drift：官方CLI真实生成src/data/remote/database.types.ts，文件由生成脚本自动标识、不手工改字段；集中client/repository/service使用Database泛型，TypeScript编译通过。远端三个history版本及语句与本地一致，四表/RLS/函数授权/策略数9+2/private bucket目录验证通过，未发现本项目意外drift；未改系统schema或使用repair。

环境与smoke：.env.local仅真实URL/publishable key且ignored，Auth settings验证key有效；Vite SSR加载现有集中client，未登录读取books被42501拒绝。管理员key只在进程内存/初始化子进程临时环境，任何原始凭据日志均抑制。qa/下ledger/report仅含非敏感测试标识/结果且ignored。

最终unit tests 17/17通过，production build通过。远端API结果为12组PASS，包括清理；SQL约束、安全与GRANT测试为真实远端执行，不再仅静态。UI、CSS和导航源码均未动，没有4B接入、登录UI、备份导出、PWA或离线同步。正式Auth用户/家庭初始化留待下一次明确授权。

## 4B-1 私人家庭访问（2026-10-06）

从 7e7ddb5 干净基线开始，用户明确授权本阶段 Auth / Household / Profiles / Session。公开注册由用户关闭，Auth settings 实测 disable_signup=true、external.email=true。唯一项目 reading-shelf / agtkrlpiixniouipwdxr / Tokyo；没有修改 Clash、Windows 网络或其他项目。

新 migration 20261006000200_household_bootstrap.sql 经静态 SQL / SECURITY DEFINER / search_path / GRANT 审查，官方 CLI dry-run 唯一列出本文件，再 push。远端函数 owner=postgres、SECURITY DEFINER=true、search_path 空，ACL 仅 postgres 与 authenticated，anon_execute=false、authenticated_execute=true。三个旧 migration 未改，membership 普通写权限保持拒绝。真实 generated Database 类型重新生成并含 RPC。

全部 26 项 unit tests 通过，production build（TypeScript + Vite）通过。Vite 有单 JS chunk 大于 500kB 的体积提醒（约584kB、gzip173kB），不影响构建，未为此重构或增加依赖。新测试覆盖 auth state / 中文错误、activeProfile 归属、归档排除、稳定排序、初始化输入与 already_initialized 恢复，另验证临时网络失败保留 SDK session、确定失效才 signOut。

远端 scripts/verify-household-auth.mjs：真实 temporary Auth 登录 / 当前用户 / session 恢复、anon RPC / membership 拒绝；12 个非法参数（null / 空白 / 过长 / 0 或 11 项 / null 姓名 / 多维数组）均拒绝且没有半成品；成功创建1个Household、当前用户owner和两个trim后的Profile；重复拒绝且service恢复已有membership；额外user_id / role / household_id参数拒绝；membership INSERT继续42501、跨家庭profiles空返回；两个并发请求恰好一个成功、另一个already_initialized；归档过滤；创建后强制事务失败全部回滚；官方signOut后session为空。最后精确清理本次UUID，临时Auth / Household / Profile / membership残留0，无Books和Storage测试文件。

真实浏览器验收（既有Codex内置浏览器，不安装浏览器 / Playwright）：

- 390×844 Login：实际宽度390、document宽度390、字体loaded；输入49.33px、按钮48px；单列无卡片，无横向滚动或文字截断。
- 1366×768 Login：实际宽度与document宽度1366，字体loaded；开放双栏与已有暖纸色 / 字体，主按钮首屏可见。
- 390×844 Bootstrap：宽度390无横向溢出，字体loaded，三个输入49.33px、主按钮48px，按钮底部约726px在首屏；两个姓名空白、默认私人书房。
- 1366×768 Bootstrap：宽度1366无横向溢出，按钮底部约660px在首屏；字段 / 简短说明清晰，无后台工具条。
- 未登录输入示例书籍深链接实际返回登录，不呈现mock或请求私人表。
- 临时账号在真实Login登录后进入Bootstrap；页面刷新保留SDK session。本人流程的模拟使用虚构临时名字，实际提交后进入真实Profiles页（隐藏计数和最近封面，不显示虚假0本）。
- 手机Sheet、PC菜单切换真实姓名，刷新恢复选择；退出回登录，再登录停在Profiles选择而不继承已清除的activeProfile。期间没有Book/Storage读写UI。
- 768×1024、1920×1080档案页补查无横向溢出；手机登录页深色实际查看正常，最终恢复浅色。
- 键盘邮箱Tab→密码Tab→登录顺序正常、焦点可见。内置浏览器文字放大快捷键未实际改变缩放，**不能宣称完成200%文字放大或真机键盘遮挡测试**；Bootstrap深色、屏幕阅读器未实测。
- 最后检查浏览器捕获error / warn为0，未检测到敏感凭据日志。没有输出正式账号密码；临时QA凭据只在进程内存，经一次性loopback管道供控制器使用，不写文件或Git。

要求的四张实际浅色首屏截图（qa/忽略，不入Git）：
qa/4b1-login-390x844.jpg、qa/4b1-login-1366x768.jpg、qa/4b1-bootstrap-390x844.jpg、qa/4b1-bootstrap-1366x768.jpg。

浏览器临时账号及其Household / Profiles已精确清理，SQL再次核实Auth用户、Household、membership、Profile、Book、Storage对象总数均0。正式家庭账号尚未创建，正式登录 / Household / 两个Profile姓名尚待用户本人完成，不将临时测试说成正式验收。当前正式入口只做真实档案准备状态；第三阶段书籍mock原样保存在PrototypeApp，不挂载、不绑定真实UUID，不上传。没有新增依赖，没有进入4B-2。

## 4B-1 正式家庭初始化验收（2026-10-06）

用户回复正式账号已创建后，先只读确认唯一项目 ref 和 disable_signup=true、external.email=true。Auth 用户为1、邮箱已确认，初始化前业务表 / Storage均0；migration history完整包含20261005000100、20261005000200、20261006000100、20261006000200。

真实本机登录页已交给用户本人；用户输入邮箱密码并填写书房和两个档案姓名，回复“登录和初始化已完成”。模型没有获取正式密码，没有读取登录字段、SDK token或浏览器session存储，没有把正式邮箱或密码写入文件、日志或Git。

SQL只读确认正式数据：1 Auth用户、1 Household、1 owner membership（确实关联该Auth用户和Household）、2未归档Profiles、0 Books、0 Storage objects。两个Profile名称与真实页面一致，sort_order分别0 / 1；正式姓名不写入Git文档。

浏览器在真实Profiles页显示“进入谁的书房？”和两个服务器档案姓名，没有mock统计 / 最近封面。仅做非破坏性选择一个正式档案，Header显示对应姓名；刷新后会话和档案选择正常恢复，再返回所有书房并保留正式登录。字体loaded，当前默认视口无横向溢出。截图qa/4b1-formal-profiles.jpg为真实页面，被忽略且不入Git。

本次仅追加正式验收文档，没有代码 / 样式 / migration / 依赖变更，因此沿用已通过的26项unit tests、production build、临时账号安全矩阵和四张指定尺寸截图，不重复运行破坏性或无关测试。没有再次初始化，没有写入Books / Storage，没有清理正式数据，没有进入4B-2。真机、200%文字放大和屏幕阅读器等此前限制不变。

## 4B-2 自动实现与验收进度（2026-10-06）

正式入口接入真实 Books，无 mock fallback。37/37 unit / repository tests 和 production build 通过。JS 627.97kB / gzip184.72kB，仍有既有 500kB 提醒；没有新增依赖或 migration，没有放宽 RLS。生产 JS 无旧 mock ID / 工厂标记，正式 App 不 import PrototypeApp。静态 secret literal 检查没有命中，.env.local 和 qa/ 已确认 ignored，管理员 secret 只在测试进程内存。

真实远端临时账号 CRUD / CAS / undo / RLS 验证全部通过，含当前 Profile 显式过滤、软删除服务器排除、同标题两档案独立、NULL / date / crop 映射、稳定新建 UUID 恢复、双客户端冲突、数据库真实删除 actor、最新删除 revision 恢复、旧 undo conflict、跨家庭 / FK / anon / hard DELETE 拒绝。远端专项 fixtures 清理成功。

实际浏览器使用另一 localhost 端口 5174 的临时 Auth，会话与用户正式 5173 隔离。已操作空 A / B、添加作者译者与仅完成日期、saving 禁用字段 / 按钮、真实详情、译者搜索、切换档案不串书、保留未保存草稿离开再恢复、另一设备修改后的冲突取消 / 主动重新载入、清除评分、再次编辑、删除确认 / 空架 / 撤销恢复。发现编辑成功后详情仍显示旧记录，已改用服务器写入响应并复测；初次列表被 mutation 打断时补读其他记录。草稿恢复提示只在真正重新进入恢复的表单显示。

浏览器实测宽1280、高720、documentWidth1265、浅色、字体loaded，无横向滚动；没有捕获 error / warn 或敏感凭据日志。已保存实际首屏：qa/4b2-empty-1280x720.jpg、4b2-shelf-1280x720.jpg、4b2-add-1280x720.jpg、4b2-detail-1280x720.jpg、4b2-conflict-1280x720.jpg（ignored、不入Git）。

**指定尺寸 QA 尚未完成**：浏览器 viewport 官方接口重复超时，页面实际尺寸未改变，不能把上述截图说成390×844或1366×768，也不能以旧 mock 截图代替。要求的八张截图、1920补查 / 文字放大 / 真机仍待完成。本轮 UI 离线 / auth-expiry 注入未实际执行；单元请求守卫和保存失败测试不等于完整浏览器故障测试。

UI 临时 Auth / Household / Profiles / Books 已精确清理，两个 qa ledger 均不存在。清理排除运行前所有正式 Household，不删除用户数据。正式人工添加 / 编辑 / 档案隔离 / 删除撤销尚待用户本人完成，最终 commit 暂不创建。不 push，不进入4B-3。

清理后只读 SQL 实测：Auth 1、Household 1、owner membership 1、未归档 Profile 2、Books 0、Storage objects 0。两个正式档案在真实 UI 均显示空书架，没有示例回退；最终留在首个档案供用户本人验收。该正式标签页实际619×672（非指定尺寸），截图 qa/4b2-formal-empty-actual.jpg。用户正式密码、token、浏览器 session 存储均未读取。

## 4B-2 正式人工验收与最终收尾（2026-10-06）

用户明确回复“正式 Books 验收完成”，确认本人完成正式添加 / 详情 / 编辑、档案隔离、删除 / 撤销流程。模型没有录入、编辑、删除或恢复正式记录，也没有读取正式密码；本轮只查询聚合数量。正式档案一正常记录1、软删除0；档案二正常记录0、软删除1。两条用户记录按其最终状态完整保留，不能因为第二档案书架为空就删除其历史或自动恢复。

远端只读复核：Auth 1、Household 1、owner membership 1、未归档 Profile 2、Storage objects 0；两档案 cover_original_path 非空数都为0。没有进入4B-3，没有正式 Storage 上传、signed URL、替换、重试或 orphan cleanup。

再次尝试指定尺寸：390×844与1366×768的官方 viewport 接口各20秒超时，reset也15秒超时。随后可用的DOM只读结果为619×672、documentWidth604、浅色、字体loaded。**两组指定尺寸 QA 未完成，八张截图未生成，不宣称通过**；用户已明确授权遇到相同工具限制时记录后收尾。不改业务代码或样式规避，不创建假截图，不把非指定尺寸截图重新命名冒充。

最终 production build通过（TypeScript + Vite，JS627.97kB / gzip184.72kB，既有chunk提醒保留），全部37项unit / repository tests通过。再次运行真实远端临时账号Books / RLS / CAS / undo矩阵，全部通过并精确清理；正式数据保留。正式入口无mock依赖，依赖 / lockfile / migration / generated types / RLS无新增变更，Git diff和secret检查后独立提交，不amend、不push。

## 4B-3 自动原图与显示验收（2026-10-06）

从a0a6b8d干净基线开始，核实唯一ref及private book-covers：10MiB、JPEG/PNG/WebP，正式Book正常1 / 软删除1、Storage0。没有改正式记录或恢复已有软删除记录。沿用frontend-design / ui-ux-pro-max审查，保持既有文学风格、tokens与手机 / PC规则。

46/46 unit / repository tests通过。真实远端临时账号上传三种格式，下载SHA256与原字节一致，path / 原始filename / center / private signed读取正确；outside sign/download/insert与public URL、duplicate / overwrite均拒绝；非图片 / SVG / 超10MiB拒绝；替换旧图字节不变，上传后旧revision冲突留下orphan且不覆盖；软删 / 恢复原图可读，移除只清空引用；新建封面拒绝保留Book。该专项Auth / Household / Profiles / Books / Storage fixtures已精确清理。

实际UI用另一端口5174的临时账号隔离正式5173。原始JPEG400×600、PNG900×400、WebP300×900，均从真实表单保存并从private Storage显示。伪JPEG实际Image.decode失败、SVG / 超10MiB拒绝，旧图和表单未损坏；选择仅本机预览，取消不上传。连续新增第二本发现已完成create UUID未退役导致误报conflict，已修正并连续三本复测，原记录没有覆盖。既有编辑 / 重新选择、换图+文字同时保存、刷新、冲突取消保留File / 输入、主动重新载入、删除 / undo、跨档案空架隔离均实际操作。

单本缺失对象的签名失败实测：真实3条记录仍显示，2图正常、1个placeholder、无整页alert；测试原引用已恢复。详情和编辑contain完整原图；详情沿用原占位框预留区保持标题位置，不把显示框裁切写回原文件。没有自动压缩、转码、EXIF展示、cropper或orphan清理功能。

本轮viewport接口已恢复：390×844四类页面实测documentWidth≤390、字体loaded、默认三列3个106×159 / gap16 / cover；两列切换正常并回三列。1366×768四类页面无横向溢出，六列、封面180×270、保存按钮底部约136.67px在首屏；1920×1080书架七列无横向溢出。八张实际浅色截图已逐张查看，并确认JPEG尺寸，没有残留弹窗 / 调试面板或焦点遮挡，只截首屏：

| 页面 | 390×844 | 1366×768 |
|---|---|---|
| 真实封面书架 | qa/4b3-shelf-390x844.jpg | qa/4b3-shelf-1366x768.jpg |
| 添加页本地预览 | qa/4b3-add-390x844.jpg | qa/4b3-add-1366x768.jpg |
| 真实封面详情 | qa/4b3-detail-390x844.jpg | qa/4b3-detail-1366x768.jpg |
| 现有封面编辑 | qa/4b3-edit-390x844.jpg | qa/4b3-edit-1366x768.jpg |

额外回退 / 宽图 / 默认视口证据也在ignored qa/，不入Git。签名URL未输出，截图不包含token。键盘返回→Tab到保存正确；五次Ctrl+=未改变宽度 / DPR，**200%放大未完成**。真机、读屏、手机键盘遮挡未实测。缓存近到期 / 去重 / 清理用可控时钟测试，未等一小时；浏览器网络中断 / partial success未强行注入，用service与integration测试，不冒充UI故障测试。

最终build通过：JS634.87kB / gzip187.27kB，既有chunk提醒保留，未新增依赖或migration。正式人工封面验收及最终提交待用户本人完成，不进入PWA / Offline / Backup。

最后在临时UI退出登录，实际回到login且封面img数量0；捕获error / warn各0，未检测到敏感token日志。UI临时Storage原件、历史图 / orphan、Book / Profile / Household / Auth均已按本轮UUID和路径精确清理，两个当前测试ledger不存在。运行入口43个本地模块无mock依赖，仅两项公开VITE配置，无运行时Storage.remove，diff与secret literal扫描通过，qa及.env.local未跟踪。正式数据只做聚合复核，用户图片由本人选择；模型不代选、不读取正式密码，正式人工验收通过前不提交。

## 4B-3 正式封面人工验收与收尾（2026-10-06）

用户本人回复“正式封面验收完成”，确认指定正式流程完成。模型不代选图片、不读取正式密码，不重复编辑 / 删除 / 恢复正式数据；只读核对记录数、cover引用、Storage对象元数据。

正式Auth 1、Household 1、owner membership 1、Profiles 2；档案一正常Book 1 / cover引用1 / Storage对象3；档案二正常Book0 / 软删除1 / cover引用0 / Storage对象0。Storage合计3，当前引用1，未引用保留原件2。替换生成新路径，旧图不覆盖不删除，因此对象数增加属预期；不凭数量区分历史图 / orphan，也不自动清理。全部正式图片保留。

最终production build及全部46项unit / repository tests通过，既有634.87kB chunk提醒保留。真实Storage / RLS / 集成矩阵再次使用独立临时账号，排除正式书房，最终精确清理；前后正式Book及Storage元数据指纹用于只读对比。正式人工验收与自动测试结果分开记录，八张指定尺寸截图已在前节，不无意义重拍。

收尾远端首次复跑在替换阶段失败，原始异常未保留以避免输出签名URL/token，原因无法确定；当轮清理成功。脚本补充固定断言 / 安全类别诊断（没有业务或权限改动）后，全套复测通过并精确清理；不隐藏首次失败，不擅自归因为网络。

最终正式Book版本 / 删除状态 / cover引用、Storage对象创建/更新时间及metadata指纹与收尾开始时完全相同，三张正式原件原样保留。最终Auth1 / Household1 / membership1 / Profiles2 / 正常Book1 / 软删除Book1 / Storage3；临时Auth0，新测试ledger不存在。旧4A.5 ledger标记cleaned，逐项UUID复查Auth / Household / Profile / Book / membership / Storage残留各0。diff / secret检查后独立正式提交，不amend、不push，不进入后续阶段。
