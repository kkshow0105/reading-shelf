# 5B · PWA 安装与手动确认更新

正式验收：2026-10-07。用户本人确认5B PWA真机通过：A→B不自动刷新、主动确认更新、只刷新一次/无循环、Auth Session保持及关闭重开正常。Version B的最近阅读排序、iPhone统一中文字体、自然比例封面、完整大图、三字段家庭历史联想一并通过，首页2:3保持。[稳定HTTPS地址](https://reading-shelf-ten.vercel.app/)不变。本轮仅验证与独立正式提交，不amend、不push，不进入后续功能、封面优化、thumbnail、Offline/IndexedDB/Sync。

以下保留阶段过程记录；其中“待验收/不提交”等描述指当时状态，当前以本段及末尾正式收尾记录为准。5B包含已正式验收的五项Version B改进。

## 已实现

- vite-plugin-pwa **2.0.0**（锁定 devDependency），generateSW / prompt。使用官方 Workbox 管理构建 hash/revision 与静态缓存，不手工维护缓存版本或重写缓存框架。所有原有包版本未变；本轮未再次安装依赖。
- `dist/manifest.webmanifest`：name / short_name = 私人书架，description = 记录阅读，也收藏时间。，lang = zh-CN，id / scope / start_url = `/`，display = standalone，不锁定 orientation。theme_color / background_color = `#F4F0E8`。
- 普通 B2 192/512 只声明 any；新增 maskable 192/512 单独声明 maskable。Apple 180、favicon 32 与16/32/48帧 ICO 接入 HTML。冻结原图及普通资源字节未变。
- maskable 只机械等比缩小完整 B2、添加外围深绿背景，无重绘/裁切。512 中原图占288×288、偏移112，最远角距203.647px < 安全半径204.8px；192 中占108×108、偏移42，最远角距76.368px < 76.8px。完整方形均在安全圆内。`python scripts/export-maskable-icons.py --check` 可验证像素及安全区；已有资源不会自动覆盖。
- iOS meta：web-app-capable=yes、title=私人书架、status-bar-style=default；标准 mobile-web-app-capable=yes。viewport-fit=cover；沿用 Header / Sheet safe-area，standalone footer 避开底部手势区，不重复增加顶部padding。主题沿用原逻辑，初始深色纸背景有系统偏好fallback。
- 安装入口仅在支持且未standalone时出现，位于页脚/手机档案Sheet，不主动弹广告。Chromium由用户点击真实beforeinstallprompt；iPhone/iPad说明 Safari → 分享 → 添加到主屏幕。用户本人iPhone安装/standalone/关闭重开已验收通过；Android/Chromium真实安装未冒充已测。

## SW / 缓存边界

输出 `dist/sw.js` / `dist/workbox-778a14ff.js`，注册 `/sw.js`、scope `/`、updateViaCache=none。dev模式不注册，生产要求HTTPS（localhost例外）。QA独立使用127.0.0.1:5185，不污染5173开发origin。

precache **17项 / 1018.39 KiB**：HTML shell、hash JS/CSS、四份本地字体、正式运行图标及manifest。`runtimeCaching: []`，不忽略query，不给supabase.co配置任何运行时缓存。无用户原图、Books/Profiles数据、Auth/REST/realtime/Storage响应、signed URL、ZIP/JSON/CSV备份或Blob下载缓存。

导航回退只匹配 `/` 与 `/index.html`，hash页面使用当前active SW对应的HTML/JS。新部署安装新的revision集合、waiting后由用户确认切换，避免旧HTML混用新chunk。生产部署应让HTML/manifest/sw.js可重新验证，hash文件可immutable且保留旧文件一段时间，供其他未刷新窗口的lazy chunk使用。尚未选择或修改托管配置。

## 更新 / 草稿保护

集中在 `src/pwa/update.ts` / `PwaProvider.tsx`，状态idle/checking/updateAvailable/updating/error。启动检查，前台每60分钟及重新可见时按同一间隔节流。

只有真实waiting且存在旧active/controller才提示新版本；首装短暂waiting误提示已在真实测试中修复并增加回归测试。没有版本字符串猜测更新。

点击更新 → 检查busy/草稿 → 必要时明确确认输入可能丢失 → waiting SW收到SKIP_WAITING → 等待该worker的controllerchange → reload一次。无自动skipWaiting，首次claim或其他窗口更新不刷新本页。consent/reloaded页内guard防双刷新，新文档没有旧consent。15秒激活超时撤销consent，迟到激活不触发刷新循环。错误只用固定中文，不输出session/token/原始错误/signed URL。稍后只在当前页面内存，不永久忽略。全部旧窗口关闭后，浏览器自然激活waiting属于标准生命周期。

BooksWorkspace检查dirty、保留草稿、mutation/退出/撤销；App级guard覆盖登录失效后仍保留的会话草稿。登录/初始化aria-busy禁止更新，表单输入要求确认。备份进行中禁止更新，恢复预览/未完成报告要求确认。确认弃稿并激活后才跳过重复beforeunload；普通刷新保护保留。updating内容inert，避免继续输入。

## 上轮真实A→B验证（本轮不重跑）

生产构建/官方Workbox、本地隔离HTTP；不登录、不写正式数据。QA helper只给构建副本加A/B标记和诊断，真实应用JS/SW执行lifecycle，不mock updateAvailable。

1. A首装registered/controlling，无更新误提示，无自动reload。
2. B真实waiting=installed；页面仍A、visits=1，测试输入仍在。
3. 点击更新弹确认，继续操作可取消；Enter可打开，Escape后最终页面恢复。最终焦点返回补充代码尚未再次浏览器复验。
4. 明确确认后进入B：visits=2（更新只刷新一次），controllerChanges=2（首装+更新），waiting=none，registrationCount=1。
5. cacheEntries=17、forbiddenCacheEntries=0；最终记录保留于ignored `qa/pwa-lifecycle-result.json`。该最终快照的probe=not run是刷新后状态，不能当作快照本身已测网络。
6. 更新前匿名GET实测Auth/Books/Profiles返回401，非法测试signed Storage URL返回400；同源网络计数前进，违规缓存为0。这是网络/缓存边界验证，不是正式登录或正式图片下载验收。

本轮只复核上述结果及当前构建。末次App级保留草稿guard追加由本轮typecheck/build验证，不冒充重新完成浏览器lifecycle。

## 恢复检查 / 确定性验证（2026-10-07）

- 保留全部修改，无reset/checkout/clean/restore/amend/commit/push。开始时9个已跟踪文件modified，另有两张maskable、两个脚本和src/pwa三文件untracked，无staged/deleted。
- 5173/5174/4173/5185均未监听，未发现对应Node dev/preview/QA/test进程；Edge/Codex及其他Node runtime保持原样，不关闭未知进程。
- production build及TypeScript通过；unit/service tests **80/80**（原66+PWA14），无失败/跳过。
- 构建集成检查通过：manifest字段/图标尺寸/PNG读取，HTML链接，17项precache白名单及真实revision，SW/Workbox输出，冻结B2字节/ICO帧，原依赖版本及数据代码未改。真实浏览器集成沿用上轮，不重新触发更新。
- 主JS644.56kB/gzip190.53（5A637.07/188.16），backup32.14/gzip10.93，CSS38.13/gzip8.59；Workbox15242bytes，SW2210bytes。保留既有>500kB提示；插件closeBundle耗时约17.6秒提示，构建正常结束。
- 本轮不访问或写入Supabase，不新增migration/RLS/Storage设置；diff和secret扫描结果见QA checkpoint。

## 未完成 / 人工验收

前轮CSS viewport390×844、1366×768更新提示无横向溢出，手机确认按钮可见。已有登录态开发页的档案/三列书架/详情/封面/添加/编辑只读检查无溢出；备份页当时只看到加载占位，不能判定完成。ignored qa/有截图；部分截图接口输出像素与CSS viewport不同，不声称全部PNG恰好为指定尺寸。

200%快捷键未实际改变字体/DPR/视口，记为工具限制。最终确认焦点、安装说明、1920×1080、standalone真实安全区、生产登录态/封面/备份下载及OS安装仍待补验。本轮不重试同一浏览器超时接口，不改业务代码规避工具问题。

Version A现已部署：在iPhone Safari打开固定HTTPS地址安装，检查B2图标/名称、无地址栏、安全区、本人登录与关闭重开Session、书架/详情/编辑/备份；不索取密码。只有用户回复“Version A真机验收完成”后才能准备同origin的B，再验收保留旧页→提示→点击→新页。Android若无真机，圆形/大圆角/水滴预览仅属模拟验证。A/B均人工确认后才最终提交。

只有静态shell缓存，断网Supabase功能不保证可用，不宣称完整离线阅读；未做IndexedDB、离线写入、队列、后台同步或Push。

## 调试

生产验证用build/preview；dev不注册SW。DevTools → Application → Service Workers检查指定origin的scope/waiting/controller。重置前保存草稿并完成备份/恢复，只注销待检查origin的SW。Clear site data会清除登录状态等，仅在隔离QA origin使用。`scripts/pwa-qa-server.mjs`仅本地QA，不发布到正式站点；本轮不自动重启。

## Version A HTTPS 部署准备 · 2026-10-07

用户授权从当前未提交工作区部署独立Vercel项目，使用稳定vercel.app origin；不连接Git、不commit/push/amend，不准备Version B。开始时仍为13 modified / 8 untracked / 0 staged。

只读确认：项目无既有vercel.json或.vercel关联；当前hash导航不需要SPA通配rewrite。.env.local仅包含所需前端URL/publishable key，目标ref正确，未输出值。Vercel CLI 62.5.0通过官方npm npx缓存使用，不加入项目依赖；whoami报告Logged out，已启动官方浏览器登录流程，用户本人授权，未要求聊天密码/token。

已新增vercel.json（Vite、dist、HTML/SW/manifest需重新验证、hash资源immutable，无rewrite），并忽略.vercel/，避免本机关联/预构建文件入Git。Version A production build成功，输出与当前候选应用一致，没有为制造版本变化修改应用。构建中无QA注入、真实env文件或高权限key literal。

以上是登录前准备记录；本人登录后已完成下述Version A部署。正式Books/Profiles/Storage/Household和Supabase schema均未触碰。

## Version A HTTPS 部署结果 · 2026-10-07

- 官方CLI确认用户kkshow0105，唯一可用Hobby scope为kkshow-0105-s-projects。先检查已有项目，reading-shelf不存在；独立创建并仅把本目录link到reading-shelf。Sleep Sounds等已有项目无操作，未连接Git，也没有commit/push/amend。
- 稳定生产地址：**https://reading-shelf-ten.vercel.app/**。deployment ID：dpl_HBMP7vY3HhDz2FBH79Tek6w8WNEv，READY。随机部署地址只用于追踪，不用于iPhone A/B验收；后续B必须继续使用固定地址。
- Production仅设置VITE_SUPABASE_URL和VITE_SUPABASE_PUBLISHABLE_KEY，值由本地已批准配置通过stdin提交，不打印/写入命令参数。用户无需另行在Dashboard设置这两个变量。CLI link自动附加的VERCEL_OIDC_TOKEN行已精确移除，原前端配置保留；CLI新增的冗余.env*忽略规则已移除，保留原.env.example例外与.vercel/忽略。
- 从当前未提交工作区build得到A，没有制造APP_VERSION或UI变化。通过官方Build Output API v3静态产物与deploy --prebuilt --prod发布：只上传26个静态文件约2.7MB，文件字节与dist一致。上传副本不含源码/env/CLI认证/正式数据，历史合成covers资源只从上传副本排除，项目public/dist原件保留。headers由vercel.json落实到预构建config，hash路由无需通配rewrite。
- 无认证普通HTTPS实测：首页/manifest/SW/Workbox/普通192/512/maskable192/512/Apple180/favicon32/ICO均200，Content-Type正确、字节相同，没有静态请求被HTML吞掉；root/HTML/SW/manifest no-cache/no-store/must-revalidate，hash资源immutable。固定production alias没有额外Vercel登录层，不使用bypass token。报告保留ignored qa/vercel-version-a-http.json。
- 普通浏览器未登录页显示正确；刷新正常，访问hash档案深链接仍显示登录，控制台无应用warn/error。没有登录用户正式账号，不显示demo或跳过Auth。
- 以批准的publishable key做匿名只读网络/CORS检查：Auth health200、Books/Profiles401、非法测试Storage URL400，CORS允许生产origin，没有暴露正式记录，没有读取正式图片或任何写入。结果保留ignored qa/vercel-version-a-anonymous-api.json；这不代表正式Auth Session/封面/备份真机验收完成。
- 部署SW字节与本地同一产物，scope配置为/、无Supabase runtime cache。当前浏览器工具read-only evaluate不暴露navigator.serviceWorker，调用一次即停止；**生产实际registered/controlling状态未自动确认**，不能把脚本200当作注册成功，需要iPhone验收。本地真实A→B结果仍保留；未在生产注入QA探针、修改UI或再部署B来规避限制。
- 等待用户本人“Version A真机验收完成”。此后才另行准备B。尚未执行iPhone安装、正式Session、真机safe-area或真机A→B；本阶段仍未提交。


## Version A人工确认 / Version B候选（2026-10-07）

用户已明确确认Version A iPhone真机验收正常；允许将五项已确认改进作为真实B：最近阅读状态分组、iOS统一中文字体、详情/编辑自然封面、Dialog大图、三字段家庭历史建议。无额外测试版本标记；目标仍固定https://reading-shelf-ten.vercel.app/。A部署产物已保存在ignored qa/deployed-version-a，工作区不提交。

字体根因实测：四个本地WOFF2均仅512字符；漂/朋/友/挪/森/虫缺失，亮存在，使同一段逐字混用Noto与系统fallback。无unicode-range策略补齐未包含字形的能力。iOS切换整个字体栈为完整系统中文字体，PC栈不变，不新增字库。依据CSS font matching规则（https://www.w3.org/TR/css-fonts-3/#font-matching-algorithm）；Safari实际computed/rendered字体仍需本人真机确认。

全部92项测试通过（原80+排序6+联想6；过时最近阅读断言按新规格调整，最早语义保留）。production build/TS通过，主JS650.48kB/gzip192.47、CSS39.79/gzip8.88、backup32.14/gzip10.93，17项静态precache；manifest与A字节相同，SW因真实功能hash变化而不同。无新增依赖/schema/RLS/Storage/Backup行为。

只读实际页面QA：390×844三列、1366×768六列，封面比1.5/cover保持；真实1080×1548封面在手机160×229.33、PC240×344自然显示，编辑比例也一致。大图src与详情同一signed URL、contain、body滚动锁、关闭/Esc/焦点返回已验证。新增/编辑三个字段点击与上下键Enter/Escape、外部关闭、48px选项、字段独立、继续编辑保留草稿及丢弃测试草稿已验证。没有按保存或更换/移除封面。iOS字体及真实触摸/软键盘仍待本人验收。截图位于ignored qa/version-b-*.png；滚动/动画下部分截图出现sticky合成层伪影，DOM核对Header top=0且候选在视口内，未改正常代码规避。

在新隔离origin127.0.0.1:5186用已部署A与真实B重做SW集成：A controlling，B waiting=installed，A visits1且输入保留；确认前未激活，明确确认后B visits2/controllerChanges2、单一registration、waiting none、缓存17/违规0。两尺寸更新提示无横向溢出。记录qa/version-b-sw-waiting.json/result.json；这是本地真实SW，不冒充iPhone已验收B。

正式数据前后只读元数据SHA保持f8e172c2cf04c437b8c753ea5737a5d929261331896924a73e8f84d61b8f11af：Books12（界面正常11）、Profiles2、Household1、Storage13。临时UI输入仅会话草稿且已丢弃，未建立测试账号/远端记录/图片，正式数据无写入。secret literal扫描123个源码/文档/build文本0命中；部署前继续检查最终产物，不打印任何凭据。

当前完成本地候选验证，准备部署同origin B；部署成功后只等待PWA更新及B功能人工确认，不commit/push/amend，不进入Offline/IndexedDB/Sync。保留A旧hash资源，以免其他未刷新的窗口丢失lazy chunks。更新机制仍有60分钟检查节流，不能声称发布后手机立即自动检测；实际生产/iPhone waiting与提示需本人确认。


## Version B部署结果（2026-10-07）

production READY：dpl_85sSdLPoLVNBfF7gm3gVRsoUGuUD，固定origin仍为https://reading-shelf-ten.vercel.app/。只上传审查后的静态产物，旧A hash资产保留以支持未刷新的窗口；无源码/env/认证文件/正式数据/历史demo封面/QA探针上传。未改其他Vercel项目、未连接Git。无登录HTTPS复核HTML、manifest、新SW、Workbox及图标均200且MIME/字节正确；旧A BackupPage chunk仍可取。证据qa/vercel-version-b-http.json。

本地真实SW已经发现B并验证waiting/单次更新；生产新SW可访问，但工具不能读取用户iPhone registration，不能声称手机已经发现B。继续用已安装的A等待提示，不用Safari刷新替代更新；原60分钟检查节流保留。等待本人PWA更新+B功能验收后才最终Git收尾，当前不commit/push/amend。


## 5B正式人工验收与最终收尾（2026-10-07）

用户本人明确确认5B PWA正式真机验收通过：A→B正常，不自动刷新；出现提示后主动更新，只刷新一次且无循环；Auth Session保持，完全关闭重开正常。最近阅读状态分组、iPhone中文字体统一、自然比例详情封面、首页2:3保持、大图、新增/编辑三字段家庭历史联想均通过。本次独立5B正式提交一并包含已验收的五项Version B修正。

人工确认后重新运行production build/TS、全部92项unit/service tests，均通过；新的5190隔离origin重新执行真实生产A→最终B SW集成：A visits1/controlling，B waiting installed，未提交测试输入保留；明确确认后B visits2/controllerChanges2、单一注册、waiting none、缓存17/违规0。记录在ignored qa/5b-final-sw-waiting.json/result.json；没有重发线上版本或登录正式账户。

manifest/普通any图标/专用maskable/Apple180/MIME引用、17项静态precache/revision、message-only skipWaiting及prompt策略重新检查通过。maskable完整B2方形处于安全圆内，像素导出一致。无Auth/REST/realtime/Storage/signed URL/备份Blob运行时缓存；dev SW禁用。最终build与已部署B字节一致，主JS650.48kB/gzip192.47、CSS39.79/gzip8.88、backup32.14/gzip10.93、静态缓存1025.80KiB，仅既有>500kB提示，无新依赖。

上一轮自动B开发检查前后为Books12/Storage13且指纹f8e172...一致；正式人工验收完成后的本轮开始已为Books13/Storage14，变化发生在两次自动检查之间，不将其归因于自动测试，也不删除/回退现状。本轮开始/结束Household1、Profiles2、Books13、Storage14的完整元数据SHA均为8010651514757df4176dbeaa3105366cf6697a1a846cde3c5040f619b12bf107。本轮仅SELECT复核，没有正式写入、临时Auth/记录/封面、恢复或清理。指纹核对版本/删除/引用及对象metadata，不假称重新读取了全部原图像素。

图标冻结、HTML/部署配置、PWA更新保护、Version B改进、测试及必要文档归入独立提交feat: add installable reading shelf PWA；不amend、不push。Git最终hash与clean状态由最终回复/历史给出；真实env、Vercel本机关联/预构建、qa截图/结果与任何凭据不入Git。最终secret/diff审查结果记录于完成检查后。

正式真机验收来自用户确认；历史200%/Android/截图工具限制不伪称已补测。本轮没有阅读进度、封面性能优化、thumbnail、Offline、IndexedDB或Sync；完成后停止。

最终预提交secret literal/session扫描覆盖124个源码/文档/配置/build文本，0命中；真实env、.vercel、qa及备份不入Git。diff --check通过（仅CSS换行规范提示），全部候选为已验收5B/Version B范围，未见无关/删除改动；原依赖版本未变。独立提交后以Git历史与最终回复确认hash及working tree clean。
