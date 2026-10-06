# 5A · 完整备份、结构化导出与空书房恢复

日期：2026-10-06。实现、自动验证与用户正式 ZIP / JSON / CSV 下载验收均已完成，5A 进入独立正式提交收尾。唯一目标为 reading-shelf / agtkrlpiixniouipwdxr / Tokyo；没有修改 migration、RLS、GRANT 或 bucket 设置。不进入 PWA / Offline。

## 三种文件

| 文件 | 内容与用途 |
|---|---|
| 完整 ZIP | 所有档案（包括归档）、全部 Books（包括软删除）、全部家庭原始封面（包括历史未引用）；迁移与完整恢复 |
| JSON | 同一家庭范围的结构化数据、位置、原始时间、删除历史和原图引用；**不包含图片字节，不是完整备份**，当前没有 JSON 导入 |
| CSV | 中文表头阅读记录表格，含软删除标记；不能用于恢复 |

入口位于现有档案切换菜单 / 手机 Sheet 的“数据与备份”。用户主动导出，在线重新查询全部家庭记录，不使用当前 UI 的分页列表、搜索或筛选结果。未提交表单草稿不属于正式数据，需要先保存再备份。Blob 和临时下载链接只存在本机，浏览器默认下载目录由浏览器控制；应用不指定仓库文件夹、不上传云盘，下载请求发出后撤销 Blob URL。页面只声明“已发起下载”，不能证明磁盘已经保存成功。

## 格式 v1

```text
reading-shelf-backup-YYYY-MM-DD_HH-mm-ss.zip
  manifest.json
  data/structured-data.json
  covers/<old-profile-id>/<old-book-id>/original/<image-uuid>.jpg|png|webp
```

没有重复 profiles.json / books.json。原始图像字节不缩放、不重编码、不裁切，ZIP 使用 STORE。原始家庭 UUID 保存在 metadata 与原图路径中，恢复时重新映射，不拿旧路径上传。

manifest 固定字段：format=reading-shelf-backup、formatVersion=1、createdAt、backupStartedAt / backupCompletedAt、source=supabase、household{id,name}；profileCount、bookCount、activeBookCount、softDeletedBookCount、coverFileCount、referencedCoverFileCount、historicalCoverFileCount；backupIncludes=[structuredData,covers,softDeletedRecords,historicalOriginals]；hashAlgorithm=SHA-256、restoreHistoricalCovers=keep-in-zip、files。

files 每项保存 kind、ZIP 内 path、实际字节 size、实际 SHA-256。cover 项另保存 profileId、bookId、originalStoragePath、originalFilename、mimeType、referencedByBookId。历史图的 referencedByBookId=null；其原始上传名称无法从 UUID Storage 路径可靠恢复，因此 originalFilename=null，不猜测。当前引用图片名称与 MIME 保留。

structured-data.json 固定 format=reading-shelf-structured-export / formatVersion=1 / createdAt / coverFilesIncluded=false：household 保存 name / id 和 originalCreatedAt / originalUpdatedAt；profiles 保存 id / name / sortOrder / archivedAt / 原始技术时间；books 保存 id / profileId / title / author / translator / status / startedOn / finishedOn / rating / notes / cropPosition{x,y} / cover metadata / 原始技术时间 / deletedAt / deletedByOriginal。coverFilesIncluded=false 指这份 JSON 自身没有图片字节，外层 ZIP 中另有原件。

明确白名单构造 DTO，不序列化 Auth User / Session、email、membership、密码、token、管理员凭据或 signed URL。deletedByOriginal 只是历史 UUID，不当作授权关系或跨项目身份恢复。用户笔记原文不会因为包含“password”等词而被篡改。

SHA-256 使用浏览器 Web Crypto 对真实 Uint8Array 计算，逐文件验证 size / hash。manifest 的 SHA-256 作为会话恢复标识；它不包含自己的 hash，避免自引用。校验和是完整性检查，**不是数字签名，不能证明备份来源**。

## Storage 列表与一致性

用普通已认证 SDK 在当前 Household UUID 前缀递归 list，目录和文件都分页100，严格验证 profile / book / original / imageUUID 结构。随后用普通认证 download 原始 Blob，不依赖短期 signed URL。现有 RLS 已实测允许家庭成员列出软删除及历史原件；非成员查询不到另一个家庭。运行时不使用 service_role、不放宽整个桶权限、不执行 Storage.remove。

导出前后分别复读全部数据库行与 Storage 目录，比对原始 revision / metadata。期间改变则拒绝完整 ZIP；任意原图下载失败、缺引用、大小异常都整体失败，不能输出少图片的“完整备份”。这不是跨 REST / Storage 的原子快照；备份时暂停其他设备编辑。未来如需原子快照须另行设计。

## ZIP 库与边界

唯一新增依赖 fflate **0.8.3**，锁定精确版本，MIT，无运行时第三方依赖；安装使用 --ignore-scripts，没有运行远端安装脚本。[官方仓库与许可](https://github.com/101arrowz/fflate)、[发布记录](https://github.com/101arrowz/fflate/releases)。备份页 lazy；ZIP 实现通过 import('fflate') 动态加载，书架首屏不下载 ZIP 代码。[官方解压过滤接口](https://github.com/101arrowz/fflate/blob/master/docs/interfaces/UnzipFileInfo.md)提供原始 name、压缩大小、展开大小、compression。

第一版个人规模上限：ZIP 100 MiB、全部展开数据100 MiB、2,500 entries、结构化 JSON 8 MiB、manifest 2 MiB、单图10 MiB、100档案、2,000书籍。100 MiB 是输入边界，不是峰值内存承诺；打包/解析会同时持有若干字节副本，不做流式下载。达到上限明确拒绝，不能默默少备份。较大文件可能占用较多手机内存，用户可停止；停止在当前网络请求完成/下一步骤发生，同步 ZIP 打包期间不能立即打断。

解压前 filter 拒绝不安全路径、重复文件、未支持压缩方法（只允许 STORE / DEFLATE）、超量 entries、单文件声明过大与累计展开大小超限；库按受限声明大小分配缓冲区。解压后再次验证实际长度、清单全集、hash、JSON exact keys、UUID / 类型 / 字段长度 / 状态 / 日期 / rating / crop / 引用 / 计数 / 归属。拒绝绝对路径、Windows盘符、反斜杠、控制符、空组件、. / .. 和编码歧义。文件只在内存解析，不把 ZIP 路径落到文件系统。浏览器再验证所有原图真实解码。future version、无 manifest、缺文件、损坏 JSON / cover 均在写入前停止。JSON 字段白名单、限长及纯文本 UI 不执行导入脚本或 HTML。

CSV 使用 UTF-8 BOM / CRLF / 所有字段双引号 / 内嵌引号双写，保留逗号和多行短评。字段：档案、书名、作者、译者、状态、开始日期、结束日期、评分、短评、软删除、创建时间、更新时间、有封面；未评分空白。公式前缀 = / + / - / @（包括前置空白和控制符）加单引号阻止 Excel 执行。JSON 保留原文。CSV 不含原图路径、签名链接或 Auth 信息。

## 恢复与时间策略

只支持 **另一个空书房**，必须 owner、全部 Books=0（包括软删除）、Storage对象=0、未归档初始档案数量与备份数量相同。当前正式非空书房始终阻止：“完整恢复需要在空书房中进行。”没有合并、清空、覆盖或智能按同名关联。

bootstrap 已创建的空档案按顺序显式映射到备份档案，预览列出目标空档案名 → 备份档案名，经确认才改名 / sort / archived。新书房与这些空档案 UUID 均不同于原项目；不重复插入档案造成多余数量，不删除空档案凑数。Books 全部生成新 UUID，原图生成目标家庭/档案/书籍下唯一新 imageUUID 路径。报告记录 household / profile / book old→new。当前初始化 UI 恰好两个档案；备份包含其他数量时，需要管理员事先在新空书房准备对应数量的空档案，界面不会自动增删档案。

顺序：全包校验 → 预览 → 明确确认 → 再检查空目标/当前 Auth owner → 恢复书房名称 → 创建 Books → 上传当前引用原图 → CAS 关联原图与原 crop → 恢复软删除状态 → CAS 恢复档案名称/顺序/归档 → 逐图 SHA-256 和数量复核 → 报告。软删除图片先在活跃记录上传后再删标记，遵守既有 RLS。

历史未引用原图一直保留在 ZIP 中，**不会重新上传**；不是垃圾，不删除原项目历史对象，也不自动清理恢复失败留下的原件。原图关联不重置 crop。恢复中 upsert=false、不覆盖原件，metadata 使用 updated_at 条件写入。每步复核当前身份、owner、目标目录和本次记录，意外其他记录或版本变化停止。

既有数据库禁止客户端写 created_at / updated_at / deleted_by，删除触发器生成当下时间。因此不绕过 trigger、不新增迁移：原始业务日期 / rating / crop / notes 等完整恢复；created_at / updated_at 由新服务器生成；软删除 **状态** 保留，新 deleted_at / deleted_by 为本次恢复服务器时间和当前用户。原始 Book 时间在 ZIP 和恢复报告 originalHistory 保存；家庭 / 档案原始技术时间保存在 ZIP。旧 deletedByOriginal 永不写回 FK，不复制会员关系。技术排序使用新恢复创建时间，不能宣称与原始添加时间排序完全相同。

数据库与 Storage 非原子。失败保留 Book / 已上传原件，报告阶段、源记录 ID、成功数量、失败项；同一页面会话持有稳定 ID / 唯一路径 / revision，点击重试只补未完成项，网络响应丢失可核对自己的路径和字段。停止后可同会话继续。完成后禁止同一任务重复执行，重新选同一包也因目标非空被阻止。

**限制：**检查点仅内存，不承诺刷新/退出/换页面后的断点恢复；已保存数据不会删除，刷新后目标非空，必须停止并保留 ZIP / 恢复报告，由后续专门流程处理，不能猜测合并。部分失败时不要离开恢复页；本版本可重试范围是当前页面会话。报告中的 UUID 是映射信息，不是访问凭据。报告仅用户主动下载，不写数据库或 localStorage。

## 灾难恢复操作

1. 妥善保存完整 ZIP 的额外本机副本；JSON / CSV 单独文件不能代替图片备份。不要仅依赖 Supabase 数据库备份。
2. 当原项目不可用，在 Supabase 官方控制台创建新项目（用户授权资源/费用）；部署仓库现有全部 migrations，按4B-3文档建立 private book-covers、MIME和10 MiB限制及既有RLS，保持安全配置。
3. 关闭公开注册，由管理员创建新的正式 Auth 账号；更新本机已忽略的两项公开 VITE 配置，不把高权限 key 放进浏览器。新项目关联与 CLI 管理员操作单独核验，不能盲用旧 ref。
4. 登录新账号，bootstrap 新书房和与 ZIP 数量相同的空档案；不要提前加测试书或封面，不需要复用任何旧 UUID。
5. 打开数据与备份，选择 ZIP；全包校验通过后查看档案映射、Books/软删除/原图数量与历史保留说明，确认恢复到新空书房。
6. 等待恢复报告；有失败保持页面、ZIP和已恢复记录，重试未完成项，不手动清空或覆盖图片。全部成功后下载报告、刷新，核对档案/Books/软删除/crop/当前原图 SHA-256 与清单。
7. 历史未引用原图仍在 ZIP 中供留存；不自动上传。新 IDs / paths 与旧项目不同，技术时间采用上述策略。重新导出一个新环境完整备份后再考虑其他阶段。

本轮没有创建新付费 Supabase 项目、灾难项目或正式恢复，只用已授权目标的隔离临时家庭验证。

## 自动验证与正式人工验收

真实远端隔离 source：2profiles（含归档）、A3/B2共5Books、五状态、译者有/无、null/5评分、日期、短评逗号/引号/换行、非居中 crop、软删除1；JPEG/PNG/WebP三张当前原图+一张历史原图。新空 target 恢复 profiles2 / Books5 / softDeleted1 / 当前原图3，字节SHA、字段、名字、归档、位置一致；IDs/paths全部重映射，历史1仍ZIP。上传失败模拟保留5本，恢复中断及重试不重复。错误包五矩阵在任何写入前失败；跨家庭 RLS 隐私验证通过。管理员只用于临时 Auth创建与精确清理，导出/恢复全程普通认证客户端。

临时 Auth / Household / membership / Profile / Books / Storage 全部精确清理为0；正式 Books版本、删除状态、cover引用与Storage路径/metadata前后指纹一致，正式三张原件没有改变。测试 ZIP、报告、截图仅ignored qa/，不纳入Git；用户正式 ZIP/JSON/CSV 下载只放浏览器默认目录，未经授权未读取。

本地测试覆盖真实ZIP、hash、path traversal、解压前大小限制、未知字段/版本/UUID/归属/crop、CSV、安全空目标、原图下载失败及备份期间变化，全部旧功能回归继续运行。最新具体数量与尺寸结果见 [QA](QA.md)。

用户本人明确确认：完整 ZIP 已实际下载并可正常打开，JSON 已实际下载并可正常打开，CSV 已实际下载且中文与列结构正常；**没有执行正式恢复**。正式下载验收通过。自动工具此前 download 事件超时的记录保留，此次落盘与文件可用性结论来自人工确认；不冒充工具自动验证，不读取用户正式下载内容、不索要正式密码。用户没有确认正式 ZIP 摘要检查，不把临时环境摘要测试写成正式恢复或正式摘要验收。

正式下载验收后按用户要求重新运行最终 build / 全部测试，并只读复核临时残留和正式 Books / Storage 指纹；检查 diff / secret / Git 跟踪文件，创建独立 feat: add complete backup and restore 提交，不amend、不push。最终结果记录于 [QA](QA.md) 和 Git 历史。没有重做远端恢复、没有写入正式 Books / Profiles / Storage，PWA / Offline未开始。

## 5A 完整检查报告

以下合并本阶段实现、隔离测试和正式人工下载验收；不把当前正式书房当成恢复测试目标。

| 序号 | 项目 | 结果 |
|---|---|---|
| 1 | 完整ZIP | 已实现，用户实际下载并可打开 |
| 2 | JSON | 已实现，用户实际下载并可打开；不含图片字节 |
| 3 | CSV | 已实现，用户确认下载、中文与列结构正常 |
| 4 | ZIP库及版本 | fflate0.8.3，MIT，精确锁定 |
| 5 | 动态加载 | 备份页lazy，fflate按需import；书架首屏不加载 |
| 6 | formatVersion | 1；未知未来版本拒绝 |
| 7 | ZIP结构 | manifest.json、data/structured-data.json、covers/profile/book/original/imageUUID.ext |
| 8 | manifest字段 | 来源/家庭/时间、各类数量、包含范围、hash算法、历史策略与逐文件元信息；本文件格式节详述 |
| 9 | SHA-256 | Web Crypto逐文件实际字节size/hash校验；不是数字签名 |
| 10 | 当前引用封面 | 全部纳入，隔离实测3张；正式现有引用1，导出按全家庭读取 |
| 11 | 历史未引用封面 | 全部纳入，隔离实测1张；正式未引用原件2，完整ZIP按prefix全部下载，不读取用户正式包来冒充逐图人工验收 |
| 12 | 软删除Books | 纳入全量导出、恢复保留删除状态；隔离实测1 |
| 13 | signed URL | 不导出、不持久写入；备份普通认证download原件 |
| 14 | Auth凭据 | 明确DTO白名单排除User/Session/email/token/password/管理员key/membership |
| 15 | Storage list | 普通认证、HH UUID前缀递归、100分页、严格路径检查，跨家庭不可读 |
| 16 | 新migration | 无；没有扩大RLS或GRANT |
| 17 | 大小限制 | ZIP/展开各100MiB、单图10MiB、JSON8MiB、manifest2MiB、2500文件/2000书/100档案 |
| 18 | traversal | 拒绝绝对路径、盘符、反斜杠、控制符、dot组件与编码歧义，纯内存解析 |
| 19 | ZIP bomb | 解压前检查entries/单文件/累计originalSize，解压后验证实际长度/hash；测试通过 |
| 20 | JSON schema | exact keys、UUID、类型/长度、枚举、日期、rating/crop、归属/引用/计数完整检查 |
| 21 | CSV字段 | 档案/书名/作者/译者/状态/开始/结束/评分/短评/软删除/创建/更新/有封面 |
| 22 | Excel中文 | UTF8 BOM、CRLF、正确转义、公式防护；用户确认中文/列结构正常 |
| 23 | ID remapping | old→new完整映射；不复用源UUID，不智能同名合并 |
| 24 | Household | 映射到另一个已bootstrap的空家庭，恢复名称，不复制Auth/membership |
| 25 | Profile | 预览并复核同数量新空档案的UUID/revision，确认后恢复名字/顺序/归档 |
| 26 | Book | 新UUID，会话内稳定映射与重试，不覆盖已确认版本 |
| 27 | 封面路径 | 新HH/Profile/Book/imageUUID，upsert=false，原始字节不改 |
| 28 | deleted_by | 原actor仅deletedByOriginal历史，真实FK由服务器记录当前恢复者；不复用跨项目身份 |
| 29 | 正式非空HH恢复 | 禁止，既有Books含软删除或Storage非0即阻止；未执行正式恢复 |
| 30 | 临时空HH真实恢复 | 三轮矩阵通过；最终包含中断/重试/预览版本/外部名称冲突 |
| 31 | Profile数量 | 源2→目标2，含归档，不额外制造占位档案 |
| 32 | Books数量 | 源A3/B2共5→目标5，失败后重试无重复 |
| 33 | 软删除 | 源1→目标1；状态一致，技术删除时间/actor由新服务器生成 |
| 34 | cropPosition | 源非居中x/y→目标相同值，不因封面关联重置 |
| 35 | cover SHA-256 | JPEG/PNG/WebP三个当前原件恢复后的hash与ZIP逐一相同 |
| 36 | 历史恢复策略 | 历史1留ZIP，目标只上传当前3；不清理源正式旧图 |
| 37 | 损坏JSON | hash/解码/schema拒绝，远端写入0 |
| 38 | 损坏cover | 改字节后hash拒绝；浏览器另做真实图片解码 |
| 39 | 缺文件 | 缺manifest声明原图时拒绝，写入0 |
| 40 | 不支持版本 | future version拒绝，写入0 |
| 41 | 无manifest | 拒绝，写入0 |
| 42 | 临时数据清理 | Auth/HH/member/Profile/Books/Storage精确清理0；最终只读复核及旧ledger各项残留0 |
| 43 | 正式Books指纹 | 版本/删除状态/原图引用与5A开始一致，未写入任何正式记录 |
| 44 | 正式Storage指纹 | 路径/创建更新时间/metadata与5A开始一致，3原件保持；不删除不覆盖 |
| 45 | 正式ZIP人工下载 | 用户确认实际下载且正常打开，未代读下载文件 |
| 46 | 正式JSON人工下载 | 用户确认实际下载且正常打开 |
| 47 | 正式CSV人工下载 | 用户确认实际下载，中文与列结构正常 |
| 48 | 390×844 QA | 备份页/摘要无横向溢出，长文件名换行；实际首屏JPEG在ignored qa/ |
| 49 | 1366×768 QA | 页面/摘要操作可用且无溢出；1920补查也通过 |
| 50 | frontend-design | 保持文学杂志/纸色/既定字体/细分隔内容行，无看板或新视觉体系 |
| 51 | ui-ux-pro-max | 48px触控、进度/停止、禁重复、错误与危险确认、取消默认焦点/Escape返回；200%工具未生效不冒充通过 |
| 52 | bundle变化 | 主JS634.87→637.07kB，gzip187.27→188.16；独立backup32.07/gzip10.88，ZIP12.37/gzip6.10；既有>500k提示 |
| 53 | 新依赖 | 整个5A仅fflate0.8.3；本次最终收尾没有再安装或更新依赖 |
| 54 | build | 正式下载验收后重新执行，类型与production build通过 |
| 55 | unit tests | 66/66通过（原46+备份20），无失败/跳过 |
| 56 | integration tests | 既有repository/服务回归和三轮隔离真实导出恢复矩阵通过 |
| 57 | remote restore | 普通认证SDK真实写临时目标、字段/数量/hash复核通过；本次收尾仅SELECT，不再恢复 |
| 58 | secret/Git文件扫描 | 已跟踪文本与新文件扫描0；备份ZIP/JSON/CSV/qa/真实env不跟踪，五个配置JSON不误认备份 |
| 59 | commit | 独立feat: add complete backup and restore，不amend、不push；完整hash由最终回复及Git历史提供 |
| 60 | final git status | 提交后再次检查，以最终回复的working tree clean结果为准 |
| 61 | 已知限制 | 100MiB内存打包非流式、非跨服务原子、旧技术时间仅历史保留、当前页面会话重试、无JSON导入；200%/真机/读屏未实测 |
| 62 | 阶段边界 | 没有PWA/Service Worker/IndexedDB/Offline/云盘定时备份/自动orphan cleanup，5A后停止 |
