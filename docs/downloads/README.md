# 机械臂动力学手记 · Robot Dynamics Notes

[在线学习](https://linshenghou.github.io/robot-dynamics-notes/) · [GitHub 仓库](https://github.com/linshenghou/robot-dynamics-notes) · [反馈与建议](https://github.com/linshenghou/robot-dynamics-notes/issues)

从重力补偿到关节空间柔顺的中文交互教程。纯 HTML / CSS / JavaScript，无运行时 CDN、账户或后端。

首页直接呈现暗色 YAM 交互实验台：六关节角度、三维机械臂与六关节补偿力矩同时显示。
向下滚动再进入动力学公式和学习路径。重力章节支持单关节转动实验：固定其余角度，并排比较六关节的参考补偿、当前补偿和变化量，再展开逐连杆的承载贡献。

第一版包含五课：YAM 静止悬停、二维力臂与势能、三维 wrench、MIT 模式、单关节动态柔顺实验。
这是教学模型与软件验证，不是实机控制程序，也不代表机器人实测性能。

## 预览

直接在现代浏览器打开 `docs/index.html`，或在仓库根目录启动：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8000/docs/`。无需 npm install。完整阅读可用现代 Chrome、Firefox 或 Safari。
有 hash 的章节链接可以分享，例如 `.../index.html#compliance`。

## 重新生成与验证

需要 Python 3 与 Node.js 18+，基础检查不安装第三方依赖。

```sh
python3 scripts/build_site.py
node scripts/verify_course.cjs
python3 scripts/build_site.py --check
```

可选浏览器检查需要 Playwright。默认使用已安装的 `playwright` 包；也可通过 `PLAYWRIGHT_MODULE_PATH`
指定其绝对目录，通过 `BROWSER_EXECUTABLE` 指定本机 Chrome。`SITE_URL` 可指定已经启动的 HTTP 地址，
省略时检查本地 file 页面。生成的预览与报告放在已忽略的 `artifacts/`。

```sh
node scripts/check_site.cjs
node scripts/check_coupling.cjs
```

数值检查覆盖：二维势能梯度；YAM 的势能梯度与逐连杆力矩；单关节自由摆能量守恒、
理想重力抵消后的匀速运动、纯阻尼的指数衰减、PD 静态偏移。浏览器检查覆盖深链接、交互、
离线资源与窄屏布局。这些验证不替代参数辨识或实机测试。

## GitHub Pages

项目站点：[linshenghou.github.io/robot-dynamics-notes](https://linshenghou.github.io/robot-dynamics-notes/)。
公开仓库：[linshenghou/robot-dynamics-notes](https://github.com/linshenghou/robot-dynamics-notes)。
网站使用 GitHub Pages 的分支发布：main 分支的 /docs 目录。推送更新后会自动重新发布。
发布前运行构建与数值检查。所有资源使用相对路径，也适配 Fork 后的项目站点。

在你自己的账号下部署时：

1. Fork 本仓库，或创建公开仓库，将源码推送到默认分支 `main`。
2. 打开 Settings → Pages → Build and deployment，将 Source 设为 **Deploy from a branch**。
3. 选择 **main** 分支与 **/docs** 目录，保存并等待发布完成。

需要把构建验证纳入自动发布时，可将示例工作流
[.github/pages-workflow.example.yml](.github/pages-workflow.example.yml) 复制到
.github/workflows/pages.yml，再将 Pages 的 Source 切换为 **GitHub Actions**。
当前启用的是分支发布，示例工作流不会执行。

详情见 [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。

## 文件结构

```text
docs/index.html             课程内容、导航、练习题
docs/assets/site.css        站点样式
docs/assets/site.js         交互与单关节动画
docs/assets/physics.js      可单独验证的教学物理模型
docs/labs/                 生成的实验台、重力与 wrench 实验
docs/downloads/            模型、许可与说明
src/workbench/             首页六关节实验台及完整动力学展开
src/gravity/               YAM 重力实验源码与计算引擎
src/model/                 固定版本模型、URDF、上游许可
src/wrench/                三维 wrench 原始页面
src/figures/               本项目绘制的示意图
scripts/                   构建与检查
```

修改独立实验或下载资料后运行构建脚本；课程正文、CSS 和主页面 JS 直接在 docs 中维护。
历史试验目录 `yam-dynamics/` 保留在本地并被忽略；正式源码已整理到 src，不依赖历史文件。

## 内容、模型与约定

- 学习线索参考 Lynch & Park 的 Modern Robotics：§3.4、§8.1、§8.3、§8.9。原书 PDF 不在本仓库重新分发。
- YAM 模型来自 I2RT 仓库提交 `120c3c81400171174604e503943f8d1ebc891058` 的 YAM v1 URDF；六转动关节，两指锁定为零，含夹爪。
- 固定基座、世界 Z 向上、重力 `[0,0,-9.81]`。力矩是模型计算值。显示网格顶点聚类简化到 5 mm，动力学参数保留原始精度。
- 重力项 g(q) 表示电机补偿，与物理重力矩反号。Wrench 采用 `[力矩; 力]`，必须明确参考点与表达坐标系。
- YAM 首页只比较静止姿态；独立实验台可加入瞬时加速度与速度，仍不积分轨迹。单关节柔顺实验才积分运动。后者采用无质量杆与末端点质量，保留惯性，并可加入平滑摩擦和重力估计误差。
- 网页不读取传感器、不发送 CAN 指令，不将教学增益当作实机参数。

## 许可与贡献

原创程序：MIT。原创文字与图示：CC BY 4.0。I2RT 模型及衍生简化网格保留其 MIT 许可。
完整说明见 LICENSE、CONTENT-LICENSE.md、src/model/LICENSE。

欢迎 Issues 和 Pull Requests：公式纠错、推导补充、教学实验、无障碍和翻译。
请描述章节、参数、预期与实际结果；改变物理计算时，提供独立解析解、能量或势能梯度等验证依据。
后续主题：惯性耦合、速度相关项、末端柔顺和任务空间阻抗。
