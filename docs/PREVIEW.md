# Paperi · 晕染磨砂 UI

这是重新调整首页比例、配色与磨砂材质后的**真实网页截图**，来自已通过测试的生产构建。

首页的灵感卡片缩小为桌面约 342px、手机约 294px 高，精简提问、按钮与说明文字。颜色以蓝紫和青色为共同底调，叠加粉色、暖橙与柔和亮部；组件采用细颗粒、弥散边缘和更简约的轨迹线条。桌面、手机、业务页和弹窗使用同一材质。

截图可以直接在 GitHub 查看，无需安装软件。它们是静态图片，不能代替交互网页。项目管理功能仍可运行；AI、论文检索、设计和导出仍在后续阶段范围内。

## 桌面首页

1440 像素宽度。右侧展示真实项目区的空状态；底部数字仅为研究环节序号。

![Paperi 新版桌面首页](screenshots/home-desktop.png)

## 磨砂材质细节

主卡片与彩色入口的实际浏览器局部截图，可查看自然晕染、磨砂边缘及细线。文字不参与模糊。

![Paperi 磨砂材质细节](screenshots/hero-detail.png)

![Paperi 彩色入口近景](screenshots/color-detail.png)

## 工作区页面

以灵感实验室为例，未连接状态、项目切换、返回入口与后续功能说明统一使用新版材质。

![Paperi 新版灵感实验室](screenshots/lab-desktop.png)

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

本次改版通过 TypeScript、lint、build 和 13 项浏览器回归测试，包含 1440 / 1280 / 768 / 390 像素布局、六页导航、项目保存恢复、删除确认及存储失败反馈。

[设计说明](DESIGN.md) · [完整测试记录](TEST_RESULTS.md) · [运行说明](../README.md)

代码位于 `codex/paperi-stage1` 分支，可通过分支页面的 Code → Download ZIP 下载。当前没有公开部署网站。
