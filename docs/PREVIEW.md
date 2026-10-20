# Paperi · 已确认 UI 与灵感实验室

这是保留已确认 UI、加入阶段 2 接入准备后的**真实网页截图**，来自已通过测试的生产构建。

首页的灵感卡片缩小为桌面约 342px、手机约 294px 高，精简提问、按钮与说明文字。颜色以蓝紫和青色为共同底调，叠加粉色、暖橙与柔和亮部；组件采用细颗粒、弥散边缘和更简约的轨迹线条。桌面、手机、业务页和弹窗使用同一材质。

截图可以直接在 GitHub 查看，无需安装软件。它们是静态图片，不能代替交互网页。项目管理与手动研究种子可运行。AI 代码已接入，但当前没有服务商配置，发送按钮明确禁用；论文检索、设计和导出仍未接入。

## 桌面首页

1440 像素宽度。右侧展示真实项目区的空状态；底部数字仅为研究环节序号。

![Paperi 新版桌面首页](screenshots/home-desktop.png)

## 磨砂材质细节

主卡片与彩色入口的实际浏览器局部截图，可查看自然晕染、磨砂边缘及细线。文字不参与模糊。

![Paperi 磨砂材质细节](screenshots/hero-detail.png)

![Paperi 彩色入口近景](screenshots/color-detail.png)

## 工作区页面

灵感实验室支持对话、候选方向与研究种子。当前展示未配置 AI 的真实状态。截图中的「界面示例（手动输入）」与研究种子仅由截图流程手动填写，**不是 AI 返回，也不是产品预置项目**；新浏览器首次打开仍为空。

![Paperi 灵感实验室桌面](screenshots/lab-desktop.png)

![Paperi 灵感实验室手机](screenshots/lab-mobile.png)

## 手动编辑研究种子

无需 AI 接口即可填写、保存和编辑。已有种子时，采纳新候选需要明确确认替换。

![Paperi 研究种子编辑](screenshots/seed-editor.png)

## 创建项目弹窗

支持键盘焦点、取消、名称校验和真实本地保存。

![Paperi 新版创建项目弹窗](screenshots/project-dialog.png)

## 手机首页

390 像素宽度。

![Paperi 新版手机首页](screenshots/home-mobile.png)

## 手机导航与业务页面

![Paperi 新版手机导航](screenshots/mobile-navigation.png)

## 平板首页

768 像素宽度。

![Paperi 新版平板首页](screenshots/home-tablet.png)

## 验证与代码

本次通过 TypeScript、lint、build 和 22 项自动测试，包括项目回归、四种宽度、研究种子、对话持久化与错误保护，以及本地测试服务上的真实 HTTP 适配器验证。测试数据与生产界面隔离，不代表真实 AI 的质量验收。

下一步请按 [AI 接口配置说明](AI_SETUP.md) 选择服务商并安全配置。

[设计说明](DESIGN.md) · [完整测试记录](TEST_RESULTS.md) · [运行说明](../README.md)

代码位于 `codex/paperi-stage1` 分支，可通过分支页面的 Code → Download ZIP 下载。当前没有公开部署网站。
