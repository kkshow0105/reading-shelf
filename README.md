# 私人书架 / Reading Shelf

第三阶段高保真 UI 已冻结；4A 新增独立 Supabase 数据基础，尚未部署到数据库或接入 UI。四个核心页面继续使用两个虚构阅读档案、12 + 8 条示例记录与本地原创封面。**页面修改仍只存在于内存，刷新后恢复示例；没有真实登录、云同步或长期存储。**

第三阶段首次基线保留了原有三份规范；本次按用户补充的非破坏性封面规则同步更新 `DESIGN.md` 与 `PRODUCT.md`，`AGENTS.md` 不变。规范中的 Supabase、PWA、完整备份等仍是后续目标。

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
| src/App.tsx | 薄的内存状态与 hash 页面导航；没有外部状态管理库 |
| src/styles.css | DESIGN.md 对应的统一语义 tokens、双主题、字体和响应式布局 |
| public/covers | 12 张原创 SVG 测试封面，不是出版社封面 |
| public/fonts | Noto Serif SC / Noto Sans SC 精简 WOFF2、许可与来源记录 |
| scripts | 封面生成与官方字体子集准备工具，均不在应用运行时执行 |
| docs/QA.md | 实际浏览器 QA、修复与限制记录 |

未来接入数据层时可替换数据来源并引入明确的保存 / 同步状态，保留 Book / Profile 类型和现有页面。不要把当前内存“保存”误当成正式数据持久化实现。

## 已有交互

搜索书名 / 作者 / 译者；筛选状态 / 星级 / 年份；五种排序；手机底部 Sheet 与 PC 菜单切换档案；内存添加 / 编辑 / 删除、删除撤销、表单校验、草稿保留、图片本地预览；浅色 / 深色 / 跟随系统。

封面使用 `URL.createObjectURL` 保留原始文件的本机预览引用，不上传服务器、不重新编码、不生成永久裁切图。书架统一 2:3 框、cover 和默认居中；详情 / 编辑预览采用 contain 完整显示。可选 cropPosition 预留未来显示位置调整，缺少参数默认居中，普通编辑保留位置，更换图片重置居中；本轮不实现裁剪器，也不强制弹出裁剪步骤。草稿、主题选择和记录都不写 localStorage、IndexedDB 或任何数据库。图片在页面生命周期结束时释放。

没有 PWA manifest、Service Worker、离线缓存、JSON / CSV 功能或正式部署。本地资源不依赖随机图片服务，但未运行开发服务器时不承诺可离线启动应用。

## 开发预览

以下入口只用于原型 QA，不是新产品页面：

- 空档案：<http://127.0.0.1:5173/?preview=empty#/p/chen/shelf>
- Skeleton：<http://127.0.0.1:5173/?preview=loading#/p/lin/shelf>，点击“查看示例书架”退出。

正常入口无预览参数，仍是 12 + 8 条记录。重新加载页面即可恢复所有原始示例数据。

## 字体、封面与来源

UI 只使用 Noto Serif SC 与 Noto Sans SC 两个主要家族，本地子集覆盖现有 UI 和示例文字，加载失败或新字符超出子集时使用 DESIGN.md 的系统 fallback。应用运行不请求 Google Fonts；字体准备脚本只向官方 Google Fonts 源请求这些公开测试文字，许可随文件保存。

原创封面由 `scripts/generate-covers.py` 生成：书名、作者用于文学作品测试场景；人物、短评、日期均为虚构，元数据不代表某一具体出版版本。封面明确标注“原创测试封面”，不复用真实出版物版式、图片或标志。

shadcn 改编参考官方 [new-york-v4 registry](https://ui.shadcn.com/docs/components)，仅保留 Button、Input、Textarea、Dialog、Alert Dialog、Sheet、Dropdown Menu、Popover 所需接口；替换默认色彩、圆角、排版和动画。MIT 许可位于 `src/components/ui/LICENSE.txt`。

## 4A 数据基础

只新增官方 `@supabase/supabase-js` 2.117.2；未安装 Supabase CLI 或 Docker。开始检查时没有 Supabase 配置、项目关联或登录凭据迹象，也没有执行远端请求或 migration。完整结构、安全边界、部署前检查与生成类型流程见 [4A 说明](docs/SUPABASE-4A.md)。

`supabase/migrations/` 保存表、约束、索引、触发器及 RLS / Storage policies；`src/data/remote/` 包含映射、repository 和封面服务；`src/lib/supabase.ts` 是惰性 client，只有显式调用才读取配置。现有页面没有导入它。`.env.example` 仅有占位符，真实值放入已忽略的 `.env.local`。管理员 secret 只在初始化终端环境使用，绝不使用 VITE 前缀或提交。

数据库备份不包含 Storage 原始文件，不能代替 App 完整备份。未来完整备份为 ZIP（manifest.json、结构化数据、covers/ 原图）；JSON 单独导出是结构化数据备份，CSV 只用于表格导出。本阶段只定义方案，没有实现导出。[Supabase 官方备份说明](https://supabase.com/docs/guides/platform/backups)

页面保持第三阶段 mock 原型，不自动导入示例到生产数据库，不进入 4B，不 push。
