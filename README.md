# Paperi 纸里

最新调整：[导入优先、开发模式 PDF 卡住修复与彩色磨砂界面](docs/IMPORT_AND_GLASS_REFINEMENT.md)。

**让研究想法、学术文献和研究设计连成一个可持续编辑的工作流。**

当前版本为研究工作流重构：灵感实验室 → 学校数据库检索 → 批量导入 → 文献工作台（星图 / 脉络 / 精析）→ 综述结构 → 研究设计 → 研究框架导出。已停用自建网页学术搜索。

完整功能、实际测试、限制与 **Mac ZIP 更新方法**见 [工作流重构交付说明](docs/WORKFLOW_REBUILD.md)。支持 RIS、BibTeX、EndNote、参考文献文字及可提取文字的 PDF；保留旧项目与 Soft Glass UI。项目 JSON 可备份恢复，PDF 存在本地 IndexedDB，需要单独备份。

云端没有真实 AI 密钥，本轮真实 AI / 引文业务 API 联调未完成；测试模型与引用夹具不会被当作真实学术成果。运行时仅按用户点击调用原有 AI 配置，无新付费平台。

以下是历史运行资料，产品行为和本轮更新步骤以以上交付说明为准。

## 没有编程基础，怎样查看

### 先进行交互体验

交互体验请先看 [Mac 安全更新与本地预览步骤](docs/V12_DELIVERY.md#mac-最简安全更新)。[历史运行截图](docs/PREVIEW.md) 只记录旧版，不能代替本次交互验收。

本次实际浏览器验证生成的桌面、平板及手机截图位于 `test-results/home-1440.png`、`home-1280.png`、`home-768.png`、`home-390.png`。它们是运行时生成的检查结果，不是效果设计稿；测试输出不提交 Git。聊天报告会给出当前文件链接。

### 在自己的电脑交互体验

当前没有已经上线的网址，云环境中的地址不能直接当作你电脑的网址。

1. 安装 **Node.js 24 LTS** 和 **Visual Studio Code**，使用各自官方网站的安装程序。安装后重启 VS Code。
2. 在 GitHub 仓库左上方的分支选择器切换到 `codex/paperi-stage1`，点「Code → Download ZIP」并解压。用 VS Code 的「文件 → 打开文件夹」打开有 `package.json` 的项目文件夹。
3. 点 VS Code 菜单「终端 → 运行任务」，选择 **Paperi：首次安装依赖**。等待出现安装完成且没有错误。只需首次或依赖更新后执行。
4. 再点「终端 → 运行任务」，选择 **Paperi：启动网页**。保持该任务运行。
5. 在**这台电脑**的浏览器地址栏输入 `localhost:3000`。这只在你自己的电脑上提供预览，不会发布为公开网站。
6. 查看后，在 VS Code 的「终端 → 终止任务」中停止 Paperi 启动任务。

若云环境未来提供经过确认的私有端口预览功能，可以通过该功能查看运行中的 3000 端口；本次没有可用的外部预览链接，也未配置公开转发。不要把云端的 `127.0.0.1` 当作可分享地址。

## 建议的验收步骤

1. 在首页写一段观察，点「开始探索」，进入自动创建的临时标题项目，不需要重复发送原话。
2. 点「继续项目」，在灵感实验室看见刚才的原始观察；首页开始探索会自动提交首次消息；可继续分阶段交流，也可手动记录研究种子。
3. 刷新网页，回首页，项目应仍在。创建第二个项目，从右上角切换，再跨页面查看当前项目。
4. 尝试重命名、取消删除、确认删除；确认只删除所选项目。
5. 进入文献探索，用英文关键词检索，打开来源与 DOI 核查。收藏到多个分类，添加笔记，再刷新并切换项目检查各自的文献库。
6. 缩窄浏览器或用手机打开同一可用地址，展开导航，查看文献整理与六个页面。

**本地保存的限制：** 不等于云同步；更换设备、浏览器、网站地址或端口，使用隐私模式、清理浏览器数据都会使原项目不可见或丢失。请勿仅在本地保存无法替代的研究资料。删除不可撤销。

## 环境配置

**本地项目与手动研究种子不需要任何密钥。** 真实 AI 对话需要配置下面三个 AI 变量；当前未配置时明确禁用发送。

AI 的菜单式配置步骤见 [AI 接口配置说明](docs/AI_SETUP.md)。`.env.example` 仅含空占位；在环境设置中安全填写，或在本机复制为被 Git 忽略的 `.env.local`：

| 变量 | 后续用途 | 何时需要 |
|---|---|---|
| `AI_API_KEY` | 服务器调用真实 AI，不能公开到浏览器 | 阶段 2 |
| `AI_BASE_URL` | 服务商的 OpenAI 兼容 API 根地址 | AI 调用前 |
| `AI_MODEL` | 支持 JSON object 模式的准确模型标识 | AI 调用前 |
| `OPENALEX_API_KEY` | OpenAlex 独立访问额度，只在服务端读取 | 可选；本轮匿名共享额度已验证，政策可能变化 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | 阶段 2 条件具备时 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 受 RLS 保护的公开客户端标识 | 阶段 2 条件具备时 |

AI 的三个配置已参与接口逻辑；没有配置不会发起 AI 调用。文献检索配置及免费额度说明见 [文献使用说明](docs/LITERATURE.md)。不要向聊天或 GitHub 上传真实密钥；绝不能把 Supabase service role key 放到前端。

## 给后续维护者的运行与检查说明

技术：Next.js App Router、React、TypeScript strict、Tailwind CSS 4 + 定制 CSS；精确依赖版本和完整性校验写入 `package-lock.json`。建议 Node.js 24 LTS，最低 22。

以下命令均在仓库根目录执行。初学者可直接使用上方菜单任务，无需自行输入命令。

```sh
npm ci
npm run dev
# 停止开发服务后，可以验证生产模式：
npm run typecheck
npm run lint
npm run build
npm run start
```

在当前 Codex 云环境，npm 的默认缓存目录不可写，安装时使用 `npm ci --cache /workspace/.npm-cache`。这只是机器缓存路径调整，没有绕过 TLS 或软件完整性校验。

浏览器验证（先成功 build，测试会自动启动并结束本地生产服务）：

```sh
npm run test:e2e
```

本云环境复用 `/usr/bin/chromium`。其他机器可执行 `npx playwright install chromium`；测试配置会自动采用系统 Chromium（若存在），否则使用 Playwright 安装的浏览器。也支持通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已安装的浏览器。测试独立使用 3100、3101、3102 与 3110 端口，不复用既有服务。普通测试服务器清空真实 AI 配置，AI 测试服务器使用本地假凭证，3102 文献测试进程用 test-only fetch preloader 拦截官方接口。生产代码不含夹具回退；自动测试不消耗外部 API 额度。真实接口验收单独记录。

测试覆盖范围和实际结果见 [完整测试记录](docs/TEST_RESULTS.md)。自动截图和 HTML 报告分别在 `test-results/` 与 `playwright-report/`，被 Git 忽略。404 页面也有返回首页入口。

## 数据与结构

- `src/lib/projects.ts`：Project 类型、带版本校验的存储结构、异步 `ProjectRepository` 接口与本地适配器。
- `src/components/project-provider.tsx`：共享当前项目状态、保存反馈、多标签页更新与失败保护。
- `src/components/home.tsx`、`project-dialog.tsx`：原创首页和真实项目操作。
- `src/components/shell.tsx`：六页通用导航、项目切换、移动端菜单。
- `src/components/lab.tsx`、`src/lib/exploration.ts`：灵感对话、候选方向及用户确认的研究种子。
- `src/app/api/lab/route.ts`、`src/lib/ai-server.ts`：服务端 AI 适配、配置检查、输入/输出校验与调用限制。
- `src/components/literature.tsx`、`src/lib/literature*.ts`：真实元数据检索、DOI 核查与按研究分类收藏。
- `src/app/api/literature/`：检索、核查和中英文检索词的服务端接口。
- `src/components/module-page.tsx`：阶段 4 模块的未接入说明，并复用已确认研究问题。
- `src/app/globals.css`：颜色、字体、圆角、阴影等视觉 Token 和响应式规则；无外部字体、图片或第三方跟踪请求。
- `docs/`：原始完整需求、阶段计划、技术取舍和验证记录。

存储键为 `paperi.projects.v1`，结构带版本、修订号和数据校验。先保存成功再更新界面。遇到读写受限、容量不足或格式异常会提示，不会悄悄重置为演示内容。修订号帮助识别过期页面，但 localStorage 不是多用户数据库，不能保证极端同时写入的事务一致性。后续 Supabase 迁移需要明确设计导入与冲突处理。

## 下一阶段

本轮停在 V1.1 阶段 A，等待用户实际体验和确认，再开始阶段 B 检索质量修复。阶段 C 为真实引用星图，阶段 D 为文献适配解释；不得一次性开发完后才让用户验收。Supabase、匿名身份与 RLS 仍待条件具备时接入，公开部署和新增付费服务需另外授权。
