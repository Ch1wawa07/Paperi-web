# Paperi 纸里

**把一个模糊想法，变成有文献依据、能够继续完善的研究方向。**

当前主流程：灵感探索 → 概念锚定 → 学校图书馆检索 → 批量导入文献 → 读懂论文 → 选择并保存研究方向卡。

主导航只有首页、灵感实验室、文献工作台。站内搜索、引用星图和独立综述/设计/框架页面已从主流程撤下。旧项目、综述、设计资料和 PDF 存储仍保留；旧页面链接转入文献工作台，历史资料可只读查看或通过项目备份保存。

[两阶段实施记录、实际测试、能力边界及 Mac 最少真实复验步骤](docs/CORE_REDUCTION.md)。桌面与手机截图位于 [docs/screenshots/core](docs/screenshots/core/)，其中分析内容是明确标注的布局测试夹具，不能证明真实 AI 论文精析质量。

## Mac ZIP 安全更新

1. 从 `codex/paperi-stage1` 分支下载 ZIP，解压至新目录，保留旧工程。
2. 将旧 `.env.local` **仅在本机**复制到新目录，勿上传或提交。保留同一浏览器配置和 `http://localhost:3000`，不要清除站点数据。
3. 在包含 `package.json` 的目录运行 `npm ci`，再运行 `npm run dev`。安装步骤会准备本地 PDF worker、中文 CMap 和字体。Node.js 需满足 `package.json` 中的版本要求。
4. 更新前可在首页下载项目 JSON 备份；PDF 保存在当前浏览器 IndexedDB，需要在文献编辑中另存原文件。备份恢复会创建独立副本，不覆盖原项目。

## AI 与资料边界

本地项目管理、导入、方向卡手动编辑不需要密钥。AI 继续支持服务端 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`，或使用 `DEEPSEEK_API_KEY` 回退配置。配置说明见 [AI_SETUP.md](docs/AI_SETUP.md)。所有密钥只在服务端读取，禁止使用 `NEXT_PUBLIC_` 前缀。`.env.example` 仅为空占位。

关键词在用户从已选概念进入检索准备时，配置可用才自动请求一次并保存；失败不循环重试。精析、研究脉络由用户点击发起，每次一次模型请求。已返回但存储失败的分析可单独重试保存。

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
