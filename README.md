# 私人书架 / Reading Shelf

5C-1 已由用户完成正式 iPhone 验收：主动更新后连续两次 Shelf → Detail → Back，封面保持显示，不再整片空白后逐张出现；阅读进度与其他项目也已通过，无新增导航、滚动、表单或档案切换问题。在读 / 暂停支持可清除的 0～100% 阅读进度；同档案详情期间保留当前 Shelf，返回复用原 img DOM、不重播整页淡入，非首屏保持 lazy / async。完整审计、migration、测试与最终收尾见 [5C-1](docs/BOOK-PERFORMANCE-5C1.md)。不进入 thumbnail、Offline、IndexedDB 或 Sync。

桌面 Chromium 的11张封面为200 / 0 B / disk cache；iPhone没有 Network级egress明细，真机视觉通过不等于已证明0 B。Thumbnail Recommendation保持B：几十 / 上百本时再评估；没有新增图片网络缓存、thumbnail或SW Storage cache。

新 ZIP / JSON 导出为 formatVersion 2，包含 nullable 数值 progressPercent；当前恢复同时支持旧 5A v1（缺少进度恢复为 NULL）和 v2。旧版应用不能恢复 v2，请先主动更新；用户此前下载的 v1 文件不需修改。CSV 增加“阅读进度”列，空白与 0 区分。恢复仍仅限另一个空书房，自动测试不恢复正式数据。

第三阶段整体视觉保持；4B-2/4B-3及5A正式验收完成，未执行正式恢复。5B PWA的iPhone正式验收通过，A→B主动确认更新/单次刷新/Session保持及关闭重开正常；Version B排序、iOS字体、自然封面、大图与家庭输入建议一并验收通过。[稳定HTTPS地址](https://reading-shelf-ten.vercel.app/)不变；Offline未实现。

第三阶段规范与独立历史原型继续保留，正式入口不导入mock。5B交付/验证/历史工具限制见[PWA记录](docs/PWA-5B.md)，最终独立提交包含已验收的Version B改进；完成后停止，不推进离线。

## 运行与检查

双主题阶段 0＋1 已验收：外观入口为“暖纸书房 / 夜航玻璃”，首次默认暖纸，不跟随系统；选择仅保存在本机 localStorage，首屏提前恢复。阶段 2 本地候选仅为夜航加入深墨蓝、静态柔和蓝色径向背景和基础色彩，尚未加入毛玻璃；暖纸视觉冻结。主题机制和 PWA 配置保持原样，manifest 启动颜色仍为暖纸，夜航浏览器 theme-color 仍沿用阶段 1 的 #211F1B，不能保证系统栏 / 启动画面匹配新底色。

5B：生产build生成manifest/SW，dev不注册SW。更新由用户点击确认后切换，静态shell预缓存不包含Supabase或封面/备份数据，断网不保证数据功能。当前图标为用户定稿V2“奶油白 + 蓝色层叠书页”，普通版同母版导出、maskable单独安全区适配；B2保留历史资产。2026-10-08用户确认iPhone重新添加主屏幕后图标清晰、无白边/二次圆角/异常裁切，PWA及现有功能正常，见[图标记录](docs/ICON-ASSETS.md)。

5A：“切换阅读档案”菜单 / 手机 Sheet → 数据与备份。完整 ZIP 包括全部家庭原图与软删除历史；JSON 不含原图，CSV 只作表格。恢复只支持另一个空书房，当前正式书房不可恢复。使用 fflate 0.8.3（MIT，按需加载），没有 IndexedDB / 自动备份。格式、100 MiB边界、技术时间策略、同会话重试限制和灾难恢复流程见 [5A](docs/SUPABASE-5A.md)。

真实隔离恢复测试（需要已授权的 CLI 登录，绝不在其他项目执行）：`node --experimental-strip-types scripts/verify-backup-remote.mjs`。脚本先核验唯一 project ref，使用临时 Auth / Household，导出及恢复用普通 SDK，最后精确清理自己的 UUID / Storage 路径，复核正式指纹。不要把用户下载文件放入仓库。

需要 Node.js 22.12+（Supabase SDK 要求 Node 22+）。本机已经安装本项目依赖；在项目目录运行：

```powershell
npm.cmd run dev
```

打开 <http://127.0.0.1:5173/>。开发服务器仅绑定本机，不公开到网络。

```powershell
npm.cmd run build
npm.cmd test
```

5C-1 首次渲染集成检查：`node scripts/verify-reading-ui.mjs`（使用已安装的 React / Vite，不安装浏览器）。经授权的隔离远端进度验证：`node --experimental-strip-types scripts/verify-progress-remote.mjs`；它仅在核实唯一 project ref 后创建并精确清理自己的临时 UUID。

构建包含 TypeScript 检查；测试使用 Node 自带的测试运行器与 TypeScript 类型剥离，不安装测试框架。Node 22.12 会显示类型剥离的 experimental 提示，正常情况下不影响测试结果。

## 技术与结构

React 19.3.0、Vite 8.3.2、TypeScript 7.0.2、Tailwind CSS 4.3.3、lucide-react 1.52.0。版本锁定在 `package.json` / `package-lock.json`；Tailwind 使用当前 Vite 插件方式，没有旧版 PostCSS / tailwind.config 初始化。

| 位置 | 内容 |
|---|---|
| src/pages | 档案选择、书架、详情、添加 / 编辑 |
| src/components | 顶栏、封面、星级、筛选与必要 UI 组件 |
| src/components/ui | 按 shadcn/ui 模式改编的必要组件；使用独立 Radix 包，不安装整个聚合组件库 |
| src/data/mock.ts | 两人独立阅读记录的示例数据工厂 |
| src/types | 记录、档案、筛选与页面类型 |
| src/lib/books.ts | 搜索、日期语义、筛选、排序与表单校验的纯函数 |
| src/App.tsx | 登录保护、首次书房初始化、真实档案状态与 hash 导航 |
| src/data/auth | 轻量 Auth Context、集中服务、错误 / 档案校验及测试 |
| src/data/books | Profile 范围的 Books service、加载 hook、会话草稿、并发 / 请求保护与测试 |
| src/data/backup | 家庭全量导出、版本化ZIP校验、CSV、空书房恢复、映射及会话重试 |
| src/data/covers | 原图校验、会话File预览、签名链接缓存 / hook、新建与编辑封面流程及测试 |
| src/components/BooksWorkspace.tsx | 真实书籍页面接入、保存 / 删除 / 撤销和冲突 / 草稿对话框 |
| src/PrototypeApp.tsx | 第三阶段内存书籍原型原样保留，当前入口不挂载 |
| src/styles.css | DESIGN.md 对应的统一语义 tokens、双主题、字体和响应式布局 |
| public/covers | 12 张原创 SVG 测试封面，不是出版社封面 |
| public/fonts | Noto Serif SC / Noto Sans SC 精简 WOFF2、许可与来源记录 |
| scripts | 封面生成与官方字体子集准备工具，均不在应用运行时执行 |
| docs/QA.md | 实际浏览器 QA、修复与限制记录 |

4B-2 保存须收到服务器成功响应；失败保留输入，不做离线保存。Book / Profile 类型和第三阶段书籍页面沿用，所有正式数据经 mapper / repository / service，不由页面直接处理 snake_case。

## 第三阶段原型交互（保留代码，当前不挂载）

搜索书名 / 作者 / 译者；筛选状态 / 星级 / 年份；五种排序；手机底部 Sheet 与 PC 菜单切换档案；内存添加 / 编辑 / 删除、删除撤销、表单校验、草稿保留、图片本地预览。历史原型的主题入口随共享 Theme 类型同步为暖纸 / 夜航，不恢复旧 system 模式，正式入口仍不挂载该原型。

封面使用 `URL.createObjectURL` 保留原始文件的本机预览引用，不上传服务器、不重新编码、不生成永久裁切图。书架统一 2:3 框、cover 和默认居中；详情 / 编辑预览采用 contain 完整显示。可选 cropPosition 预留未来显示位置调整，缺少参数默认居中，普通编辑保留位置，更换图片重置居中；本轮不实现裁剪器，也不强制弹出裁剪步骤。原型草稿和记录不写 localStorage、IndexedDB 或任何数据库；主题偏好采用上述本机保存机制。图片在页面生命周期结束时释放。

没有 PWA manifest、Service Worker、离线缓存、JSON / CSV 功能或正式部署。本地资源不依赖随机图片服务，但未运行开发服务器时不承诺可离线启动应用。

## 第三阶段历史预览入口（当前不启用）

以下曾用于第三阶段 QA；4B-1 正式入口不会通过这些参数显示 mock 或绕过登录：

- 空档案：<http://127.0.0.1:5173/?preview=empty#/p/chen/shelf>
- Skeleton：<http://127.0.0.1:5173/?preview=loading#/p/lin/shelf>，点击“查看示例书架”退出。

示例数据工厂及页面仍保留，不关联真实 Profile UUID，不上传生产数据库。

## 字体、封面与来源

UI 只使用 Noto Serif SC 与 Noto Sans SC 两个主要家族，本地子集覆盖现有 UI 和示例文字，加载失败或新字符超出子集时使用 DESIGN.md 的系统 fallback。应用运行不请求 Google Fonts；字体准备脚本只向官方 Google Fonts 源请求这些公开测试文字，许可随文件保存。

原创封面由 `scripts/generate-covers.py` 生成：书名、作者用于文学作品测试场景；人物、短评、日期均为虚构，元数据不代表某一具体出版版本。封面明确标注“原创测试封面”，不复用真实出版物版式、图片或标志。

shadcn 改编参考官方 [new-york-v4 registry](https://ui.shadcn.com/docs/components)，仅保留 Button、Input、Textarea、Dialog、Alert Dialog、Sheet、Dropdown Menu、Popover 所需接口；替换默认色彩、圆角、排版和动画。MIT 许可位于 `src/components/ui/LICENSE.txt`。

## 4A / 4A.5 数据基础

官方 SDK `@supabase/supabase-js` 2.117.2、项目 dev dependency `supabase` CLI 2.119.0 均锁定版本；没有安装 Docker / PostgreSQL。唯一关联项目为 `reading-shelf` / `agtkrlpiixniouipwdxr` / Tokyo。已正式部署三份 migration，包括真实测试发现的 deleted_by 外键清理修复；没有扩大客户端权限。完整结构、测试结果和限制见 [4A / 4A.5 说明](docs/SUPABASE-4A.md)。

`supabase/migrations/` 保存表、约束、索引、触发器及 RLS / Storage policies；`src/data/remote/` 包含映射、repository 和封面服务；`src/lib/supabase.ts` 是统一惰性 client，4B-1 Auth 服务显式使用它。`.env.example` 仅有占位符，真实值放入已忽略的 `.env.local`。管理员 secret 只在终端测试进程内存使用，绝不使用 VITE 前缀或提交。

数据库备份不包含 Storage 原始文件，不能代替 App 完整备份。未来完整备份为 ZIP（manifest.json、结构化数据、covers/ 原图）；JSON 单独导出是结构化数据备份，CSV 只用于表格导出。5A已实现三种导出与空书房恢复，具体范围和限制见[5A说明](docs/SUPABASE-5A.md)。[Supabase 官方备份说明](https://supabase.com/docs/guides/platform/backups)

第三阶段书籍原型不自动导入生产数据库。4B-2 没有新增 migration、放宽权限或 push。

真实数据库类型为 `src/data/remote/database.types.ts`，通过 `node scripts/generate-database-types.mjs` 从已核验的真实 public schema 生成，禁止手工编辑。集中 client / repository / service 已使用该 Database 泛型。

`node --experimental-strip-types scripts/verify-supabase-remote.mjs` 是明确授权后才运行的 4A.5 远端验证工具，限定唯一 ref，要求业务表和封面为空。使用虚构临时 Auth 用户和原图，最后按本轮 ID / 路径清理；当前已存在正式家庭数据，不能随意运行该工具。凭据只在内存，测试 ledger / report 在被忽略的 qa/，真实 publishable key 仅在已忽略的 .env.local。

## 4B-1 私人家庭访问

公开注册已由用户关闭并经 API 复核。只支持 Email + Password 登录，无注册 / OAuth / Magic Link；正式密码由本人创建、输入和保存。SDK 自行管理 session 持久化和刷新。本机仅另外保存 activeProfileId，每次启动重新核实未归档和家庭归属，退出清除此偏好。

首次登录没有 membership 时，填写书房名称及两个姓名，通过新 bootstrap_household RPC 原子创建当前用户的 owner membership、Household 和 Profiles。档案页与 Header 使用真实姓名，隐藏尚未接入的书籍统计 / 最近封面。详细迁移、权限、测试与正式账号暂停点见 [4B-1 说明](docs/SUPABASE-4B1.md)。

`node scripts/verify-household-auth.mjs` 是明确授权的临时 Auth / Bootstrap 验证工具，限定同一专用项目，精确清理本轮临时 UUID。正式账号禁止用于自动化破坏性测试。四张真实渲染截图和正式初始化 QA 结果见 [QA 记录](docs/QA.md)。4B-1 正式验收完成，正式数据保留；Books 和 Storage 文件仍为 0，不进入 4B-2。

## 4B-2 真实书籍（正式验收完成）

详见 [4B-2 实现与验收报告](docs/SUPABASE-4B2.md)。`node --experimental-strip-types scripts/verify-books-remote.mjs` 仅在明确授权的临时账号流程使用，限定同一 ref 并排除所有既有书房；检查 CRUD、CAS、软删除 / 撤销和 RLS 后精确清理，不用于修改用户正式书籍。用户本人录入的正式数据完整保留，封面 / 离线 / 备份仍未接入。

## 4B-3 原始封面（正式人工验收完成）

详见 [4B-3 实现与验证](docs/SUPABASE-4B3.md)。选择JPEG / PNG / WebP、最多10MiB，实际解码后本地预览，保存时上传原始字节。private bucket、每次全新UUID路径、upsert=false；编辑换图与文字用同一条件更新，不覆盖旧图。封面失败不回滚已经成功的新建阅读记录；旧图 / orphan / 软删除封面不自动清理。

签名链接3600秒，仅认证书房内存缓存与去重，剩余2分钟刷新，退出清理；DB仅相对path和原文件metadata。实际八张手机 / PC首屏截图见[QA](docs/QA.md)，没有mock或假截图。Node远端验证使用 `node --experimental-strip-types scripts/verify-covers-remote.mjs`，需要ignored qa/cover-fixtures里的真实测试图片，只在明确授权的临时账号流程运行；精确清理自己的Storage / Book / Household / Auth，不触碰正式数据。

本阶段不实现PWA、离线或备份。未来完整备份必须包含Storage原图，数据库备份和signed URL不能代替原件。

用户已确认正式封面验收完成。正式Storage有3个对象、当前引用1个，另2个是当前未引用的保留原件；每次替换使用新路径、旧图不自动删除，因此对象数增加属于预期。用户数据不作为测试清理对象，收尾只读复核，完整结果见4B-3说明与QA。
