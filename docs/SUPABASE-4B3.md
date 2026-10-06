# 4B-3 · private Storage 原始封面

2026-10-06。从干净基线a0a6b8d7a58f85679e7d688bd2118876e19229e0开始。唯一目标reading-shelf / agtkrlpiixniouipwdxr / Tokyo。自动实现 / 测试 / 实际视觉验收及正式人工封面验收完成；正式图片由用户本人选择，按用户要求独立提交收尾，不进入下一阶段。

## 文件与路径

只允许JPEG / PNG / WebP、非空、最多10485760字节（10 MiB）。浏览器在保存前验证MIME、头部与实际Image.decode，检查自然宽高大于0；错误用安全中文，伪JPEG实际已拒绝。服务再检查头部 / 大小 / MIME；Node测试的服务头部校验不冒充浏览器完整解码。新文件只通过File/Blob处理，不读EXIF、不压缩、不转码、不裁切；下载SHA256与上传File原字节一致。

book-covers已存在且private，限制10MiB及三种MIME，没有改bucket、RLS或GRANT。路径 `<household_id>/<profile_id>/<book_id>/original/<全新UUID>.<jpg|png|webp>`；扩展名从验证后的MIME取值，原文件名仅存cover_original_filename。每次上传新UUID、upsert=false、contentType明确、cacheControl=3600；不使用原文件名或固定original.jpg作key。

数据库仍用CLI生成Database类型派生。记录只保存相对path、原始filename、mimeType及归一化{x,y}；signed URL和blob URL均不进入Book / DB。Scope来自已验证Household / Profile /真实Book，上传前读取对应未删除记录；路径和mapper检查三个UUID归属，后台RLS仍是安全边界。

## 保存、替换和失败

新建先createBook（无封面）→服务器确认id/revision→上传原始File→用新建返回revision关联cover metadata。Book成功但上传 / 关联失败时，不删除或回滚Book，返回部分成功；UI转到同一本书编辑，持续提示书籍已保存而封面未完成，保留文字、File和本地预览供重试，不制造第二条记录。关联冲突保留输入，提示主动载入，不强制覆盖。

编辑换图采用先上传新path，再一次conditional PATCH同时写文字+metadata+center。上传失败不PATCH；上传成功而DB冲突 / 失败，旧引用 / 原图保留，新文件允许orphan。网络结果未确认时不宣称数据库一定没有变化；保留输入并重试或载入。普通编辑保留旧path / metadata / cropPosition。移除只清空三项metadata并居中，不删除文件。

全部更新用原始updated_at，不经Date丢失微秒。保存期间字段 / 按钮锁定，无精确百分比；等待Book+cover处理到明确结果才退出saving。替换永不覆盖或先删旧图；soft delete / restore保留封面。运行时没有Storage.remove / orphan cleanup / 永久删除。只有明确授权的临时测试清理通过管理员Storage API精确移除测试路径，不直接DML storage.objects。

实际连续添加三本发现已完成的新建UUID仍被复用，导致第二本误报conflict；已在成功确认后退役该UUID，真实UI连续三本复测通过，已有记录未覆盖。失败未确认的新建仍保留原请求UUID以恢复丢失响应。

## 展示与生命周期

统一cover service生成3600秒signed URL，内存缓存按path，剩余120秒刷新，in-flight Promise去重。缓存实例属于当前Auth user / Household；退出 / 卸载清空，旧请求不能回填，新身份不继承。URL只存在显示层缓存和img source，不放入Domain Book、不写localStorage / 文件 / 日志 / 备份。签名是短期bearer能力，已签链接在过期前不能保证随退出或membership撤销立即失效。

Books先显示元数据和固定占位，再异步加载图片。单本签名失败使用placeholder，30秒可重试；图片错误允许一次强制刷新，其他记录不受影响。书架2:3 / cover及object-position由cropPosition决定；默认0.5/0.5，换图 / 移除居中，普通编辑保留。详情 / 表单contain完整原图，预留框避免布局跳动，没有拉伸或永久裁切。

选图只在本机解码和预览，不上传。解码临时URL在finally释放；表单预览在换图 / 卸载释放。草稿按user/household/profile/book隔离，仅保留会话File，回来重新创建URL。刷新无法恢复File，beforeunload保护未保存输入；没有base64 / IndexedDB / Service Worker / offline queue。

## 验证

- production build通过；JS634.87kB / gzip187.27kB，相比4B-2增加约6.9kB；既有大于500kB提醒保留，不为此重构。
- 46/46 unit / repository tests通过，新增9项cover测试覆盖MIME/扩展名、大小 / 头部 / 解码失败、原字节 / URL释放、创建部分成功、上传后的CAS冲突、单PATCH文字+引用、移除 / 位置保留、TTL近过期 / 命中 / 去重 / 失败重试 / 身份清理。
- scripts/verify-covers-remote.mjs真实临时账号验证：JPEG/PNG/WebP真实上传 / 下载SHA256 / relative path / 原始filename / private签名读取，外人sign/download/insert拒绝，public URL不可读，duplicate/upsert覆盖拒绝，非图片/SVG/超10MiB拒绝，替换保留旧字节、旧revision冲突保留引用与orphan，软删 / 恢复可读、移除不删原图、新建封面拒绝仍保留Book。全部通过且Auth / Household / Profiles / Books / Storage已精确清理。
- 实际临时UI：伪JPEG、SVG、超10MiB拒绝；正常预览 / saving / 新建三格式、现有编辑显示、换图与文字保存、刷新、并发冲突取消保留File和输入 / 主动载入、删除 / undo原图显示、两档案隔离、单本缺图fallback（3条记录仍显示、2图正常、1占位、无整页alert）均已操作。
- 390×844实际三列为106×159，gap16，无横向滚动；两列仍可用并恢复三列。1366×768六列、封面180×270、保存首屏可见；1920×1080七列，无横向溢出。八张真实首屏截图在ignored qa/，已核对像素尺寸和视觉，无调试面板、残留弹窗或焦点遮挡。
- signed URL缓存近到期刷新用可控时钟单元测试验证，不宣称等了一小时；UI上传网络中断 / partial success未强行注入，采用service / integration失败测试，不冒充浏览器故障验收。
- 键盘返回按钮Tab到保存正常。五次Ctrl+=未改变实际宽度/DPR，不能宣称完成200%放大；真机、屏幕阅读器、手机键盘遮挡仍未测试。

## 安全与后续边界

UI测试在另一端口退出后精确清理所有临时原件 / 历史图 / orphan及业务 / Auth记录，当前两个测试ledger不存在。人工验收前正式档案一正常1条、档案二软删除1条、两档案cover引用数0；当前正式结果见下节。来源依赖图43个本地模块无mock，仅公开URL / publishable两项VITE配置；无运行时Storage.remove、secret literal或私有文件跟踪。

不新增依赖、migration、表 / policy / GRANT；generated Database未手改。高权限key仅在临时测试进程内存，浏览器只用URL / publishable key；.env.local、qa截图 / fixtures / ledger ignored。signed URL不进Git、文档、snapshot或完整日志。正式书籍、正式软删除记录与用户上传文件不进入临时清理名单。

完整备份未来须包含原始Storage文件，DB备份 / 相对path / 临时URL不等于完整原图备份。旧图 / orphan历史与清理留后续专门设计。没有PWA、离线、备份UI、AI/OCR/ISBN或CDN，不进入下一阶段。正式人工验收已完成，收尾同步数量与结果、检查diff/secrets，独立提交，不amend、不push。

## 正式人工验收与对象数量

用户明确回复“正式封面验收完成”，确认本人选择图片完成指定流程，包括保存、书架2:3 / 详情完整显示、刷新 / 再登录、更换比例、删除 / 撤销和档案隔离。模型未代选私人图片、未读取正式密码，收尾未重复编辑、删除、恢复任何正式记录或文件。

只读核对：正式Auth 1、Household 1、owner membership 1、Profiles 2；档案一正常Book 1、当前cover引用1、Storage对象3；档案二正常Book 0 / 软删除1、cover引用0、Storage对象0。正式名字、UUID、图片文件名、path、签名链接及私有内容不写入Git文档。

全项目Storage对象3，其中1个被当前Book引用，另外2个为当前未引用的保留原件。每次上传 / 替换生成新UUID路径、旧文件不覆盖不删除，所以Storage对象数量多于当前封面数属于预期，不凭数量认定异常或自动清理。当前未引用对象的具体历史 / orphan分类留后续专门设计，本轮全部保留。

收尾重新运行production build、46项unit / repository测试与真实远端Storage / RLS / Books+Cover集成矩阵。测试仅使用新的临时UUID并排除所有正式书房；完成后核对临时残留及正式Book版本 / 删除状态 / 封面引用和Storage对象元数据的前后指纹。指纹只在会话内存比较，不生成私人数据备份或输出原件内容。

最终build及46/46测试通过。远端收尾首次复跑在替换阶段失败，原始异常为避免敏感URL / token未保留，原因无法确定；临时清理成功。验证脚本随后增加固定断言标签 / 安全错误类别诊断，没有改变业务代码、RLS或正式数据；全套重新复测通过并精确清理。不能将首次失败说成通过，也不猜测其网络原因。

正式Book版本 / 删除状态 / cover引用与全部Storage对象元数据的前后指纹完全相同。最终仍为Auth 1 / Household 1 / membership 1 / Profiles 2 / 正常Book 1 / 软删除Book 1 / Storage对象3。临时Auth账号0；旧4A.5 ledger明确cleaned，按其UUID复查Auth / Household / Profile / Book / membership / Storage残留各0；当前测试ledger均不存在。没有删除正式照片或修改正式记录。

### 逐项验收报告

| 项目 | 结果 |
|---|---|
| 1. 真实封面上传 | 已实现并通过本人正式验收 |
| 2. 格式 | JPEG / PNG / WebP |
| 3. 文件上限 | 10485760字节，10 MiB |
| 4. 实际解码 | 浏览器Image.decode；伪JPEG真实拒绝 |
| 5. 原始字节 | File直接上传，真实下载SHA256一致 |
| 6. 自动压缩 / 转码 | 没有 |
| 7. path | household/profile/book/original/新UUID.ext |
| 8. 唯一路径 | 每次上传新UUID，文件名不用作key |
| 9. upsert | false；覆盖权限亦拒绝 |
| 10. 新建流程 | 先Book无封面→上传→以服务器revision关联 |
| 11. Book成功封面失败 | Book保留；编辑页首屏持续提示，File/输入供重试 |
| 12. 上传后DB失败 | 旧引用 / 原图保持，新文件允许orphan，不自动删除 |
| 13. 编辑流程 | 先上传→一次CAS PATCH文字+metadata+center |
| 14. 并发保护 | 原始updated_at不丢微秒，冲突不覆盖 |
| 15. orphan可能性 | 跨服务无法原子事务，可能产生 |
| 16. orphan策略 | 保留，后续另行设计，不自动清理 |
| 17. 替换旧图 | 保留，不覆盖 / 不先删除 |
| 18. soft delete | 不删除原件 |
| 19. restore | 原封面仍可读取；自动及本人验收通过 |
| 20. cropPosition | 归一化0～1；新图/移除居中，普通编辑保留 |
| 21. 书架比例 | 严格2:3，手机3张均106×159，cover |
| 22. 详情 | contain完整原图，预留区不做永久裁切 |
| 23. signed TTL | 3600秒，提前120秒刷新 |
| 24. URL持久化 | 不写DB、Book、localStorage或文件 |
| 25. URL cache | 当前认证书房内存Map，path+expiresAt，退出清理 |
| 26. 并发去重 | 同path in-flight Promise去重 |
| 27. 签名失败 | 单图placeholder，记录照常显示，可重试 |
| 28. object URL | 解码finally释放；预览换图 / 卸载释放，会话File重建 |
| 29. JPEG | 真实Storage / 原字节 / UI通过 |
| 30. PNG | 真实Storage / 原字节 / UI通过 |
| 31. WebP | 真实Storage / 原字节 / UI通过 |
| 32. 非图片 / SVG | 拒绝；伪JPEG、SVG实际UI拒绝 |
| 33. 超10MiB | service及实际UI拒绝 |
| 34. outside越权 | sign / download / insert拒绝，public URL不可读 |
| 35. overwrite | 同path重复及upsert覆盖拒绝 |
| 36. replace | 新引用+文字一次更新，旧字节不变 |
| 37. replace conflict | 旧引用保持，新文件保留，输入不丢 |
| 38. 临时数据 | 当前及历史测试残留均0，正式文件未清理 |
| 39. 正式人工验收 | 用户明确确认完成，模型不代选图片 |
| 40. 档案一封面 | 当前引用1，所属Storage对象3；真实名字对应见最终回复 |
| 41. 档案二封面 | 当前引用0，Storage对象0，原软删除Book保留 |
| 42. Storage总数 | 3；当前引用1，未引用保留原件2，数量增加符合设计 |
| 43. 手机QA | 390×844书架 / 本地预览 / 详情 / 编辑实测与截图通过 |
| 44. PC QA | 1366×768四页通过，1920×1080七列补查通过 |
| 45. frontend-design | 原图承担色彩；沿用字体/tokens/版式，无重新设计 |
| 46. ui-ux-pro-max | 选择 / 拒绝 / saving / 冲突 / 回退 / 隔离 / 键盘已查；故障注入限制见前节 |
| 47. migration | 没有新增或修改 |
| 48. 依赖 | 没有新增，lockfile未变 |
| 49. build | 最终通过；既有634.87kB chunk提醒保留 |
| 50. unit | 全部46/46通过 |
| 51. Storage tests | JPEG/PNG/WebP/private/字节/覆盖/旧图保留最终复测通过 |
| 52. RLS tests | 外人拒绝、private不变，不扩大policy/GRANT |
| 53. integration | Book+Cover创建/更新/失败/冲突/软删/恢复通过 |
| 54. secret | diff及literal扫描未发现真实secret/签名token，私有文件未跟踪 |
| 55. commit hash | 独立正式提交；完整hash见最终回复或git log |
| 56. git status | 提交后核对，以最终回复为准，不push |
| 57. 已知限制 | 初次收尾远端失败原因未确定、后复测通过；chunk提醒、200%放大/真机/读屏未完成；一小时刷新用时钟测试，UI网络故障/partial success未强行注入 |
| 58. 阶段边界 | 未进入PWA / Offline / Backup，完成后停止 |
