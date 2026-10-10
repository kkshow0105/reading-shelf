# 双主题阶段 5A · iPhone 预览准备与验收清单

日期：2026-10-10。本文件记录双主题预览准备，不是历史 Supabase 5A 备份功能的新开发。

## 最终状态（阶段 6A 整理）

用户已确认阶段 5B 三批共 16 项 iPhone 检查全部通过、阶段 5C 背景截图通过、阶段 5E 同源 A→B 在线更新六项全部正常。当前唯一固定 QA 地址为 reading-shelf-qa-pwa-kkshow-0105-s-projects.vercel.app，指向 B：dpl_EKuaC23EcjQcnX37cDY2x31mMjpF，保留 Vercel Authentication。详见 THEME-PWA-5E.md；SDK 条件性风险仍需最终接受。

下文是阶段 5A 当时的预览准备、只读检查与待验收清单，保留作为历史记录，其中“未完成 / 等待”的状态不代表当前发布候选。真机结果来自本人反馈；不补造设备信息、截图或自动化原始取证。正式数据只读限制持续有效。

## 本轮 CLI Preview（当前）

用户已明确授权复用同项目 Production 的两个公开 Supabase 客户端变量到 Preview，仅供本人只读验收。已使用官方 CLI `deploy --target=preview --prebuilt`，没有连接 GitHub、新建项目、推送分支或执行 Production 部署 / promote / 正式域名 alias。

- 实际 Preview：[reading-shelf-1e99bfm1d-kkshow-0105-s-projects.vercel.app](https://reading-shelf-1e99bfm1d-kkshow-0105-s-projects.vercel.app)
- Deployment ID：`dpl_JE6eyQKzrmopreNXhrrNpBr8QWr2`；READY。同一 reading-shelf 项目；API 的标准 Preview target 字段为 null，CLI 明确请求 preview，未成为 production target。
- 候选：本地 qa/nocturne-iphone / `f3e5f7ab1d9d5f1aaded747f594e19ff705e848c`，没有提交或推送。
- Preview 只新增 VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY；从同项目 Production 按变量 ID 在进程内读取，经 stdin 配置为 encrypted / preview，校验来源项目、Supabase 目标及公开客户端 key 类型。没有使用 service_role、读取其他解密密钥或打印 / 写入变量值到报告、日志、Git。Production 两项原记录 / 值保持不变。
- **共享正式 Supabase，不是隔离数据库，也不是技术上受限的只读账号。** 用户与自动化必须按只读验收约定操作；本轮没有书籍写入、删除、图片上传、恢复或其他 Supabase 自动写入。
- 使用确认的变量构建 / 类型检查通过，仅上传 21 个审查后的静态文件（17 项 precache + SW / Workbox + 字体许可）；不上传源码、真实 env 文件、参考原件、QA / 截图。原 manifest / SW 字节与构建产物一致，没有修改源配置或更新机制。
- 部署后复核正式 target 仍为 `dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv`，正式 alias、Git 关联和 Vercel Authentication 设置不变。

### 在线检查状态（本人登录前的记录）

无认证访问 Preview 实测 HTTP 302 到 vercel.com；右侧浏览器实际显示 Vercel 登录页，说明保护仍生效。尚未获得该浏览器的 Vercel / Reading Shelf 登录会话，因此**应用资源、运行时、默认暖纸 / 夜航刷新、Supabase 登录后只读书架 / 封面 / 详情 / 搜索 / 菜单和在线横向溢出均未完成检查**；没有把部署 READY、受保护登录页或本地隔离结果写成这些场景通过。

已请求本人在右侧浏览器完成 Vercel 登录及已有 Supabase 登录后回复“已登录”，不要在聊天提供密码；后续只操作主题、书架、详情、搜索及菜单。没有关闭保护、创建 bypass token 或用会自动处理 bypass 的 CLI curl 代替本人认证。[Vercel 官方说明](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)要求有权限的用户登录后获得该 URL 的浏览器访问 cookie。

### 本人登录后的在线只读复查（当前结果）

本人确认已登录后，在实际 Preview 的已认证浏览器完成以下检查。使用正式已有记录，未注入 mock、未创建测试记录；没有保存、移除、撤销、上传、恢复、建立书房或数据库写入操作。

| 检查 | 实际结果 |
| --- | --- |
| 认证 / 书架 | 本人登录后可进入书架；一个档案显示14本，另一个已有档案显示空书架，切回正常。只确认可读与当前档案展示，不等于跨家庭RLS完整测试。 |
| 暖纸 / 夜航 | 首次观测为暖纸；手动切夜航后刷新仍夜航，切暖纸后刷新仍暖纸，两次刷新后登录及书架可读。没有清除本人存储来冒充“全新无偏好测试”。 |
| 实际样式 / 资源 | CSS正常生效，字体状态loaded，14张封面完成加载；图片filter=none、opacity=1。夜航paper与主文字为既定深墨蓝 / 冷白，顶栏与Sheet的模糊为14px / 手机tablet10px；没有修改样式。 |
| 只读检索 | 已有书名查询匹配1本；详情返回保留关键词。清除搜索恢复14本；在读筛选得到2本，清除恢复；排序可切书名再恢复最近阅读。 |
| 详情 / 大图 | 两本已有书籍详情可读，大图完成加载，容器blur=none、图片无滤镜；关闭及返回正常。没有打开编辑 / 新增或执行危险确认。 |
| 手机控件 | 390×844视口默认三列，两列 / 三列切换正常；档案Sheet和手机筛选Sheet可读、打开关闭正常。 |
| 返回修复 | 在详情打开档案Sheet后执行浏览器Back，Sheet关闭、焦点在当前main；完全可见书籍样本离开与返回scrollY均486.666656px。首轮自动定位点击曾滚动离屏书籍，因此改用完全可见目标复核，没有改代码。 |
| 响应式 | 两主题均检查390×844、768×1024、1366×768、1920×1080，列数分别3/4/6/7，无页面横向溢出；两列手机亦无溢出。 |
| 运行时 | 本轮捕获的应用控制台error=0、warn=0；字体集合在只读工具中不可迭代时改读状态，不属于应用报错。 |
| 收尾 | 已恢复暖纸、原先检查的档案、完整列表、最近阅读与紧凑密度；清除临时viewport override，保留已登录Preview供本人使用。 |

复核正式Deployment仍为 `dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv`、保护未变；166个已跟踪文件哈希不变，没有新提交 / 推送 / 部署。没有抓取或保存密码、会话token、signed URL或变量值。只读结果不代表数据库技术隔离，也不对其他并发用户操作作数据不变承诺。

证据：ignored qa/theme-stage5a/online-readonly-result.json、online-final-preservation.json。截图为实际已登录Preview / 正式已有书架，**不是iPhone真机，也不是合成设计图**，只保存在本机ignored QA，不进入Git或部署：

- preview-night-desktop.jpg：默认桌面浏览器内容导出，1348×870像素。
- preview-night-390x844.jpg、preview-warm-390x844.jpg：390×844浏览器视口，内容导出375×812像素（浏览器导出不含全部滚动区域边界），不声称文件本身为390×844。
- preview-night-filter-390x844.jpg：实际夜航手机筛选Sheet，390×844像素。

上述完成的是桌面浏览器及响应式只读预检；真实iPhone Safari / 主屏幕PWA安装、软键盘 / 日期控件、返回手势、安全区 / 状态栏、系统字号 / VoiceOver、玻璃滚动性能仍由本人按清单验收。没有执行实际PWA安装或同源第二版本更新，未把manifest路径或本地SW检查写成真机生命周期通过。

### iPhone / PWA 限制

先在 iPhone Safari 打开上面的确切 Preview URL，以项目所属 Vercel 账号认证，再登录 Reading Shelf。下面 14 项清单继续使用，只读约束不变。当前预览是单个部署的 URL，没有稳定分支 alias；完整更新验收还需要后续另行授权的同源第二版本，不能换新随机域名后宣称“更新通过”。

主屏幕 PWA 的认证 cookie、冷启动和资源 / worker 获取仍待真机；如被 Vercel 保护阻断，记录为受保护预览限制，不关闭保护、不修改 manifest / SW，不以正式 PWA 替代。实际配置仍为 manifest id / start_url / scope 全部 /、17 项静态 precache，不缓存私人 API / 原图；不同 origin 不假定共享登录、主题或 worker。

本轮 166 个已跟踪文件和七份参考原件哈希不变，Git 未提交 / 推送，仅更新这份原有未跟踪报告。证据在 ignored qa/theme-stage5a/preview-env-confirmed.json、preview-upload-audit.json、preview-created.json、preview-postdeploy.json、local-preservation.json；均不包含变量值。以下内容保留为首次准备的历史记录，不代表 Preview 当前仍未创建。

## 首轮准备记录（历史）

- 阶段 4.5 已提交：`f3e5f7ab1d9d5f1aaded747f594e19ff705e848c`，说明 `fix: improve navigation and enlarged-text layout`。明确暂存 11 个修复 / 测试 / 文档文件，七份 StyleKit 原件、截图、QA 和真实环境配置未入提交。
- 提交前 104 项测试、TypeScript / production build、既有封面 / keep-alive 集成通过；Chromium 四尺寸双主题 8 例复跑通过。仅修正浏览器矩形 108 vs 107.999939px 的测试浮点公差，应用实现和正常字号像素比较不改。构建仍有既有主 JS >500 kB 提示。
- 本地预览分支：`qa/nocturne-iphone`，指向同一修复提交，**没有推送**。GitHub 的默认分支为 main，远端 main 仍为 `2051e05aa19e83e749b268a77a3744dd39670333`，没有 GitHub Actions 工作流。
- **没有创建 Vercel Preview，没有实际预览访问地址。** 本轮遵循“配置 / 隔离风险无法确认则停止”的要求，没有擅自采用其他部署方式。

## 部署配置阻断

使用已登录的官方 Vercel CLI / 只读 API 核实目标 reading-shelf 与本地关联的项目 / scope 一致，只持久化脱敏元数据，不输出或保存环境变量值。

| 检查 | 实际结果 / 影响 |
| --- | --- |
| Git 集成 | Vercel 项目没有 Git 关联，没有可确认的 Vercel Production Branch / Git Preview 触发机制；不能把 GitHub 的默认 main 当成已经配置好的 Vercel 生产分支。 |
| 分支自动部署 | 单独推 qa 分支不会由此项目自动生成 Preview；仓库也没有代为部署的 GitHub Actions。 |
| Preview Supabase | Preview 没有环境变量；两个现有前端变量 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 只作用于 Production。未复制、解密或修改配置，不能声称已经有隔离或可登录的 Preview 数据环境。 |
| 部署保护 | 当前 Vercel Authentication 设置为 all_except_custom_domains。未来具体预览域名的访问及主屏幕 PWA 兼容性尚未实测，可能需要 Vercel 登录；没有关闭保护或创建 bypass token。 |
| 正式站点 | reading-shelf-ten.vercel.app 根页面 HTTP 200；只读复核两次 production deployment ID 均为 dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv，生产目标 / alias 不变。没有生产分支推送、部署或设置修改。 |

Vercel 的[Git 部署说明](https://vercel.com/docs/git)及[环境作用域说明](https://vercel.com/docs/environment-variables)描述的是已连接仓库后的非生产分支 Preview；本项目当前不具备该前提。不得为了建立预览直接连接现有生产项目的 Git，造成未经确认的生产自动部署。

下一步应单独确认一种部署路径：优先评估现有官方 CLI 显式只部署 Preview、保留当前生产项目 Git / 保护配置，并确认预览前端环境来源；若要求 Git 自动预览，先设计不会触发生产的关联和环境设置，再允许推 qa 分支。本轮未执行任一路径，不将一次 CLI 预览假称为 Git 自动部署。新建项目、扩大 Git 访问、修改保护或复制数据库配置均未自动执行。

## 预览检查状态

由于未部署，Preview 页面、运行时、资源、主题刷新、登录后书架 / 详情 / 菜单、横向溢出和实际 SW 注册均**未在线验证**。本地隔离结果不能替代在线检查；没有把正式站点当成本次候选验收。

没有修改 manifest / Service Worker。候选仍沿用 start_url=/、scope=/、manifest id=/，SW 注册 / 控制须在候选自身 HTTPS origin；不同域名的主题 / 会话 / SW 不应假定自动共享。PWA 更新需同一稳定 Preview origin 的两个已授权版本，不能用每次不同随机地址模拟更新。Vercel 访问保护若阻断安装 / 冷启动 / worker 拉取，应记录限制，不能擅自关闭保护或拿正式 PWA 更新替代。

## iPhone 人工验收清单（预览地址提供后执行）

设备 / iOS：________　Safari / 主屏幕模式：________　候选 URL / 提交：________

先在独立预览地址验收。若接正式 Supabase，自动检查只读；本人登录会创建认证会话，但不应修改书籍。以下默认只读或仅改变本地偏好，不清除正式站点存储，不把正式书房当测试恢复目标。

- [ ] 1. 首次访问：新的 Preview origin 首次显示暖纸，系统深色也一样；暖纸颜色、封面、字号 / 间距无明显回退。【只读】
- [ ] 2. 切夜航、刷新、关闭重开 Safari，主题保持；系统深浅色变化不覆盖选择，不出现暖纸闪屏。【仅本地偏好】
- [ ] 3. 检查深墨蓝 / 柔和光斑、顶栏及菜单玻璃实际绘制，文字可读、封面原色清晰，没有过强发光。【只读】
- [ ] 4. 长书架上下滚动，反复打开公共浮层：无持续卡顿、明显异常重绘或发热；封面清晰。【只读】
- [ ] 5. 手机默认三列；切两列再切回，比例 / 裁切和控件布局正确，无横向滚动。【仅本地界面状态】
- [ ] 6. 在长页中打开可见书籍→详情→返回；书架滚动、搜索 / 筛选 / 排序保持，封面不反复闪空。【只读】
- [ ] 7. 档案 Sheet、筛选 / 排序打开和关闭正常，切档案只显示其记录；取消 / ESC（有键盘时）焦点合理。【只读 / 本地选择】
- [ ] 8. 详情打开档案 Sheet 后执行 Safari 返回及 iPhone 返回手势；到书架后 Sheet 关闭、无遮挡 / 隐藏焦点，再前进 / 返回正常。【只读】
- [ ] 9. 打开添加及编辑表单，检查软键盘、日期输入、滚动和收键盘后的按钮位置；如输入测试文字，只留本地草稿，最后明确放弃，**不要点保存或上传封面**。【不保存则不修改数据库；保存会修改真实数据，禁止作为默认验收操作】
- [ ] 10. 检查刘海 / Home 区、状态栏、底部 Sheet / 操作栏和键盘切换，无关键内容遮挡；记录夜航与暖色启动 / 浏览器栏的色差。【只读】
- [ ] 11. 使用系统文字放大及 Safari 可用的文字 / 页面缩放，日期不越列或互相覆盖，无横向滚动；原有书名单行 / 双行省略可以保留，恢复标准字号再对照。【仅设备 / 浏览器设置】
- [ ] 12. 在同一预览地址安装主屏幕 PWA，进入 PWA 后选夜航，完全关闭后冷启动，主题和登录恢复；若被 Vercel 登录层阻挡，记录“受保护预览无法验收”，不修改保护。【仅本地安装 / 会话】
- [ ] 13. 首次安装不错误提示更新；有另外授权的同源候选版本时，取消更新保留输入，确认后只刷新一次、会话 / 档案 / 主题保持。单一版本或不同 URL 不能勾选完整更新通过。【需独立授权后续 Preview 版本；不动正式部署】
- [ ] 14. 大图预览开关不变暗 / 模糊，Dialog 开关和焦点返回正确；危险确认只打开后取消，**不点移除 / 撤销 / 确认恢复 / 建立书房**。【只读；这些确认操作会修改数据】

每项请记录暖纸 / 夜航结果及异常复现步骤；桌面 WebKit 不等于 iPhone 真机。正式 Supabase 的写入、删除、恢复和破坏性测试，本轮没有执行。

## 仍需处理的风险

1. 当前 Preview 配置 / 触发 / 数据环境未就绪，真实预览地址是本次验收的直接阻断。
2. Vercel 访问保护与稳定同源地址可能限制 PWA 验收，须在实际候选上确认，不降低保护换取通过。
3. SDK 在不对称存储读取异常下的白屏仍为条件性 P1，未升级 SDK 或修改认证；正式发布前需决定修复或接受边界，详见 THEME-FIXES-45.md。
4. 真机手势、文字、键盘 / 安全区、模糊性能和 PWA 实际生命周期均未通过本轮真机验收，不能提前宣布正式发布可用。

脱敏证据在 ignored qa/theme-stage5a/vercel-config-redacted.json、production-unchanged.json。本文件为未提交的阶段 5A 准备记录；本地分支已建立，远端未修改，测试服务 / 浏览器已关闭。停止等待用户决定预览配置路径。
