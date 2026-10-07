# 5C-1 · 封面返回体验与阅读进度

2026-10-07 正式验收通过；开发基线 91070709744f41fd5e6e882c584853320fec3e16。用户已主动更新到封面修正版本并完成iPhone两次往返验收，其余5C-1项目此前已通过。后文保留各阶段checkpoint、实验、工具限度与部署历史，最后一节为最终收尾。未实现thumbnail、Offline、IndexedDB、Sync；不重编码或删除正式原图。

## 封面证据与限度

用户在真实桌面 Chromium / 正式站点执行 Shelf → Detail → Back 后提供 Network 结果：11 个 Img 请求，全部 200、Size 0 B、disk cache，无实际封面网络字节传输。视觉重新加载记录不等于再次产生 Supabase 高清封面 egress。这是用户实测证据，不冒充本工具捕获。iPhone 没有同等级 Network 明细，不能宣称 iPhone 0 B；也没有桌面首次 Shelf / Detail transfer、body size、签名 POST 数量、第二次往返或重新出现耗时的完整实测。

最初只读DOM工具无真实站点Network / ResourceTiming接口，不补造这些值。旧hook remount初始URL为空，即使命中缓存仍需异步回填；同步复用修复已保留，但本人初次验收确认它单独不足以消除闪白。后续生命周期/WebKit证据与最终iPhone验收确认主要问题是导航销毁视觉树、全部img重建及整页淡入重播，属于视觉加载问题；没有证据把它归因于iPhone再次完整传输高清图片。

## 缓存与最小修复

- CoverUrlCache 以经过 Household / Profile / Book 路径校验的稳定原图 Storage path 为 key。TTL 3600 秒、提前 120 秒刷新、in-flight dedupe、单次图片错误强制刷新和退出清空边界保持。
- 新 peek 只返回剩余寿命超过 120 秒的有效链接。hook 首次渲染同步取 cached URL；同一 cache / path 不先清空再回填。身份或 path 改变不能显示旧身份链接。
- BookCover 原有 loading="lazy" 保留，增加 decoding="async"；2:3 / cover / cropPosition、自然详情 / 编辑 contain 均不变。没有永久图片缓存框架。
- BooksWorkspace 已保留 Books、筛选、排序、密度、滚动和签名 cache；稳定 book.id key 已有，不重写导航与状态管理。
- TTL 内缓存复用同一 URL。首次渲染集成连续 Shelf / Detail / Shelf / Detail / Shelf 均有 src，无 effect 才回填的占位；模拟签名调用总计 1。这是实际组件 / 内存缓存测试，不冒充远端签名请求计数。
- Service Worker 架构未修改：runtimeCaching 为空；Auth、REST、Storage、signed URL、真实封面和备份不进入 SW runtime cache。

## 原图成本 / Cache-Control

初次审计时的正式只读样本：13 Books，12 张记录引用封面，12 本未软删除且有封面；两个 Profiles、一个 Household，Storage 共 14 个对象（包括历史原图）。14 个对象平均 652810 B、中位 402339 B、最大 1457945 B、合计 9139345 B。12 个引用样本平均 667585 B、中位 402339 B、最大 1457945 B、合计 8011021 B。用户正式操作后最终收尾基线为15 Books / 16 Storage，以本轮前后指纹保护当前数据。不能把文件大小加总当实际下载流量，也不能把用户11请求与当时12引用混为同一集合。

Shelf 仍直接用原始 private Storage 文件，没有 srcset / thumbnail。手机三列 cover 约 100～106 CSS px，本次 Windows Chromium CSS viewport 390×844 的实际 cover 100.885×151.323；PC cover 约 180×270。未读取所有正式原图来量像素宽度，本轮原图像素宽度未知；5B 曾记录 1080×1548 样本，不能推广到全部封面。

上传代码 cacheControl 为 3600；只读 Storage metadata 14/14 为 max-age=3600。没有捕获真实图片 HTTP 响应头，metadata 不冒充实测 HTTP Cache-Control。替换使用新 path，旧原图不清理；TTL / 上传缓存参数没有调整。

**Thumbnail Recommendation：B，未来书达到几十 / 上百本时再评估。** 当前桌面返回命中 disk cache，不支持以“返回又出现请求”为理由创建缩略图。较大原图对首次浏览大型书架仍可能有成本，应到时采集实际 transfer 再决策；本轮无缩略图字段、对象、迁移或依赖。

## 原生 lazy 的实际浏览器检查

ignored qa/ 本地隔离 harness 渲染真实 Shelf / Detail / BookForm / BookCover，使用 120 本合成数据及本地 SVG URL，绝不读取或写入正式用户数据。DOM 的 120 个 img 均为 lazy / async。390×844 首次仅 21 个图片 resource entries / complete，向下滚动两屏后为 36，不是首次加载全部 120。浏览器允许 viewport 以外少量预取。对应本地 transfer 6300 B → 23556 B 包含 Vite 缓存重新验证，不是 Supabase egress；重复导航复用缓存的本地签名 loader，无新增签名。

现有所有封面 hook 仍会解析 signed URL（120 本 fixture 的本地 loader 调用 120）；lazy 限制的是图片加载，不自动限制签名请求。没有未经许可增加懒签名机制；真实 120 本远端签名数量未测。

## Migration / 数据行为

唯一目标 reading-shelf / agtkrlpiixniouipwdxr。新 forward-only 20261007000100_add_book_progress.sql 已先 dry-run（仅这一份），再由官方 CLI 2.119.0 部署。历史四份 migration 不改。

- public.books.progress_percent：integer、nullable、无 DEFAULT。CHECK 为 NULL 或 0～100，没有 UPDATE 回填。
- authenticated 仅增加 INSERT(progress_percent)、UPDATE(progress_percent)，SELECT 沿用原权限；RLS 不变、不授予 DELETE 或 ALL。
- 部署后官方 CLI 生成 database.types.ts，diff 仅 Row / Insert / Update 三个 progress_percent 字段，非手写生成文件。
- domain / draft / mapper / DTO 为 progressPercent: number | null，严格拒绝字符串、非整数、-1、101。migration部署当时原13 Books进度全NULL；后续本人正式使用产生的进度保留，不以测试将其清空。
- 100 不自动读完；状态变化保留进度；原 CAS / 版本冲突保护和排序 / 筛选不变。

## UI / 备份

reading / paused 在书架原评分行和详情改成同一 --accent 酒红 3px 细线 + 百分比，NULL 为“—”，0 为“0%”。finished 星级及其他状态原规则保持。原生 range 0～100 / step 1 / 48px 命中区域，数字输入可精确设置；清除为 NULL，不自动保存 0，仍须点击保存。

5A v1 严格字段 schema 不接受新增字段，因此新版导出为 formatVersion 2，progressPercent 为数值 / NULL；ZIP manifest 与 data 版本必须一致。本版可恢复真正旧 v1 包，校验原始字节及 checksum 后仅在内存补 NULL；用户以前下载的正式包未读取或改写。旧应用拒绝 v2，需主动更新。CSV 增加阅读进度整数列，空值为空白；JSON 不加 %。依旧禁止正式非空书房恢复，保留原图 / 历史图规则。

## 验证与数据保护

- production build / TypeScript 通过；98/98 unit / service tests，包含既有 PWA 14 项。React 首次渲染集成另通过。
- 隔离远端 progress：NULL / 35 新建、35→67→0→NULL→1→50→100、状态切换保留，非法 INSERT / UPDATE -1 / 101 由 CHECK 拒绝；跨 Household 0 行修改，硬 DELETE 42501。测试 Auth / Household / Profiles / membership / Books 最终 0。
- 隔离远端完整备份恢复：v2 五本 NULL / 0 / 1 / 50 / 100 完整恢复；genuine v1 五本全 NULL；3 张当前原图恢复、1 张历史原图仅保留 ZIP，既有损坏 / 路径 / 跨家庭 / 部分失败 / 重试测试通过。精确清理测试 UUID 与路径，临时数据及 Storage 残留 0。未执行正式恢复。
- 正式前后 Household 1 / Profiles 2 / Books 13 / Storage 14。全部原有 Book 字段（排除新增 progress_percent）、Profile / Household 字段及 Storage metadata 的一致 JSON SHA-256：f088344f1cc70530695d432324323980a09eea88e3d568964ee353661509d4b8。新字段 non-NULL 数量 0。该算法与历史 5B 指纹范围不同，只比较本轮前后；没有重新读取全部正式图片字节。
- 本地真实组件 QA：390×844 三列、长题名 / 作者省略、NULL / 35 / 68 / 100、星级、详情、表单 / 清除 / 明确 0 / 隐藏恢复 / 键盘步进；1366×768 六列和新增 / 编辑 / 详情；1920×1080 七列。均无横向溢出。它们使用合成记录，不冒充正式登录 / iPhone 验收。
- CSS viewport 尺寸实际检查通过；截图接口输出像素为手机 375×812、PC 1351×760，不宣称 PNG 本身恰为 390×844 / 1366×768。截图、fixture、测试结果与临时账本均在 ignored qa/，不进 Git。

## 自动实现时的待验收 checkpoint（历史）

自动实现 checkpoint 时前端尚未部署；后续用户已授权发布，见下方部署记录。正式 iPhone 验收继续沿用用户主动确认更新策略。未提交、未 amend、未 push，未新增依赖。

本人需检查：Shelf→Detail→Back 连续两次是否还有整页空白后逐张显现；在读 35 / 暂停 68 同色；NULL / 明确 0 / 100 正确；读完星级、状态来回保留进度；关闭 PWA 重开仍保存；触摸 range 与精确输入。200% 字号 / 真机 VoiceOver 尚未复验，不能称通过。没有 iPhone Network 0 B 证据。人工通过后再按用户授权进行最终文档 / 验证 / 独立 Git 提交。

## 首轮自动实现修改文件与检查（历史）

候选文件共 34 个（29 modified / 5 untracked），无 staged / deleted。封面为 src/components/BookCover.tsx、src/data/covers/display.tsx、url-cache.ts、covers.test.ts；进度为新 src/components/ReadingProgress.tsx、src/types/index.ts、src/lib/books.ts / books.test.ts、src/data/remote/contracts.ts / mappers.ts / database.types.ts / foundation.test.ts、src/data/books/model.ts / books.test.ts、src/data/mock.ts（仅补历史原型 NULL）、三页面 ShelfPage.tsx / DetailPage.tsx / BookFormPage.tsx、src/styles.css。

备份为 src/data/backup/archive.ts / types.ts / repository.ts / validation.ts / export.ts / backup.test.ts；脚本为 scripts/verify-backup-remote.mjs、新 verify-progress-remote.mjs / verify-reading-ui.mjs；新 migration 为 supabase/migrations/20261007000100_add_book_progress.sql。文档为 README.md、PRODUCT.md、DESIGN.md、docs/QA.md 和本文。restore.ts 没有逻辑修改，仅早期文本转换改变换行，最终已保留原字节，不计入修改。

最终 build / TypeScript、98/98 tests、React 首次渲染集成通过；主 JS 653.43kB / gzip193.20、CSS40.72kB / gzip9.05、backup32.46kB / gzip11.05；PWA17静态项1029.89KiB，仅原有 >500kB 提示。manifest / any / 专用 maskable / Apple180 引用与像素检查通过，PWA / 应用入口 / BooksWorkspace / package及lock无 diff。124 个候选及构建文本 secret literal / privileged JWT 扫描无命中，git diff --check 通过，真实配置 / qa / 备份不入 Git。临时 QA server 5178 已结束，既有 5173 未停止。HEAD 保持正式 5B 基线，无 commit / amend / push；工作区有意保留本轮候选，等待本人验收。

## 5C-1 候选 HTTPS 部署（2026-10-07）

用户明确授权只部署当前候选，不执行正式验收、不提交。官方 Vercel CLI 62.5.0 使用既有 reading-shelf 项目，deployment dpl_H8245gpfmD1AHogHzioemZ4QNLS4 为 READY / production，稳定地址仍 https://reading-shelf-ten.vercel.app/。随机 deployment URL 仅平台内部追踪，不作为验收替代地址。未创建新项目或连接 Git。

部署前重新 build / TypeScript 与 98/98 tests 通过；manifest、any / maskable / Apple、17项静态 precache 和空 runtimeCaching 检查通过。142 个候选 / 构建 / 上传文本 secret 扫描无命中。只上传 Build Output API v3 的32个静态文件，保留旧 hash assets；无源码、env、认证、QA探针、备份或正式封面上传。

稳定 origin 无登录 HTTP 检查：首页200，32个静态资源全部200且与本地产物字节一致，manifest / SW MIME正确、no-cache/no-store/must-revalidate，10个新旧 hash资源可取。资源交付正常不代表用户 iPhone 已发现或安装更新；等待本人主动确认更新和人工验收。

部署前后正式指纹仍 f088344f1cc70530695d432324323980a09eea88e3d568964ee353661509d4b8，HH1 / Profiles2 / Books13 / Storage14、进度非NULL为0。仅SELECT核对，未重跑 / 修改migration，未运行临时远端CRUD / restore。结果在 ignored qa/5c1-deploy-*.json；未commit / push / amend，工作区保留候选，完成后暂停。

## iPhone 初次验收反馈与封面再调查（2026-10-07）

用户确认除详情返回书架仍闪白 / 逐张显示以外，其余 5C-1 正式验收通过；阶段暂不提交。当前没有 iPhone Network 0 B 明细。桌面11张 disk cache / 0 B 的证据保持，不把视觉现象解释为已证明的高清重复 egress。

使用仅 DEV 的匿名 ShelfPage / ShelfGrid / BookCover 生命周期日志，运行真实 BooksWorkspace 的本地隔离 SDK fixture（128本合成数据，120本当前档案 +8本另一档案，绝无正式数据请求）。本机既有 WebKit2342 / 26.5，不下载资源；关闭开发 StrictMode 探测重演以计数正常路线，并用真实节点身份交叉验证。日志仅组件种类、匿名序号、mount/unmount，没有书名、真实ID、URL或token。诊断完成后源码日志全部移除，记录仅 ignored qa/。

| 依次实验 | 390×844 WebKit证据 |
|---|---|
| 基线 lazy / async | 初次+两次返回ShelfPage/网格各mounted3、unmounted2；120个Shelf BookCover共mounted360、unmounted240；进入详情原120个img全部disconnected，返回全部为新节点 |
| loaded / CSS审查 | 无isLoaded、onLoad才显现、封面opacity gate或overlay；只有failed错误状态，初始false。Shelf本身page-enter每次remount重播page-in，实际返回opacity0开始；封面CSS仅transform/box-shadow过渡 |
| 只改Shelf decoding auto | 仍全量remount，page-in与opacity0仍在；本地签名120不增加，往返图片请求15→18。不能由此判断iPhone async绝无影响，但它不足以消除已证实原因 |
| 恢复async，只改前6张eager | 初次DOM为6 eager、其余lazy；全量remount和淡入仍在，往返请求仍15→18。没有同时改其他因素 |
| 恢复全lazy / async，仅保留当前Shelf树 | ShelfPage/网格各mounted1、unmounted0；Shelf BookCover mounted120、unmounted0；两次返回同一Shelf与全部img节点，首6张complete，opacity1、animation none；本地图片请求15→15，签名120→120 |

确认的结构原因是 ProfileBooks 用互斥page分支销毁Shelf与全部img，并让整页淡入重播。Safari实际解码/绘制如何参与逐张出现仍待真机复验，不宣称 Windows WebKit已经证明iPhone现象消失。

最小修复新增 ShelfDetailView：仅保留曾打开的当前 Household / Profile Shelf，详情作为另一可见视图，返回复用同一DOM；不是后台保留所有路由。详情期间隐藏/inert/aria-hidden，Shelf不占布局、不进入可访问树，暂时无main-content ID；门户菜单控件暂时卸载以免遮挡详情，应用过的筛选/排序/密度仍由既有state保留。只有一个可见main、一个main-content ID；返回不重播入场动画。进入new/edit/backup会释放；profile切换/所有书房/退出按原键与上层生命周期释放；详情深链接不创建隐藏Shelf。没有新router、状态库、图片字节缓存、preload、fetch blob或object URL cache。

最终 loading策略仍所有Shelf img lazy / decoding async；已加载Shelf返回不创建新img，因此不必保留本轮试验中的eager或auto变化。非首屏滚动后才逐步加载，120本手机初次15张complete，PC1366初次18、1920初次35；这是本地合成图片，不是正式Supabase transfer。缓存TTL/refresh/dedupe与BookCover本轮开始时字节完全不变。

最终WebKit390×844/1366×768/1920×1080两次往返均同节点、不新增图片请求、无横向溢出；native Back恢复900px滚动和焦点、表单释放、profile切换释放、直接详情无隐藏Shelf、继续滚动lazy通过。1920首次QA固定索引不在视口，工具点击自动滚动造成断言失败；只调整ignored QA选择可视书籍后一次复验通过，未改业务代码适配。

98/98 unit/service与React首次渲染/直接详情/隐藏控件集成通过，production build通过，主JS654.02kB/gzip193.44，PWA仍17项；仅既有chunk提示。与本轮开始文件hash比较：阅读进度、migration、backup、Storage、URL缓存/hook、PWA源码/配置、样式tokens、原图规则及依赖全未变。本轮代码仅BooksWorkspace.tsx、ShelfPage.tsx、新ShelfDetailView.tsx与verify-reading-ui.mjs；补充本文/QA/DESIGN。调试代码不在候选中。

本轮开始正式HH1/Profiles2/Books15/Storage16，为用户上一轮人工操作后的当前基线，不拿历史13/14回退。包括progress在内全部Book字段、Profiles/Household及Storage元数据指纹前后相同 efe1befc7719215921692219241e7d149eb1b4c279b5e027390034626b2384f5。仅只读查询，无migration/CRUD/Storage操作。仍待再次iPhone验收，两次返回确认无明显空白后逐张显示；未commit/push/amend。

复用用户此前对5C-1同origin候选发布的授权，仅发布本次封面修正。Vercel production READY：dpl_75QJnV7TRBX6bG16zGHc4rU2qSvD，稳定地址仍 https://reading-shelf-ten.vercel.app/。34个审查静态资源全部200/字节一致（保留旧版本hash），SW/manifest MIME与更新缓存头正确；17项静态precache，PWA架构未改，未声称iPhone已经收到/安装更新。145个候选/构建/上传文本secret扫描0命中。发布后正式完整指纹仍efe1befc…一致，15本/16图保持。当前30 modified/6 untracked/0 staged，HEAD仍9107070。本轮测试server/browser均在finally关闭；无调试日志进源码/构建/上传，截图/匿名生命周期/fixture/结果全在ignored qa/，等待本人主动更新及两次往返复验。

## 5C-1 正式人工验收与最终收尾（2026-10-07）

用户本人确认已主动更新到最新候选，在iPhone真机连续两次Shelf→Detail→Back，首屏封面保持显示、不再整片空白后逐张出现，体验正常；未发现新的导航、滚动、表单或档案切换问题。此前阅读进度及其他5C-1项目均已通过，因此本阶段正式验收完整通过。人工确认对应同origin封面修正部署dpl_75QJnV7TRBX6bG16zGHc4rU2qSvD，不使用另一个测试URL替代。

最终根因：原Detail导航销毁Shelf，返回全部BookCover重建、页面淡入重新播放，在iPhone造成明显逐张闪白。同步cached URL先解决async URL空状态，但单独不足；保留当前同档案Shelf的keep-alive修复后，返回复用原img DOM且不重播fade，两次返回的额外BookCover remount从测试中的240降至0。非首屏仍lazy / async，缓存TTL3600秒/提前120秒/in-flight dedupe保持。退出这条路径会释放，不保存多个Profile全页面；未新增图片网络缓存、图片字节缓存、thumbnail或SW Storage cache，原图与2:3/cropPosition完全保持。

证据边界保留：桌面Chromium11张封面200 / Size0 B / disk cache，没有实际完整封面传输；iPhone通过的是视觉与交互验收，没有Network级egress证据，不能写作iPhone已证明0 B。**Thumbnail Recommendation仍为B：书籍达到几十/上百本时再评估。** 本次提交不会顺便建立thumbnail、Offline、IndexedDB或Sync。

人工通过后最终重新运行production build / TypeScript、全部98/98 tests（含PWA14项）、React首次渲染/直接详情/隐藏控件集成，全部通过。主JS654.02kB/gzip193.44、CSS40.72/gzip9.05、backup32.46/gzip11.05；manifest/SW正常、17静态precache1030.47KiB，PWA源码/runtimeCaching未改变。只有既有>500kB及PWA closeBundle耗时提示，不是构建失败；本轮不重新部署或改业务实现。

最终真实远端progress全部通过：新建NULL/35，更新67/0/NULL/1/50/100、状态切换保留；-1/101 INSERT/UPDATE CHECK拒绝，跨家庭不能修改，硬DELETE仍禁止。全部backup兼容矩阵重跑通过：v2五本NULL/0/1/50/100完整恢复，真正旧v1五本全NULL及3张当前原图恢复，1张历史原图保留ZIP；损坏/缺图/未知未来版本、RLS、取消/部分失败/重试/非空重复阻止、字段与原图SHA校验均通过。只用新临时账号/Household，精确清理自身UUID和Storage路径，临时Auth/HH/Members/Profiles/Books/Storage全部0，本次两份活动测试账本已移除；测试邮件域聚合只读复核Auth残留0。用户正式下载文件未读取，正式书房未恢复。

收尾开始/结束正式Household1、Profiles2、Books15、Storage16，包含本人正式使用产生的progress、软删除与封面历史。全部Book字段（含progress）/Profile/Household及Storage元数据一致SHA-256为efe1befc7719215921692219241e7d149eb1b4c279b5e027390034626b2384f5。无正式写入/清空/原图删除或重编码；没有重新执行或修改已部署migration。指纹是字段与元数据复核，不冒称读取了全部正式原图像素。

最终125个候选和build文本secret literal/privileged JWT扫描0，git diff --check通过。30 modified+6新增共36文件均属已验收5C-1，未发现无关/删除/临时调试改动；业务代码与验收候选字节一致，本轮只补五份必要规范/验收文档。QA截图/测试ZIP/JSON/账本、env、Vercel关联与凭据不入Git；无新依赖。独立提交信息为feat: add reading progress and improve cover loading，不amend、不push；最终hash与working tree clean由Git历史及最终回复核对。完成后停止。
