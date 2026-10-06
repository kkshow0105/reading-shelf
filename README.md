# 私人书架 / Reading Shelf

第三阶段书籍视觉已冻结；4A.5 数据基础和 4B-1 登录 / 家庭初始化已部署。当前入口使用真实 Supabase Auth、Household、Profiles；正式家庭账号由用户手动创建并本人完成首次登录和初始化，已验收 1 个书房、1 个 owner membership、2 个档案。**尚未接入真实 Books 或封面，选中档案后停在准备完成状态。**

第三阶段规范与书籍原型继续保留；Supabase Auth / 家庭与档案基础已按用户授权接入。真实书籍、封面 UI、PWA 与完整备份仍是后续目标。

## 运行与检查

需要 Node.js 22.12+（Supabase SDK 要求 Node 22+）。本机已经安装本项目依赖；在项目目录运行：

```powershell
npm.cmd run dev
```

打开 <http://127.0.0.1:5173/>。开发服务器仅绑定本机，不公开到网络。

```powershell
npm.cmd run build
npm.cmd test
```

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
| src/PrototypeApp.tsx | 第三阶段内存书籍原型原样保留，当前入口不挂载 |
| src/styles.css | DESIGN.md 对应的统一语义 tokens、双主题、字体和响应式布局 |
| public/covers | 12 张原创 SVG 测试封面，不是出版社封面 |
| public/fonts | Noto Serif SC / Noto Sans SC 精简 WOFF2、许可与来源记录 |
| scripts | 封面生成与官方字体子集准备工具，均不在应用运行时执行 |
| docs/QA.md | 实际浏览器 QA、修复与限制记录 |

4B-2 才接书籍数据与保存 / 同步状态。Book / Profile 类型和第三阶段书籍页面保留，不能把旧内存“保存”误当作正式持久化。

## 第三阶段原型交互（保留代码，当前不挂载）

搜索书名 / 作者 / 译者；筛选状态 / 星级 / 年份；五种排序；手机底部 Sheet 与 PC 菜单切换档案；内存添加 / 编辑 / 删除、删除撤销、表单校验、草稿保留、图片本地预览；浅色 / 深色 / 跟随系统。

封面使用 `URL.createObjectURL` 保留原始文件的本机预览引用，不上传服务器、不重新编码、不生成永久裁切图。书架统一 2:3 框、cover 和默认居中；详情 / 编辑预览采用 contain 完整显示。可选 cropPosition 预留未来显示位置调整，缺少参数默认居中，普通编辑保留位置，更换图片重置居中；本轮不实现裁剪器，也不强制弹出裁剪步骤。草稿、主题选择和记录都不写 localStorage、IndexedDB 或任何数据库。图片在页面生命周期结束时释放。

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

数据库备份不包含 Storage 原始文件，不能代替 App 完整备份。未来完整备份为 ZIP（manifest.json、结构化数据、covers/ 原图）；JSON 单独导出是结构化数据备份，CSV 只用于表格导出。本阶段只定义方案，没有实现导出。[Supabase 官方备份说明](https://supabase.com/docs/guides/platform/backups)

第三阶段书籍原型不自动导入生产数据库，4B-1 不接 Books，不 push。

真实数据库类型为 `src/data/remote/database.types.ts`，通过 `node scripts/generate-database-types.mjs` 从已核验的真实 public schema 生成，禁止手工编辑。集中 client / repository / service 已使用该 Database 泛型。

`node --experimental-strip-types scripts/verify-supabase-remote.mjs` 是明确授权后才运行的 4A.5 远端验证工具，限定唯一 ref，要求业务表和封面为空。使用虚构临时 Auth 用户和原图，最后按本轮 ID / 路径清理；当前已存在正式家庭数据，不能随意运行该工具。凭据只在内存，测试 ledger / report 在被忽略的 qa/，真实 publishable key 仅在已忽略的 .env.local。

## 4B-1 私人家庭访问

公开注册已由用户关闭并经 API 复核。只支持 Email + Password 登录，无注册 / OAuth / Magic Link；正式密码由本人创建、输入和保存。SDK 自行管理 session 持久化和刷新。本机仅另外保存 activeProfileId，每次启动重新核实未归档和家庭归属，退出清除此偏好。

首次登录没有 membership 时，填写书房名称及两个姓名，通过新 bootstrap_household RPC 原子创建当前用户的 owner membership、Household 和 Profiles。档案页与 Header 使用真实姓名，隐藏尚未接入的书籍统计 / 最近封面。详细迁移、权限、测试与正式账号暂停点见 [4B-1 说明](docs/SUPABASE-4B1.md)。

`node scripts/verify-household-auth.mjs` 是明确授权的临时 Auth / Bootstrap 验证工具，限定同一专用项目，精确清理本轮临时 UUID。正式账号禁止用于自动化破坏性测试。四张真实渲染截图和正式初始化 QA 结果见 [QA 记录](docs/QA.md)。4B-1 正式验收完成，正式数据保留；Books 和 Storage 文件仍为 0，不进入 4B-2。
