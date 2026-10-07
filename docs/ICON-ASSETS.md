# Reading Shelf · 正式图标资源

## V2 · 当前正式图标（iPhone正式验收通过）

**Current production icon = V2。** 用户最终确认的唯一源图为“奶油白 + 蓝色层叠书页”。本轮只做工程导出与接入，没有AI重绘、重新解释设计、裁切、配色、文字、边框、预画圆角、主体重排或锐化。页面主色与主题保持既有暖纸色；图标蓝色不成为新的UI token。

源图实际1254×1254、RGB、不透明PNG，完整解码正常，目视没有画布白边、展示背景、文字或九宫格残留。原始字节归档SHA-256：`48c5e0de5710512e55ce1e7e700e88106f0cdf7cc799c380ed87ec6cd97ec104`。1254仅向下LANCZOS缩至1024母版，没有放大冒充高清；所有普通尺寸和ICO帧均从同一1024母版直接等比导出。

| 文件（项目相对路径） | 规格 | 用途 |
|---|---|---|
| public/icons/source/reading-shelf-icon-v2-source.png | 1254×1254 RGB PNG，原始字节 | 用户正式源图归档，不入manifest/precache |
| public/icons/reading-shelf-v2-1024.png | 1024×1024 RGB PNG | 唯一导出母版，不入manifest/precache |
| public/icons/reading-shelf-v2-512.png | 512×512 RGB PNG | manifest普通purpose=any |
| public/icons/reading-shelf-v2-192.png | 192×192 RGB PNG | manifest普通purpose=any |
| public/icons/apple-touch-icon-v2-180.png | 180×180 RGB PNG | HTML Apple touch icon，原构图无安全框/二次圆角 |
| public/icons/favicon-v2-32.png | 32×32 RGB PNG | HTML PNG favicon |
| public/icons/favicon-v2.ico | 16×16、32×32、48×48三帧 | HTML传统favicon，各帧像素与母版等比缩放一致 |
| public/icons/reading-shelf-v2-maskable-512.png | 512×512 RGB PNG | 独立purpose=maskable |
| public/icons/reading-shelf-v2-maskable-192.png | 192×192 RGB PNG | 独立purpose=maskable |

maskable是技术适配：完整1024画面分别等比缩为272/102，居中偏移120/45；中心画面每个像素与对应LANCZOS结果完全相同。外围只延续原图边缘颜色，离边界越远越柔和，保留左暖奶油/右蓝及原有明暗方向；没有新图案、黑白硬边或主体修改。普通图标没有因此同步缩小主体。

按照[W3C安全区](https://www.w3.org/TR/appmanifest/#icon-masks)，中央安全圆半径为边长40%；完整内图方形最远角落距安全圆还留512版12.47px、192版4.68px。安全圆、circle、Android rounded-square及大圆角四种机械mask均未裁掉内图任何部分；外围延展可由系统裁切。预览在ignored qa/icon-v2-maskable-preview.png，不是资源本身，不冒充Android/iPhone真机结果。

脚本`scripts/export-icon-assets-v2.py`使用本机已有Pillow，不安装任何依赖、不联网；只接受已确认源图hash，拒绝覆盖既有V2输出。`python scripts/export-icon-assets-v2.py --check`可复验源图、全部尺寸/RGB/像素等比关系、ICO帧、safe-zone和mask。qa/icon-v2-native-sizes.png包含192/180/32/16原生大小预览；192/180层叠书页清晰，32仍能辨认，16细节自然减少但无异常黑边/halo，不为小尺寸重绘。

正式接入只改变vite.config.ts的icons/includeAssets和index.html三条图标link。manifest为V2普通192/512的any与专用192/512的maskable，name/short_name/start_url/display/theme_color/background_color/id/scope保持不变。HTML仅一条ICO、一条PNG和一条Apple180，无重复旧声明；旧B2不再在当前manifest/HTML/precache正式入口引用。现有revision构建纳入七个V2运行图标，不手工编辑Workbox cache、更新机制或runtimeCaching；Supabase/Storage/signed URL缓存边界不变。

**iOS安装图标可能保留旧缓存。** 正式验证时可能需要删除旧主屏幕PWA，再用Safari打开https://reading-shelf-ten.vercel.app/并“添加到主屏幕”。这是图标缓存行为，不修改业务代码绕过。用户先确认当前数据无异常；此处删除的是安装入口，不是云端Books/Storage，仍应避免丢失未保存会话草稿。本人真机验收前不commit/push/amend，不能将机械预览写作真机通过。

### V2工程检查与同origin部署 checkpoint

production build/TypeScript、98/98 unit/service tests及导出脚本--check均通过。manifest静态字段/引用/尺寸/purpose与HTML检查正常，build没有manifest/icon warning；保留既有JS>500kB和PWA closeBundle耗时提示。PWA仍17项静态precache1030.48KiB，七个运行图标全部V2，源图和1024母版未加入precache；用户主动确认更新机制及Supabase/Storage/signed URL runtime cache边界完全保持。旧B2和所有src业务/依赖/数据库文件的baseline hash不变。

允许部署后使用既有reading-shelf Vercel项目发布：dpl_J14KFaRdQgJ6f4xar3xC7idhg8wv / production READY。稳定地址https://reading-shelf-ten.vercel.app/不变，43个静态文件包括九个V2资源全部200且与本地字节一致，PNG/ICO/manifest MIME及SW/manifest更新缓存头正确。历史图标和旧hash assets仍可访问，仅作为历史/旧客户端兼容，不在当前manifest/HTML/precache正式引用。无新的测试origin、业务数据/封面上传或依赖安装。

部署前/后正式HH1/Profiles2/Books15/Storage16、全部字段（含progress）及对象元数据SHA-256均为efe1befc7719215921692219241e7d149eb1b4c279b5e027390034626b2384f5；仅SELECT核对，没有Auth/Books/Storage/迁移写入，也未执行任何恢复。139个候选/实际上传文本secret扫描0命中，diff --check通过。开始clean，现6 modified/10新增文件/0 staged，HEAD仍1e7a846；新增仅源图、八个派生资源和导出脚本。等待用户确认“V2图标正式验收完成”后才最终提交feat: replace reading shelf app icons，不amend/push。本段是自动工程/资源交付结果，不表示iPhone/Android安装通过。

### V2正式人工验收 · 2026-10-08

用户本人确认在iPhone真机重新添加主屏幕后，V2奶油白/蓝色层叠书页显示正确，小尺寸清晰、比B2简洁，无额外白边、二次圆角/外框、异常裁切，构图和颜色正常；PWA打开及现有功能正常。正式结果来自用户人工确认，不是静态预览或桌面模拟。B2继续完整保留为历史设计资产，生产manifest/HTML/precache只引用V2；iOS缓存/重新添加说明仍保留，Android不冒称完成真机验收。

本轮按用户授权进行独立图标提交feat: replace reading shelf app icons，并将已存在的5C-1提交1e7a846与图标提交从当前main正常推送到指定的现有远端，不amend、不新建分支、不force push。开始检查发现本地没有任何Git远端或upstream配置，已向用户请求现有仓库地址；先完成确定的本地收尾，推送目标不猜测。最终验证及推送结果见下方补记或Git历史/最终回复。

最终重新build/TypeScript、98/98 tests与导出--check通过；1024/512/192/180/favicon PNG与ICO16/32/48/maskable逐像素和安全区验证均通过，manifest/Apple/favicon只用V2，17静态precache及主动确认更新策略不变。所有业务/数据库/依赖与B2旧资源hash未变，没有新增依赖或重新部署。130个候选/build文本secret扫描0、diff --check通过；源图SHA仍48c5e0de…，正式完整数据指纹仍efe1befc…（1HH/2Profiles/15Books/16Storage，含progress），与部署后记录一致。QA/env/测试备份/本机关联不入Git，原B2历史不删除。提交/远端结果及最终clean由Git历史与最终回复核实。

## B2 · 历史第一版正式图标

下面完整保留B2的原始源图、导出方法、生成prompt和5B验收证据。旧assets/branding源文件与public/icons普通/maskable/Apple/favicon字节均不改、不永久删除；它们不再是当前生产入口的图标方向。

**5B正式验收 · 2026-10-07：** 冻结的普通图标/Apple/favicon字节未变，HTML已接入。新增maskable-512/192为同一B2完整构图机械缩小并加外围背景；512内图288、偏移112，192内图108、偏移42，整个内图均落在半径40%的中心安全圆内，像素复核通过。manifest普通图标仅any、专用版本仅maskable；iPhone正式安装/主屏幕体验已通过，Android未冒充真机验收。模拟预览位于ignored qa/pwa-maskable-preview.png；可用scripts/export-maskable-icons.py --check复核。当前状态见[5B](PWA-5B.md)。

下面保留2026-10-06的图标归档基线；其中“当前没有接入/后续接入”的表述指归档当时，现阶段以上述5B checkpoint为准。

定稿：2026-10-06，用户确认 B2 为正式图标基线（左侧木书架、右侧阅读坐榻、通往坐榻前沿的木梯、暖吊灯、下层少量绿植、深森林绿背景）。只沿用最初九宫格左下方案，不采用其余八个方向。上层没有盆栽阻挡休息区，无文字、复古印章或额外装饰。

本次完成图标资源与接入建议，不启用 PWA，不创建运行中的 manifest / Service Worker，不改变书架视觉、页面色彩 tokens、Auth、Books、Storage 或数据库。index.html 仍使用原有 /bookmark.svg，下面的接入片段供后续明确授权时使用。

## 文件与用途

| 文件 | 实际尺寸 / 格式 | 用途 |
|---|---|---|
| assets/branding/reading-shelf-b2-source.png | 1254×1254、RGB PNG | 用户选定的生成原图，原始字节完整保留，不公开作为运行时图标 |
| public/icons/reading-shelf-1024.png | 1024×1024、RGB PNG | 正式主图及后续资源源图 |
| public/icons/reading-shelf-512.png | 512×512、RGB PNG | 普通App/PWA图标，purpose=any |
| public/icons/reading-shelf-192.png | 192×192、RGB PNG | 普通App/PWA图标，purpose=any |
| public/icons/apple-touch-icon-180.png | 180×180、RGB PNG | Apple touch icon |
| public/icons/favicon-16.png | 16×16、RGB PNG | 极小尺寸检查 / 回退 |
| public/icons/favicon-32.png | 32×32、RGB PNG | 浏览器favicon建议首选 |
| public/icons/favicon-48.png | 48×48、RGB PNG | 高密度favicon资源 |
| public/icons/favicon.ico | 内含16/32/48三档 | 传统浏览器favicon兼容回退 |
| qa/icon-b2-sizes.png | 780×300、PNG，Git忽略 | 192/180/48/32/16原生像素尺寸对比，不作正式资源 |

Vite public目录文件使用 /icons/filename.png URL，不把 public 写进URL。原图保存在assets/branding，避免仅存在Codex缓存；不将1024或1254主图放入manifest首选列表，减少不必要的下载。没有外部图片地址，也没有安装应用依赖或压缩库。

尺寸导出使用本机已有 Pillow 12.3.0 的 LANCZOS。每档都从同一张1254原版一次等比缩小，避免多次级联缩放；不是重新生成，也没有裁切、调整灯光或重绘细节。PNG保持不透明RGB、完整方形、深色背景，没有预画圆角，最终外形交给系统处理。master1024是精确尺寸导出，不把原始1254文件伪称1024。

生成原图SHA-256：`1d86fab12257d80b8fd179c69fd47aca21945ff9add97074ebfbb2ac0808065b`。

## 小尺寸检查与favicon建议

已实际查看原生192、180、48、32、16像素预览：192/180能辨识房屋轮廓、吊灯、靠垫、书架和梯子；48/32以房屋与暖光作为识别中心；16不承诺细小书脊/植物/梯级仍可辨认。直接使用32PNG与多尺寸ICO作为第一版favicon；不要把1254图直接交给每个浏览器自行缩到16。以后若确需专门的16px简化版，应保留B2的屋形/灯光特征，单独审查，不另换图标方向。

没有做真实iOS/Android安装效果测试；图片尺寸、RGB、不透明和ICO帧集合已验证，不能把静态预览当作系统安装验收。

## maskable建议

**现有512/192图标只标purpose=any，不能直接标any maskable。** 现有主图主体接近画布边缘；系统圆形裁切可能损失屋顶或下部木梯。

5B PWA阶段需要基于B2制作独立的512×512（可另导出192×192）maskable安全区版本：保持B2所有室内元素，仅增加同色深绿背景留白并缩小/居中主体，使屋顶、书架、坐榻、梯子都落在中央安全圆内。安全区是中心位于画布中心、半径为边长40%的圆；对512图半径为204.8px。可先以原构图约62%的画布占比试排，再实际检查主体边界，不能仅凭占比宣称合格。背景覆盖全画布且不透明，不预画圆角。依据[W3C maskable安全区](https://www.w3.org/TR/appmanifest/#icon-masks)。

专用文件建议命名 /icons/reading-shelf-maskable-512.png，purpose单独写maskable。当前没有生成/注册该文件；未来导出后要用安全圆、圆形、圆角方形和更强裁切逐一检查，确认没有丢失主要元素，再增加manifest条目。不能引用尚不存在的资源。

## manifest与Apple接入建议

当前没有创建manifest。这是以后manifest中的 **icons字段片段**，不是完整可安装PWA配置，不在本轮初始化生命周期、启动路由或离线策略。sizes写资源的真实尺寸，普通图标明确purpose=any；参见[MDN icons说明](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)。

```json
{
  "icons": [
    {
      "src": "/icons/reading-shelf-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/reading-shelf-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

后续新增PWA时才增加manifest link；后续应用图标接入时替换现有bookmark.svg favicon链接为下面两项，并加入Apple项（原SVG文件不需删除）。Apple使用独立的apple-touch-icon link，不能只依赖manifest列表。参见[Apple官方Web App图标说明](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)。

```html
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="/icons/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
```

这些路径对应当前部署在站点根目录的Vite配置。未来若部署到子路径，应统一调整base与资源URL，不硬编码某个阅读档案UUID作为启动页。图标的深绿只用于图片背景；页面theme-color继续由既有视觉体系和后续PWA设计决定，不顺带替换暖纸色。

## 来源与导出复现

使用内置imagegen生成并局部修改，用户明确选定B2；没有调用外部CLI图像模型、付费API脚本或其他生成服务。定稿输出原文件名exec-e8ff9156-df35-48e4-9826-54dc582b8ef1.png；项目保存的source与其SHA完全相同。

最后一轮B2编辑的完整prompt（reference为独立B图，不是九宫格）：

```text
Edit this exact standalone Reading Shelf icon. Make ONLY this localized architectural change: replace the two broad solid timber step blocks at the LOWER RIGHT in front of the green reading seat with a simple practical small wooden ladder. Completely remove the solid block steps. The ladder has two oak side rails and THREE clearly separated horizontal rungs, matching the house timber material, with a slight natural lean toward the elevated seat. It starts on the lower base/floor and terminates directly at the FRONT timber platform edge of the right-hand reading bench, just below its green cushion: climbing it should lead naturally onto the reading/resting spot. No ladder through cushions, no rails rising above the seat cushion into the sitting space, no floating disconnected ladder, no oversized stair blocks remaining. Keep the ladder within the original icon bounds and make the access relationship legible at app-icon size. Preserve the original pitched-roof house outline, full left bookshelf and all books, bottom-left potted plant, right-side green sofa/bench and ivory pillow, bronze pendant and warm lighting, forest-green opaque background, palette, wood/fabric finish, composition and front-facing perspective. Do not redesign any other area or add objects. One square standalone image, no collage, no typography, no border, no white margin.
```

尺寸/格式导出工具scripts/export-icon-assets.py只做等比缩放、PNG/ICO打包和静态预览，不联网、不生成新构图；使用现有Pillow，不加入package依赖。已生成的正式文件不会被脚本自动覆盖，再次导出需显式准备新版本文件名/目录。以后修改构图需再次由用户确认，不因为导出重新用AI生成不同细节。

## 正式资源归档检查 · 2026-10-06

用户再次确认B2定稿后归档：全部PNG解码、真实尺寸及RGB格式通过；每档像素与同一B2原图直接LANCZOS等比缩放结果一致，ICO的16/32/48帧同样通过解码与像素比对。原图SHA-256保持上述值。diff空白检查与secret静态扫描通过，production build（TypeScript检查及Vite）通过，仅有既存的大于500kB chunk提示。本轮仅资源/文档归档，没有修改应用入口、依赖、缓存或业务代码，没有创建manifest、注册Service Worker或添加安装功能；没有进入5B。未新增系统安装或页面渲染验收。
