# VOXEL STRIKE · 开发进度记录

## 已完成
- [x] 项目脚手架搭建与 Three.js r186 本地模块化引入（`vendor/`）
- [x] `js/noise.js`：种子 PRNG（`mulberry32`）与 2D Simplex / FBM 分形噪声
- [x] `js/blocks.js`：12 种体素方块定义与 16×16 程序化像素纹理图集（`NearestFilter`）
- [x] `js/world.js`：96×48×96 海岛与中央前哨平滑生成、16×16 Chunk 网格与 4 级顶点 AO、Amanatides & Woo 体素 DDA 射线检测、球形爆炸与海水倒灌、`groundY` 地面高度查询
- [x] `js/physics.js`：轴分离 AABB 体素碰撞与射线-AABB 求交（含爆头判定）
- [x] `js/player.js`：第一人称移动、冲刺、游泳、跌落伤害、步伐摇晃、后坐力与受击震屏
- [x] `js/weapons.js`：方块步枪（含 ADS 开镜）、泵动霰弹枪、火箭发射器、钻石战镐（挖掘与放置砖块）及 3D 视图模型
- [x] `js/enemies.js`：腐尸（含拆墙 AI）、TNT 爆破怪（闪烁自爆）、骷髅射手（抛物线箭矢）、方块巨像 Boss（投掷巨石 + 震地）
- [x] `js/effects.js`：`InstancedMesh` 方块碎屑、火花、半透明爆炸烟雾、曳光弹与动态点光源闪光
- [x] `js/sky.js`：昼夜循环、日月星空、无缝像素云海与水下雾效
- [x] `js/audio.js`：Web Audio API 纯合成音效与 3D 距离衰减 / 立体声声像
- [x] `js/hud.js` & `js/main.js`：像素心形生命栏、快捷栏图标、动态准星、受击方向指示器、旋转小地图、波次系统、掉落物、设置持久化及 `window.render_game_to_text` / `window.advanceTime` 测试钩子
- [x] Playwright 端到端闭环验证通过（0 控制台错误 / 0 警告）
