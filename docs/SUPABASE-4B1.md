# 4B-1 · 私人家庭登录与档案初始化

2026-10-06。唯一远端：reading-shelf / agtkrlpiixniouipwdxr / ap-northeast-1。

## 当前状态与边界

公开注册由用户手动关闭，Auth settings API 复查 disable_signup=true、external.email=true。正式入口仅 Email + Password 登录，无 signUp / OAuth / Magic Link / 邀请。代码、migration、临时账号验证已完成；**用户已本人创建正式账号、登录和首次初始化，正式验收通过**。临时安全测试与正式数据验收分别记录，正式账号不用于破坏性测试。

第三阶段书籍原型从旧 App 原样保留到 src/PrototypeApp.tsx（仅组件名称变更），不在正式入口挂载，也不提供绕过登录的开发后门。mock.ts、ShelfPage、DetailPage、BookFormPage、封面组件和书籍规则不变。真实 Profiles 选择后停在准备完成状态，统计 / 最近封面不显示；4B-2 才接 Books。不新增依赖，不做 PWA / IndexedDB / 导出。

## 客户端

- src/lib/supabase.ts：唯一惰性 createClient，官方 persistSession=true、autoRefreshToken=true；detectSessionInUrl=false。SDK 自行保存 / 刷新 session，不自定义存储 token 或密码。请求上限 15 秒，启动等待上限 16 秒后给可重试错误。
- src/data/auth/service.ts：集中 signInWithPassword、signOut（scope=local，不退出其他设备）、getCurrentSession、getCurrentUser、onAuthStateChange；另有 membership / household / profiles 读取和 bootstrap 调用。
- AuthProvider：Context / hooks，loading / authenticated / unauthenticated。SDK 订阅回调只同步更新状态，不在 callback 中 await 其他 SDK 操作。启动先 getSession，再 getUser 验证；确定 JWT / session 失效时官方 signOut 回登录，网络失败保留 SDK session 并允许重试。
- 登录、初始化错误映射为自然中文，不输出 raw error、密码、token 或请求正文。初始化失败保留输入，成功与 already_initialized 都重新读取服务端 membership / profiles。
- household service 拒绝多个 membership 的歧义，不猜书房。组件按 Auth user.id 隔离，旧异步响应通过请求代号 / mounted 标记防止污染新用户。
- Profiles 使用真实 generated Database，映射保留 sort_order、created_at、archived_at；只显示当前家庭未归档项，按 sort_order / created_at / id 排序。
- 本机 reading-shelf.activeProfileId 只保存档案 UUID；每次启动核实存在、未归档、当前家庭归属。退出清除此键，保留显示偏好。存储不可用时退回会话内选择，不影响访问安全。

## 新 migration 与权限

20261006000200_household_bootstrap.sql；三个既有 migration 没有修改。参数仅 p_household_name text、p_profile_names text[]，返回 Household UUID。UI 固定两个姓名；数据库允许一维数组 1～10 项、每项 trim 后 1～20 字，书房名称 trim 后 1～80 字，无硬编码姓名或账号。

函数 SECURITY DEFINER / search_path='' / owner=postgres，表与函数引用限定 schema。REVOKE PUBLIC、anon、authenticated 默认权限后只 GRANT authenticated EXECUTE；远端 ACL 实测为 postgres=X/postgres、authenticated=X/postgres，anon_execute=false。不新增 membership 写权限或表级 GRANT ALL。

调用者必须 auth.uid() 非空且 auth.role()='authenticated'。用该 uid 的事务 advisory lock 串行化同用户并发请求，再检查是否已存在任何 membership。不存在才在同一事务创建 Household、当前用户固定 owner membership 和有顺序的 Profiles；已有成员返回 already_initialized。不能指定其他用户、role 或已有 household_id。

部署顺序：项目身份 → SQL / search_path / GRANT 静态审查 → 官方 CLI dry-run 列出唯一新 migration → push → 函数 owner / ACL 实查 → 真实测试 → 官方 CLI 重新生成 database.types.ts。未使用密码参数 / env 文件 / migration repair，没有更改 Windows 或 Clash 配置。

安全设计依据：[Supabase Database Functions](https://supabase.com/docs/guides/database/functions)、[官方 getSession](https://supabase.com/docs/reference/javascript/auth-getsession)、[官方 Auth 事件](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)。

## 必要验证

unit tests 包含状态 / 中文错误、当前档案归属、归档排除 / 排序、输入校验、already_initialized 恢复、确定失效与网络失败区分、无 session / 有效 session 恢复。旧书籍 / 数据层测试保留。

node scripts/verify-household-auth.mjs 使用随机虚构、自动确认的临时用户，不发送邮件。验证 anon RPC / 表拒绝、真实登录 / getUser / 恢复、初次 membership、12 种非法参数与无半成品、trim 后真实姓名与固定 owner、重复与丢响应恢复、额外管理员参数拒绝、membership 写入拒绝、跨家庭隔离、并发唯一赢家、归档过滤、强制事务失败回滚和退出。finally 只清理本轮 UUID，qa/household-auth-ledger.json 只记录 ID、无凭据且被忽略；旧 ledger 存在则停止，不覆盖它。正式数据不可进入测试清理名单。

浏览器 QA 使用 scripts/household-ui-fixture.mjs 的临时账号，通过一次性 loopback 内存管道交给 QA 控制器，不写密码 / 邮箱 / token 文件或日志；不是应用接口，不在浏览器应用中导入。QA 后明确 cleanup，只清理对应 ledger 的临时 UUID。四张截图在 ignored qa/，不入 Git。

## 正式账号与首次初始化验收

用户在 Dashboard 本人创建正式家庭 Auth 用户，并在真实本机登录页输入邮箱和密码；模型未获取正式密码，也未写入文件或日志。初始只读检查：1 个 Auth 用户且邮箱已确认，Household / membership / Profiles / Books / Storage 全部为 0。用户随后本人填写书房名称和两个姓名，回复“登录和初始化已完成”。

只读 SQL 正式验收：Auth 用户 1、Household 1、membership 1（owner）、未归档 Profiles 2、Books 0、Storage objects 0；owner 正确关联真实 Auth 用户与该家庭。档案页真实姓名与数据库返回一致、sort_order 为 0 / 1。此文档不保存正式邮箱、密码、token、用户 UUID 或姓名。

浏览器正式验收：进入真实 Profiles 页；非破坏性选择一个正式档案后 Header 使用服务器姓名，刷新仍保留登录与选择；最后返回“进入谁的书房？”并保持正式登录。没有再次调用 bootstrap，没有删除正式数据，没有测试性 Book / Storage 写入。验收截图 qa/4b1-formal-profiles.jpg 被忽略，不入 Git。

4B-1 完成并停止，正式家庭数据永久保留。4B-2 尚未获准，不自行接入 Books / 封面 / 离线同步。
