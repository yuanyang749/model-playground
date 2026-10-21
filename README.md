# 模型演练场 · Model Playground

**模型演练场（Model Playground）** 汇集了由前沿大模型端到端编写完成的浏览器原生互动游戏与声学实验项目，零构建依赖，通过 **GitHub Pages** 即点即玩。

- **演练场门户首页**：<https://yuanyang749.github.io/model-playground/>

---

## 收录项目一览

| 项目名称 | 创建模型 | 类型 | 在线体验 |
| :--- | :--- | :--- | :--- |
| **VOXEL STRIKE · 方块突击** | `Claude Opus 5.5` | 3D 体素第一人称波次生存射击游戏 | [立即游玩](https://yuanyang749.github.io/model-playground/voxel-strike/) |
| **ORBITONE · 星轨** | `Claude Opus 5.5` | 开普勒行星轨道音乐盒与多音色合成器 | [立即体验](https://yuanyang749.github.io/model-playground/orbitone/) |
| **隔代夺蛋：2026 \| Cyber Eggs** | `Gemini 4 Argon` | 双时空同屏微操街机爽游 | [立即开抢](https://yuanyang749.github.io/model-playground/cyber-eggs/) |

---

## 1. VOXEL STRIKE · 方块突击 (`./voxel-strike`)
> **创建模型**：`Claude Opus 5.5`

![VOXEL STRIKE](./assets/voxel-strike.png)

一款基于 **Three.js** 与 **Web Audio API** 从零构建的《我的世界》（Minecraft）风格 3D 第一人称体素波次生存射击游戏。
- **程序化海岛与分块网格**：基于多层分形 Simplex 噪声生成 $96 \times 48 \times 96$ 体素岛屿，采用 $16 \times 16$ 区块剔除隐藏面，并计算 4 级逐顶点环境光遮蔽（Vertex AO）。
- **实时地形破坏与建造**：使用 Amanatides & Woo 体素 DDA 射线检测，支持钻石战镐挖掘采集、右键修筑砖块掩体，以及火箭弹和 TNT 爆破怪造成的球形爆炸弹坑与海水倒灌。
- **4 把 3D 像素武器 + 4 类体素怪物**：包含方块步枪（支持右键 ADS 开镜）、泵动霰弹枪、火箭发射器与钻石战镐；迎战会拆墙的腐尸、闪烁自爆的 TNT 爆破怪、抛物线射箭的骷髅射手与投掷巨石的方块巨像 Boss。

详见 [`voxel-strike/README.md`](./voxel-strike/README.md)。

---

## 2. ORBITONE · 星轨 —— 开普勒行星音乐盒 (`./orbitone`)
> **创建模型**：`Claude Opus 5.5`

![ORBITONE](./assets/orbitone.png)

一座按 **开普勒第三定律（$T^2 \propto r^3$）** 运转的交互式天体音乐盒与多节奏合成器。
- **双天体运行模式**：支持 **谐振模式**（第 $n$ 条轨道每周期公转整数圈，节奏严丝合缝循环）与 **开普勒模式**（$T^2 \propto r^3$，转速成无理数比，产生永不重复的相位漂移音乐）。
- **直觉式星系交互**：点击轨道放置行星（长按增加行星质量与音量）、拖拽行星切换轨道、切换 1–4 条发声子午线。
- **Web Audio 空间合成器**：内置多种音阶、调式、合成器音色、算法混响、恒星底噪（Drone）、实时录音下载以及 URL Hash 一键分享星系。

详见 [`orbitone/README.md`](./orbitone/README.md)。

---

## 3. 隔代夺蛋：2026 | Cyber Eggs: Generational Rush (`./cyber-eggs`)
> **创建模型**：`Gemini 4 Argon`

![Cyber Eggs](./assets/cyber-eggs.jpg)

> **“质疑大妈，理解大妈，成为大妈 —— 一代人有一代人的鸡蛋要领！”**

一款充满多巴胺波普漫画美学与荒诞现实讽刺的双时空同屏微操街机爽游。左屏是早市排长队抢免费土鸡蛋的**王大妈**，右屏是深夜电脑前蹲点薅“¥0 喜加一”与免费算力的**大孙子**——同一个操作指令同时控制跨越两代人的行为，60 秒无缝串烧“天降甘霖、火眼金睛、零点狂潮、血脉觉醒”四大微操关卡，轰碎【大数据杀熟 BOSS】。

详见 [`cyber-eggs/README.md`](./cyber-eggs/README.md)。

---

## 本地运行

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```
