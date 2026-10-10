# 双主题阶段 5C · 背景优化与发布预检

日期：2026-10-10。基线：qa/nocturne-iphone / f3e5f7ab1d9d5f1aaded747f594e19ff705e848c。
用户确认阶段 5B iPhone 三批共16项通过；这是用户真机反馈，本轮没有重新执行真机测试。
后续验收：用户已确认阶段5C背景通过iPhone截图验收，并授权在阶段5D独立提交这三个文件。下文“待验收/不提交”为5C执行时的历史状态；截图通过不自动代表线上同源PWA更新或极端存储故障通过。
本轮仅本地夜航背景修改与明确授权的 CLI Preview，不提交、不推送、不部署 Production。

## 原因与实现

旧 Preview 实际计算样式显示 html 的两层 radial-gradient 正常生效，body、root 与书架容器均透明，没有覆盖背景。旧上层 #7C9CC4 仅10%/4%，下层 #33517A 仅12%/4%；720～800px 半径用于390px手机时，横向色差小、两片大范围叠加，容易接近纯色。没有发现证明 Safari 丢弃渐变的证据；桌面 WebKit 渲染正常，不等于直接调试用户 iPhone Safari。

只改 src/styles.css 的夜航根选择器及夜航限定的≤640px变量；DESIGN.md 同步这一段参数，本报告记录验证与风险。

| 项目 | 新值 |
| --- | --- |
| 基色 | #0B1322，保持不变 |
| 上方光斑 | #7C9CC4；22% → 8%（38%处）→ 透明（74%处） |
| 下方光斑 | #33517A；32% → 10%（42%处）→ 透明（78%处） |
| 桌面 / tablet | 半径720×560px，中心85% 96px；半径800×620px，中心8% 560px |
| 手机≤640px | 半径420×360px，中心92% 120px；半径460×420px，中心0% 600px |

两个静态、不重复、随文档滚动的 html 画布渐变；不按长书架高度百分比定位，首屏位置不会因藏书数量改变。超过光斑扩散范围后自然回到深墨蓝，不在长页循环装饰。没有背景图片、动画、固定覆盖层、伪元素、滤镜、will-change 或新增 DOM；安全区仍由原画布底色覆盖。玻璃组件、封面、字体、业务、持久化与 PWA 源码未修改。

## 验证

- package.json 对应的全部104项测试通过；TypeScript --noEmit通过；生产构建及PWA生成通过，17项静态precache。verify-reading-ui封面/签名缓存/keep-alive检查通过。
- 本机 npm入口与默认临时目录曾被沙箱权限阻断，使用相同Node测试入口及项目内ignored临时目录完成；没有安装依赖。既有主JS超过500kB提示仍存在。
- 复用阶段4.5测试设施，在ignored副本中以当前f3基线比较；夜航仅取消背景改变必然触发的PNG相等断言，暖纸计算样式/全屏PNG及手机两列PNG仍严格比较。Chromium、WebKit各8例：390×844、768×1024、1366×768、1920×1080，两主题全部通过。
- 测试涵盖主题切换保留Shelf DOM/900px滚动、无新增读取/签名、导航后Sheet关闭/焦点、前进返回、档案隔离、本地编辑草稿离开保护、200%文字和三列/两列；无横向溢出、页面异常或外部数据请求。测试数据完全隔离，禁止远端写入。
- 生产CSS语义比较：除了夜航根画布变量/渐变，1,472条其余声明与旧Preview一致。未生成文档误触发的 .backdrop-filter 工具类；原Tailwind docs排除保留。
- 暖纸PNG和组件计算样式在两引擎四尺寸均与已验收f3基线一致。早期交互式全属性采样只发现主内容初始焦点outline-offset差异，因此最终以等待动画结束、同状态的既有基线测试为准，没有更改暖纸规则。
- WebKit390px边缘空白像素：上部(370,130)由RGB(21,31,48)到(34,47,67)；下部(5,600)由(15,26,43)到(24,39,61)。自然淡出区仍接近底色；桌面亦有增强。封面/字体/尺寸计算值未改，正常图片无新增滤镜。
- 保守假设两层中心最大透明度同时叠加，主文字对比约8.69:1、次级约4.96:1，均超过普通文字4.5:1；实际两个中心分离。此计算不是所有页面完整可访问性认证。
- 无新增持续绘制机制；桌面交互/滚动回归未见故障。iPhone5C新背景的实际可见度、长页触控流畅度与发热仍需本人验收，不以桌面WebKit代替真机性能。

## 截图与证据

均为真实运行的App/组件，不是设计模拟图。qa目录ignored，截图不入Git、不上传部署。

| 内容 | 路径（项目相对路径） |
| --- | --- |
| 隔离书架手机夜航前/后 | qa/theme-stage5c/local-night-before-390x844.jpg；local-night-after-390x844.jpg |
| 隔离书架桌面夜航前/后 | qa/theme-stage5c/local-night-before-1366x768.jpg；local-night-after-1366x768.jpg |
| 暖纸同两尺寸前/后 | qa/theme-stage5c/local-warm-before-{390x844,1366x768}.jpg；local-warm-after-{390x844,1366x768}.jpg |
| 精确像素尺寸WebKit夜航前/后 | qa/theme-stage5c/regression-webkit/dark-baseline-{390,1366}.png；dark-normal-{390,1366}.png |
| 精确尺寸暖纸对照 | qa/theme-stage5c/regression-webkit/light-baseline-{390,1366}.png；light-normal-{390,1366}.png |
| 旧在线真实书架 | qa/theme-stage5c/live-night-before-{390x844,1366x768}.jpg；live-warm-before-1366x768.jpg |

JPEG由浏览器内容导出，测试视口为要求尺寸，但导出像素不一定包含滚动边界；精确390×844/1366×768验收文件请看regression-webkit中的PNG。隔离书架使用已有合成记录和原创测试封面，不是正式书籍；WebKit基线用例使用统一测试封面。JSON证据包括regression-{chromium,webkit}/navigation-layout-result.json、webkit-background-pixels.json、contrast-bound.json、production-storage-result.json和postdeploy-result.json。

## 新 Preview 与线上边界

- [新候选](https://reading-shelf-blejgf1gd-kkshow-0105-s-projects.vercel.app)
- Deployment ID：dpl_EKuaC23EcjQcnX37cDY2x31mMjpF；READY。
- 同一reading-shelf / prj_X02GZv5skGa6S4SROqIkcf44fIFj。官方CLI明确deploy --target=preview --prebuilt；标准API的Preview target为null，没有Production alias。使用未提交本地CSS，不把HEAD误称为包含本次背景修改的提交。[官方CLI说明](https://vercel.com/docs/cli/deploy)
- 只读取同项目现有Preview两个公开Supabase变量，并在内存核对与Production来源一致；没有配置/复制其他密钥，没有输出变量值，没有修改任何环境项。不使用service_role。
- 共享正式Supabase，非隔离数据库，非技术只读角色；在线仅允许主题、登录与只读访问。部署只上传审核过的21项静态文件，不上传源码/env/QA/截图/StyleKit原件。
- 正式仍为dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv；reading-shelf-ten.vercel.app等正式alias、Git关联、访问保护和全部环境元数据均未变。166个已跟踪文件在构建/部署期间哈希不变；七份参考原件不变。构建后仅更新本次设计文档/报告。
- manifest字节与旧Preview完全相同；生成SW仅正常更新precache资源名称/摘要，其他策略逻辑一致，没有修改manifest或SW源配置、更新流程或强制缓存版本。
- 新域名已通过已有Vercel会话打开实际登录页，默认暖纸、CSS/字体/manifest路径正常；切夜航并刷新保持夜航，切暖纸并刷新保持暖纸，捕获error/warn为0，桌面无横向溢出。新origin没有旧Supabase登录会话，未搬运token/私密存储；已请求本人登录以补充在线书架截图，登录后结果如有完成另行追加。此时不声称新候选书架在线通过。

## 发布风险结论

| 风险 | 判断与建议 |
| --- | --- |
| SDK条件性白屏 | 本轮生产包本地五种故障复验仍重现：theme键异常与整个storage getter异常可显示登录；单独SDK debug键或全部getItem抛错但写入可用，模块求值白屏；会话键异常显示连接失败且SDK有拒绝日志。根因仍为锁定auth-js在顶层读取supabase.gotrue-js.locks.debug，早于React恢复错误边界。一般浏览器允许读取，不能从写入探测证明所有iPhone模式正常；5B真机通过表明常规路径正常，不能排除此人工故障。属于条件性P1，正式发布前需明确接受兼容边界或另行授权最小修复；本轮不改SDK/认证、不吞错误。 |
| PWA在线更新 | 单元测试和此前本地A→B等待/取消/确认/单次刷新通过。5B16项通过按用户报告记录，但用户仍明确指出线上更新未完成，本轮新随机域名也不是旧PWA同源更新。需另行授权受保护稳定Preview同源两版本验收（取消保持草稿、确认单次刷新、会话/主题/档案保持），不改正式站点来测试。属于发布验收缺口，不是已经确认的线上故障。 |
| 静态启动颜色 | manifest仍#F4F0E8，夜航运行时theme-color仍#211F1B，页面底色#0B1322；可能出现暖色启动/浏览器栏色差。5B已由本人验收，若可接受则非功能发布阻断。建议保持默认暖纸静态色；若要求改栏色，另行明确范围，不承诺动态manifest解决iOS启动画面。 |
| 新背景与发布条件 | 没有发现本轮引入的普通路径P0/P1；可以进入5C iPhone视觉复验。暂不作无条件正式发布结论：新背景待本人验收，SDK条件性P1尚未明确接受/解决，线上同源PWA更新待验收。主JS体积提示为已有性能提醒，非本轮新阻断。 |

本人下一步只需在新Preview核对：上右/下左两处柔和光斑、手机三列/两列及封面文字、长页滚动、Safari与主屏幕冷启动下的背景效果。书架只读；不保存/删除/上传/恢复正式数据。验收通过前不提交本轮代码，不推进正式发布。
