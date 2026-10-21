# WebGL & WebAudio Interactive Lab · 浏览器原生互动实验作品集

本仓库收录了两个纯前端、零构建、零外部图片/音频依赖的浏览器原生互动作品，通过 **GitHub Pages** 直接在线运行：

- **作品集门户首页**：<https://yuanyang749.github.io/webgl-playground/>
- **《VOXEL STRIKE · 方块突击》在线试玩**：<https://yuanyang749.github.io/webgl-playground/voxel-strike/>
- **《ORBITONE · 轨道几何音乐合成器》在线体验**：<https://yuanyang749.github.io/webgl-playground/orbitone/>

---

## 1. VOXEL STRIKE · 方块突击 (`./voxel-strike`)

![VOXEL STRIKE](./assets/voxel-strike.png)

一款基于 **Three.js + WebGL** 与 **Web Audio API** 从零构建的《我的世界》（Minecraft）风格 3D 第一人称体素波次生存射击游戏。

- **程序化海岛与分块网格**：基于多层分形 Simplex 噪声生成 $96 \times 48 \times 96$ 体素岛屿，采用 $16 \times 16$ 区块剔除隐藏面，并计算 4 级逐顶点环境光遮蔽（Vertex AO）。
- **实时地形破坏与建造**：使用 Amanatides & Woo 体素 DDA 射线检测，支持钻石战镐挖掘采集、右键修筑砖块掩体，以及火箭弹和 TNT 爆破怪造成的球形爆炸弹坑与海水倒灌。
- **4 把 3D 像素武器 + 4 类体素怪物**：包含方块步枪（支持右键 ADS 开镜）、泵动霰弹枪、火箭发射器与钻石战镐；迎战会拆墙的腐尸、闪烁自爆的 TNT 爆破怪、抛物线射箭的骷髅射手与投掷巨石的方块巨像 Boss。

详见 [`voxel-strike/README.md`](./voxel-strike/README.md)。

---

## 2. ORBITONE · 星轨 —— 开普勒行星音乐盒 (`./orbitone`)

![ORBITONE](./assets/orbitone.png)

一座按 **开普勒第三定律（$T^2 \propto r^3$）** 运转的交互式天体音乐盒与多节奏合成器。

- **双天体运行模式**：支持 **谐振模式**（第 $n$ 条轨道每周期公转整数圈，节奏严丝合缝循环）与 **开普勒模式**（$T^2 \propto r^3$，转速成无理数比，产生永不重复的相位漂移音乐）。
- **直觉式星系交互**：点击轨道放置行星（长按增加行星质量与音量）、拖拽行星切换轨道、切换 1–4 条发声子午线。
- **Web Audio 空间合成器**：内置多种音阶、调式、合成器音色、算法混响、恒星底噪（Drone）、实时录音下载以及 URL Hash 一键分享星系。

详见 [`orbitone/README.md`](./orbitone/README.md)。

---

## 本地运行

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```
