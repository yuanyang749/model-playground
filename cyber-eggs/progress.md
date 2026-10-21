Original prompt: 我想以此类话题（赛博鸡蛋）制作一个爆款小游戏，要有创造力的那种，采用创意三《隔代夺蛋：2026》双时空同屏微操，结合多巴胺波普风格，使用原生 Canvas 2D + 轻量状态机实现。

## 已完成进度
- 完成 16:9 实机 UI 概念效果图生成，并以此为基准 1:1 还原顶部黑黄斜纹街机 HUD、中央粉黑锯齿闪电分屏、左屏红星早市王大妈与右屏 RGB 电竞房大孙子程序化矢量纸偶。
- 实现二阶弹簧物理 (`Spring`) 与 4 态颜艺状态机 (`NORMAL` / `ECSTATIC` / `SHOCKED` / `AWAKENED`)。
- 实现 Web Audio API 纯代码合成的多巴胺阶梯升调连击音、触电戒断音及双声道节奏 BGM。
- 实现《瓦里奥制造》式四大微操关卡串烧与《2026 赛博领蛋多巴胺基因诊断书》PNG 导出功能。
- 暴露 `window.render_game_to_text()` 与 `window.advanceTime(ms)` 并通过 Playwright 完成全流程无报错实机验证。
