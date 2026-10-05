# 4A：Supabase 数据基础、安全与迁移准备

状态：本地代码 / SQL 已准备，尚未部署。开始时 Git clean（eff9eac）；未发现 CLI、Docker、supabase/、env 配置或 project link。未找到 SUPABASE_ACCESS_TOKEN 或旧 token 文件；未读取系统凭据库，因此不把“未发现迹象”说成确定已退出所有 Supabase 登录。没有查询账户项目列表，也没有创建、link 或修改任何远端项目。

DESIGN.md 的视觉规范冻结；其中尚未实现的 JSON“完整备份”和30天恢复文案，数据语义以本轮 PRODUCT.md 的 ZIP / 软删除修正为准。没有改动任何已验收页面或样式。

## 范围与表结构

Household → Membership / Profiles → Books。Auth User 通过 household_members 加入家庭；阅读档案不绑定单个账号。一名成员可以使用两个档案，同一家庭两名成员也能共同维护全部档案。名称只用于显示，不作为权限依据。

| 表 | 字段 |
|---|---|
| households | id UUID PK、name、created_at、updated_at |
| household_members | household_id、user_id（引用 auth.users）、role(owner/member)、created_at；联合 PK(household_id,user_id) |
| profiles | id UUID PK、household_id、name、sort_order、created_at、updated_at、archived_at |
| books | id UUID PK、household_id、profile_id、title、author、translator、status、started_on、finished_on、rating、notes、cover_original_path、cover_original_filename、cover_mime_type、cover_position_x、cover_position_y、created_at、updated_at、deleted_at、deleted_by |

所有业务表 id 使用数据库默认 gen_random_uuid()（Postgres 自带，无需额外 extension）；books 创建也接受客户端生成 UUID，便于先建记录后上传。mock 的 lin / chen / lin-siddhartha 标识保持原样，不能直接当作正式 UUID；4B 必须建立明确的新旧 ID 映射，不自动把 mock 导入生产。

profiles 的 UNIQUE(household_id,id) 与 books 的复合 FK(household_id,profile_id) 保证归属一致。没有 title 去重约束：同名书可在两个档案独立存在，也可表达重读。household/profile 外键不使用破坏性 cascade；auth 用户移除只清理 membership，deleted_by 可置空，不删除阅读记录。

status 映射：想读→want_to_read，在读→reading，读完→finished，暂停→paused，弃读→abandoned。rating 是可空 smallint，非空只能 1～5；title / author 去空白后 1～200 字；译者≤200、笔记≤5000。两个日期均可空，也允许只填 finished_on，已知起止日期须有正确先后顺序。前端既有状态 / 日期提示不变；数据层拒绝在读 / 暂停仍携带结束日，4B 必须先沿用原确认流程处理。

cropPosition 是现有 `{x,y}`，数据库保存 real cover_position_x/y，非空、范围0～1、默认0.5。普通更新缺少该参数时不发位置字段；有值时严格验证，不静默纠正非法新输入。更换图片 / 移除封面重置位置为0.5，但保留旧文件。DB 字段已满足以后生成类型和迁移，未实现裁剪器。

## RLS 与权限

四表全部启用 RLS，撤销 PUBLIC/anon/authenticated 的默认表授权后按操作和列重新授权。

- household_members 仅允许 authenticated SELECT 自己 user_id = auth.uid() 的 membership。没有客户端 INSERT/UPDATE/DELETE。owner 也不具备浏览器端任意添加成员的权限；初始化与以后新增用户必须走经过验证的管理员流程。
- households：成员可读；owner 可修改名称，不能通过浏览器新建 / 删除 household。
- profiles：成员可读、新建和修改名称 / 排序 / 归档；不能更改 id、household_id 或物理删除。
- books：目标家庭成员可读、新建、修改及软删除 / 恢复家庭所有档案记录。UPDATE 只能写显式白名单列，不能更改 id、household_id、profile_id、created_at、updated_at 或 deleted_by。
- 不给 books DELETE 授权，也没有 DELETE policy。普通客户端硬删除将被数据库拒绝。

成员表 policy 只查 auth.uid()，其他表用简单 exists 子查询查成员表，不互相回查，避免递归。不使用 SECURITY DEFINER；两个触发函数均为 invoker、固定空 search_path、完全限定业务 / auth schema，禁止通过客户端 RPC 直接调用。时间由 DB now()/clock_timestamp() 维护，updated_at 至少递增1微秒，不接受客户端设置。

删除只以 PATCH 请求 deleted_at 非空；触发器忽略客户端时间，保存 DB 当前时间及 auth.uid()。恢复只 PATCH deleted_at=null，由触发器清除 deleted_by。正常查询显式 household_id / profile_id / deleted_at IS NULL；RLS 仍允许家庭成员读软删除记录，以便恢复与备份。没有30天任务、永久删除、回收站 UI 或自动资源清理。

这些规则需要在专属测试数据库真实验证后才算部署验收；静态 SQL / SDK mock 测试不能代替 RLS 执行测试。[官方 RLS 说明](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 原始封面

`book-covers` 必须 private，限制 JPEG / PNG / WebP、10MiB。bucket 经 Storage API 初始化，migration 仅建立 Storage policies，不直接写 storage.objects / storage.buckets，也不修改 Storage 表结构。

路径：`<household UUID>/<profile UUID>/<book UUID>/original/<随机 UUID>.<jpg|png|webp>`。原始中文文件名放 cover_original_filename，DB 保存稳定相对路径，不保存 blob:、本地路径或带 token 的 signed URL。路径 regex 与 DB 元数据 CHECK 保证属于同一本书。

Storage policies 限定 bucket、完整路径格式、第一层家庭成员资格，并验证三层 ID 对应已存在的书籍。INSERT 仅允许尚未软删除的书籍；SELECT 允许软删除书籍及以前的封面路径，支持恢复。没有 UPDATE/DELETE policy，因此不允许 upsert 覆盖、move 或客户端删除。部署前必须审查目标项目是否已有其他宽松 policy；多个 permissive policies 会合并，不能只检查本项目新增 policy。[官方 Storage 权限说明](https://supabase.com/docs/guides/storage/security/access-control)

流程：先 createBook（无封面）→上传完整 File（检测文件头但不转换字节）→带旧 updated_at 条件更新 cover_original_path 等元数据→确认返回 saved。上传失败不更新记录；更新失败 / 冲突时新上传文件也保留，原记录 / 原图保留；以后再设计 orphan 清理。任何软删除都不删除封面。

getCoverBlob 走 authenticated download；展示者可创建 Object URL 并在不使用时释放。getCoverDisplayUrl 仅生成300秒 signed URL，它是短期 bearer 链接，不记录、不导出、不进数据库；优先采用 authenticated blob。短期链接在失效前不能保证立即随 membership 撤销失效，这是后续权限验收的一部分。

## Repository、并发与类型

src/lib/supabase.ts 仅有一个惰性 client；配置缺失、占位符或高权限 key 会明确抛错，错误不回显原值。支持 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY（亦可填 legacy anon JWT，必须声明 anon role）。4A 的 Auth session 只在内存，未做登录 UI / localStorage 持久化。

createRepositories(client,householdId) 锁定家庭范围：profiles.listProfiles；books.listBooks(profileId,offset=0,limit=100)、getBook、createBook、updateBook、replaceCover、softDeleteBook、restoreBook。书籍列表显式排除软删除并提供 nextOffset，不把 API 默认行数上限误当成完整书架。getBook 默认排除删除，可明确传 includeDeleted=true 做恢复准备。

所有修改要求原始 Postgres updated_at 字符串，按 id+household_id+profile_id+previous updated_at+删除状态作原子 UPDATE。不要把 revision 转为 JavaScript Date（会丢微秒）。零行返回 conflict（也可能是删除 / 不可访问，不区分以免泄露）；不自动无条件重试覆盖。请求错误抛出 DataAccessError，调用者必须保留输入；saved 才有新版本。这里只保护 repository 正常写入，不声称已完成4B冲突合并 UI。

`contracts.ts` 是领域 / 服务接口，`mappers.ts` 在 unknown 边界验证并转换现有 Book/Profile；没有伪造 `Database` generated types，也没有另外手写一套完整数据库 Row/Insert/Update 镜像。SQL 是当前数据库字段权威。取得真实环境后必须通过官方 introspection 生成类型，再将 createClient<Database> 接入并对齐 repository，生成结果纳入 Git。[官方类型生成](https://supabase.com/docs/guides/api/rest/generating-types)

## 下一次部署的安全步骤（本次没有执行）

1. 用户在 Supabase 创建或确认专属于本项目的项目，确认费用选择、项目名称、project ref；创建 Auth 用户。不要提供 secret 到聊天或 Git。
2. 如需 CLI，使用官方 npm 项目 dev dependency / Scoop 安装方式并锁定版本；本轮没有安装。保留 migrations，在本目录运行官方 `npx --no-install supabase init` 生成真实 config，不覆盖已有 migration；没有 Docker 就只做经确认的远端准备，不强行装 Docker。
3. 管理员登录后核对项目名称 / ref；确认数据库为空或检查与现有对象的冲突，备份已有数据与 Storage 原件。对既有项目不直接运行初始 migration。
4. `npx --no-install supabase link --project-ref <已确认REF>`；`npx --no-install supabase migration list`；`npx --no-install supabase db push --dry-run` 审查只包含下面两份 SQL。真正 db push 前再次核实目标和 diff。不要 db reset 远端或忽略 migration 冲突。
5. 应用 `20261005000100_reading_shelf_foundation.sql`、`20261005000200_cover_storage_policies.sql`。迁移前事务 / 备份是恢复点；应用后发现问题应修复前滚或恢复经过核验的备份，不写删除用户表的 down 脚本。
6. 在仅管理员终端临时提供 SUPABASE_URL、SUPABASE_PROJECT_REF、SUPABASE_SECRET_KEY（无 VITE 前缀，使用安全环境输入）；运行 `node scripts/setup-cover-bucket.mjs`。脚本只创建缺失的 private bucket；同名配置不符立即停止，不覆盖。执行后清除终端 secret 环境变量，禁止将凭据写文件 / 日志。
7. 管理员 SQL / 后端专用操作创建一条 households 记录、给已确认 Auth UUID 建立 owner membership，再创建林予 / 陈禾档案（以实际用户确认名称为准）；第二 Auth 用户只由管理员添加对应 member。该步骤不能在浏览器用 service role，也不自动导入第三阶段 mock。
8. 真实本地或隔离测试项目执行数据库用例及 Storage API 跨家庭矩阵；验证非 owner 成员可读写所有家庭档案、外人 / anon 无权访问、伪造归属被 FK / RLS 拒绝、硬删除 / overwrite 被拒绝、原图保留和冲突行为。
9. `npx --no-install supabase gen types typescript --project-id <已确认REF> --schema public`，或有本地栈时使用 `--local --schema public`。输出先写临时文件，成功且有真实 schema 后保存 src/data/remote/database.types.ts，避免重定向失败清空已有类型。不手写或伪称 generated。
10. 仅 URL / publishable key 写到已忽略的 .env.local。4A 到此仍不切换页面；4B 需要用户另行授权。

## 测试与未验证项

Node 测试使用真实 SDK，但 fetch 被本地拦截：状态、评分、日期、位置、归属映射、路径、软删除过滤、分页、并发条件、PATCH 删除 / 恢复、原始上传字节、上传失败 / 替换冲突及环境密钥限制。另有 migration 静态安全检查。所有请求都未发往 Supabase。

supabase/tests/4a_security.test.sql 是仅供一次性本地数据库执行的 pgTAP 事务测试，17项、虚构 fixture、最后 rollback；不是 seed，也未运行。取得官方本地环境后通过 `npx --no-install supabase test db` 运行。没有本地 PostgreSQL / Docker，目前未验证真实 SQL 解析与执行、FK / trigger / RLS、Storage API权限、Auth session、bucket、数据库并发或跨家庭远端访问。不得以本地 mock 通过宣称远端安全已验证。

没有 seed.sql；没有 ZIP 导出、PWA、离线同步、家庭邀请、回收站、永久删除或 orphan 自动清理。UI 源码、CSS、mock 数据和现有 Book/Profile 类型保持原样。
