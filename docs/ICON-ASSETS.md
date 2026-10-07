# Reading Shelf · B2 正式图标资源

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
