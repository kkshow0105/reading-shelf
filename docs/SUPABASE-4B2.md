# 4B-2 · 真实 Books 接入

2026-10-06。唯一目标仍为 reading-shelf / agtkrlpiixniouipwdxr / Tokyo。本阶段自动实现、测试与正式人工验收已完成；指定尺寸视觉 QA 受浏览器工具阻塞，按用户明确授权记录限制后收尾提交。不进入 4B-3。

## 正式运行边界

App 挂载 BooksWorkspace，不 import PrototypeApp / mock 数据工厂。第三阶段独立原型保留用于历史参考。正式记录使用 UUID，两个真实 Profile 不按姓名或同名书合并，不 seed 数据，失败不会回退到示例。

查询由固定 Household / Profile 的 service 经 repository 发起。列表每页 100 条，循环读取全部正常书籍；每页显式 household_id、profile_id、deleted_at IS NULL。详情同时限定 Household / Profile / UUID，跨档案深链接显示无法打开，不错误标成当前档案。

搜索（包含译者）、状态 / 星级 / 年份筛选、五种稳定排序继续使用既有纯函数，作用于真实当前档案全量列表，不为每次筛选请求数据库。空日期 / 空评分置末，id 最终稳定排序。

## 类型与写入

Database Row / Insert / Update 从 CLI generated database.types.ts 派生，文件未手改。既有 mapper 处理五种状态、rating NULL、date-only 字符串、空译者 / 短评、原始技术时间、删除 actor 和 cover metadata。cropPosition 为 {x,y}，0～1，默认 {0.5,0.5}。普通编辑不修改 Storage metadata、原图引用或位置。

保存采用同步点击锁 + saving、禁用表单，等待服务器成功后使用返回记录更新列表 / 详情、清理当前草稿并导航。失败保留输入、恢复按钮、显示安全中文；不输出 SDK 原始错误。新建草稿拥有稳定 UUID，丢失成功响应后的同内容重试可取回原记录；不同内容不得覆盖已提交内容。

更新、软删除、恢复都使用服务器原始 updated_at（不经 Date 转换）做条件 PATCH，零行视为 conflict。服务器触发器记录真实 deleted_by 和更新时间。普通流程不发 hard DELETE、不删除封面。撤销使用软删除响应的新 revision，跨档案切换也只恢复原归属，不混入当前列表；恢复冲突要求重新载入。

冲突对话框提供取消 / 重新载入；取消保留输入，重新载入成功后才替换草稿与 baseline，不做强制重试覆盖。临时 UI QA 发现并修复编辑成功后详情仍用旧记录的问题，现直接采用写入响应。列表初次请求被 mutation 打断时补读完整列表，避免遗漏其他记录。

## 草稿与认证

草稿只在会话内存，以 user / household / profile / record 隔离并保留旧 revision。切换 / 返回提示，刷新有未保存提醒；没有 localStorage Books、IndexedDB、Service Worker 或同步队列。登录失效时草稿暂留当前内存，仅同一身份可恢复；主动退出必须明确放弃草稿。组件卸载使旧请求 token 失效，旧身份 / 档案异步结果不能继续写 UI。

## 封面与安全

封面选择禁用并说明“封面将在下一阶段启用。”新记录 cover_original_path 为 NULL，使用原有占位；不写 blob/base64/本地路径，不上传或运行时加载 signed URL。既有 2:3 / cover / contain / 非破坏性位置规则保持。

没有依赖、schema、migration、RLS、GRANT、网络或其他项目变更。浏览器只使用 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY；管理员 key 只在测试进程内存，qa ledger 仅临时 UUID，qa/ 和 .env.local 忽略。正式用户创建的记录不能由临时清理工具删除。

## 已完成验证与限制

- 全部 37 项 unit / repository tests 通过（新增 11 项 Books 专项）；production build 通过。
- 真实远端临时账号验证：空 A/B、CRUD、相同标题独立、跨档案详情拒绝、NULL/date/crop、稳定新建 UUID、双客户端 CAS、soft-delete actor、删除后 revision undo、undo conflict、跨家庭 RLS / FK、匿名 / hard DELETE 拒绝；全部通过，本轮远端测试 fixtures 已精确清理。
- 真实 UI 临时档案：添加 → saving → 详情、只有完成日期、译者 / 评分 / 短评、档案独立、译者搜索、保留草稿离开并恢复、另一设备修改后冲突取消 / 重新载入、再次编辑详情立即更新、清除评分、删除确认 → 真实空架 → 撤销恢复均已操作。
- 当前浏览器实际 1280×720。viewport 设置多次超时，不能用此尺寸替代要求的 390×844 / 1366×768。四张实际首屏和冲突截图在 ignored qa/；八张指定尺寸截图仍待完成。真机、200% 放大、读屏、本轮浏览器离线 / auth-expiry 注入未实际完成，纯函数与请求守卫测试不冒充完整 UI 测试。
- JS 627.97kB / gzip184.72kB，相比 4B-1 约584kB / gzip173kB 增加约44kB；仍有既有 500kB chunk 提醒，按授权不为此重构。
- 用户回复“正式 Books 验收完成”，确认本人操作的正式流程完成（添加 / 详情 / 编辑、两档案隔离、删除 / 撤销）。模型未代填正式书籍或读取正式账号密码；只读核对数量，保留全部用户记录。收尾时再次运行 build、37 项测试与真实临时账号远端矩阵均通过；独立提交，不 push，不进入 4B-3。

## 正式验收收尾

用户本人验收完成后，只读核对：正式 Auth 1、Household 1、owner membership 1、未归档 Profile 2。档案一 1 条正常 Books、0 条软删除；档案二 0 条正常 Books、1 条软删除。正式名称 / UUID / 书名 / 笔记不写入 Git 文档。用户的软删除记录按最终状态保留，未擅自恢复或清理。Storage objects=0，两档案的 cover_original_path 非空数均为0。

按用户要求再次尝试 viewport.set({width:390,height:844}) 和 viewport.set({width:1366,height:768})，各等待20秒均超时；最后 reset 也等待15秒超时。两次尺寸尝试后只读 DOM 仍为619×672、documentWidth604、字体loaded、浅色。没有用 CSS、业务代码、截图裁切、浏览器安装或其他网络 / 系统改动规避工具问题；不能宣称八张指定尺寸截图或这些尺寸的实际布局 QA 通过。按用户授权如实保留限制后完成 Git 收尾。

最终远端临时账号验证全部通过并精确清理，qa/books-remote-ledger.json 和 qa/household-ui-ledger.json 不存在。正式入口依赖图和生产 bundle 检查排除 PrototypeApp / mock Books，现有 Storage 工具仅为4A准备代码，不在正式 UI 运行路径，不触发上传或 signed URL。

### 逐项验收报告

| 项目 | 结果 |
|---|---|
| 1. 正式 Books | 全部经 Supabase repository / service |
| 2. Mock 入口 | 38个本地运行模块无 mock / PrototypeApp；bundle 无旧 mock 标记 |
| 3. listBooks | 每页100，循环全部页，显式限定家庭 / 档案 / 正常记录 |
| 4. getBook | 真实 UUID，家庭 / 档案 / id 三重筛选，不存在显示无法打开 |
| 5. createBook | 验证 context 提供归属；稳定 UUID，等待服务器返回 |
| 6. updateBook | 原始服务器 revision 条件 PATCH，采用返回记录 |
| 7. softDeleteBook | 条件 PATCH；数据库记录 deleted_at / deleted_by，不发正式 hard DELETE |
| 8. restoreBook | 使用删除后新 revision，服务器成功才恢复 UI |
| 9. active Profile | 服务器查询显式 profile_id，不把家庭 RLS 当普通筛选器 |
| 10. 档案独立 | 相同标题也独立 UUID；真实临时账号 / 正式本人验收完成 |
| 11. mapper | 既有 Row→StoredBook→Domain；snake_case 不进入页面 |
| 12. status | 五种中文 ↔ DB enum 集中转换 |
| 13. rating | NULL=未评分，1～5整数，清除写NULL |
| 14. date | 保留 YYYY-MM-DD；两日期可空，可只填完成日，不做时区偏移 |
| 15. cropPosition | {x,y} 归一化0～1，默认居中，编辑保留metadata / 原图 / 位置 |
| 16. saving | 进入禁用状态→等待服务器→确认更新与导航 |
| 17. 保存失败 | 表单输入 / 草稿保留，可重试；中文安全错误 |
| 18. double submit | 表单同步ref锁 + Workspace MutationGate，失败释放 |
| 19. optimistic concurrency | 精确原始 updated_at 条件写入，零行conflict |
| 20. conflict | 保留输入，取消 / 主动重新载入；不强制覆盖 |
| 21. 删除 | 确认显示归属 / 书名，成功才移除，不碰Storage |
| 22. undo | 8秒提示、交互 / 请求暂停计时，使用删除成功的新revision |
| 23. 排除删除 | list/get正常查询均服务器deleted_at IS NULL |
| 24. search | 真实当前档案书名 / 作者 / 译者本地搜索 |
| 25. filter | 真实数据状态 / 星级 / 年份，筛选不重新请求 |
| 26. sort | 空日期 / 评分置末，id稳定tie-breaker |
| 27. stale请求 | 请求序号、卸载失效、档案key隔离，旧响应不写入 |
| 28. Session | 确定失效回登录、草稿保留同一身份会话；本轮UI强制过期未实测 |
| 29. empty | 真正0条正常记录才空书架，没有seed或fallback |
| 30. loading | 既有Skeleton，切换重新载入，不保留前档案书单 |
| 31. error | 加载重试、不存在、保存 / 删除 / 恢复失败及冲突分别处理 |
| 32. 封面选择 | 禁用，说明“封面将在下一阶段启用。”，原占位布局 |
| 33. 正式Storage | objects=0，正式封面路径非空数0，未上传 |
| 34. 自动mock导入 | 没有 |
| 35. 临时数据 | 专项远端 / UI全部精确清理，两个ledger不存在 |
| 36. 正式人工验收 | 用户明确确认完成；与模型自动测试分开记录 |
| 37. 档案一数量 | 正常1、软删除0；最终回复提供真实档案名称对应关系 |
| 38. 档案二数量 | 正常0、软删除1；用户最终状态保留 |
| 39. 两档案隔离 | 临时远端 / UI通过，正式本人验收确认 |
| 40. 新增 / 编辑 | 临时真实UI通过，正式本人验收确认 |
| 41. 删除 / 撤销 | 临时真实UI与revision测试通过，正式本人验收确认 |
| 42. unit tests | 全套37/37，包括既有测试 |
| 43. repository tests | 含真实SDK请求边界模拟、mapper、分页、冲突与revision |
| 44. remote CRUD | 最终再次真实临时账号运行全部通过；正式记录未修改 |
| 45. concurrency | 双客户端旧revision、过期undo拒绝覆盖；真实UI冲突通过 |
| 46. build | TypeScript + production build通过，既有体积提醒保留 |
| 47. 390×844 QA | 尺寸接口20秒超时，未完成，不冒充通过 |
| 48. 1366×768 QA | 尺寸接口20秒超时，未完成，不冒充通过 |
| 49. migration | 无新增、无现有schema / RLS / GRANT变更 |
| 50. secret | 已审查diff、扫描Git文件与bundle，未发现真实secret；私有文件未跟踪 |
| 51. commit hash | 独立正式提交，完整hash以最终回复 / git log为准 |
| 52. Git状态 | 提交后检查working tree；最终结果以收尾回复为准 |
| 53. 已知限制 | 指定尺寸工具超时、既有chunk提醒、真机 / 放大 / 读屏未验证；本轮UI离线 / 强制过期未注入，不承诺离线保存 |
| 54. 阶段边界 | 未进入4B-3、离线、备份；无新依赖、不push |
