# Paperi 纸里

**把一个模糊想法，变成有文献依据、由你参与确认的初步研究方案。**

当前主流程：灵感探索 → 概念锚定与学校图书馆检索 → 导入/读懂论文 → 跨文献研究脉络 → AI 方向共创 → 用户确认方向 → 定量或质性初步研究设计。

首页之外有四个专业模块：灵感实验室、概念锚定、文献工作台、研究脉络。研究脉络内部包含文献整合、方向讨论、方向确认和研究设计，支持可编辑的定量模型及独立质性路径。站内检索、引用星图和旧节点画布不作为主流程；旧项目、综述、设计和 PDF 仍保留，旧路由安全转入研究脉络，历史只读可备份。

[本轮实施与验收记录、数据保护、能力边界及 Mac 真实复验步骤](docs/RESEARCH_JOURNEY.md)。[桌面与手机研究工作区截图](docs/screenshots/research-journey/) 使用明确标注的测试夹具，不能证明真实 AI 学术分析质量。较早的产品收缩记录保留在 [CORE_REDUCTION.md](docs/CORE_REDUCTION.md)。

[最新验收反馈修复、模型规则与测试记录](docs/ACCEPTANCE_FIXES.md)。

## Mac ZIP 安全更新

1. 从 `codex/paperi-stage1` 分支下载 ZIP，解压至新目录，保留旧工程。
2. 将旧 `.env.local` **仅在本机**复制到新目录，勿上传或提交。保留同一浏览器配置和 `http://localhost:3000`，不要清除站点数据。
3. 在包含 `package.json` 的目录运行 `npm ci`，再运行 `npm run dev`。安装步骤会准备本地 PDF worker、中文 CMap 和字体。Node.js 需满足 `package.json` 中的版本要求。
4. 更新前可在首页下载项目 JSON 备份；PDF 保存在当前浏览器 IndexedDB，需要在文献编辑中另存原文件。备份恢复会创建独立副本，不覆盖原项目。

## AI 与资料边界

本地项目管理、导入、方向卡手动编辑不需要密钥。AI 继续支持服务端 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`，或使用 `DEEPSEEK_API_KEY` 回退配置。配置说明见 [AI_SETUP.md](docs/AI_SETUP.md)。所有密钥只在服务端读取，禁止使用 `NEXT_PUBLIC_` 前缀。`.env.example` 仅为空占位。

已选概念旁可直接前往学校图书馆或复制概念词，不需要生成检索准备，也不调用 AI。旧检索词保存在默认收起的可选区域。精析、研究脉络由用户点击发起，每次一次模型请求。已返回但存储失败的分析可单独重试保存。

文字型 PDF 支持本地提取与元数据候选确认，扫描件没有 OCR。资料只有题录时，不能判断论文方法和结论。AI 引句核对只确认原文片段存在，不能取代用户对整项解释的学术核查。核心能力不依赖 DOI 或 OpenAlex。

云端没有用户真实密钥和三篇中文 PDF，**核心研究闭环尚未在真实用户条件下通过验收**。模拟协议、合成 PDF 与布局测试仅证明相应软件交互，不算真实研究成果。本轮真实付费模型调用为 0。

## 开发检查

```sh
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

开发模式 PDF 回归单独执行：

```sh
npx playwright test --config playwright.dev.config.ts
```

退役产品的 UI 测试保留在 `tests/retired-ui/`，不参与现产品验收。当前测试覆盖核心旅程、项目隔离、旧数据兼容、存储错误和 PDF 原件保护；真实模型质量需按交付记录在 Mac 验证。
