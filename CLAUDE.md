# GameSense（Komari 主题）

skeet / gamesense 菜单风格的 Komari 监控主题，只有深色外观。非官方作品。

- 界面：`src/App.vue`（水印、顶栏）、`src/views/HomeView.vue`（菜单窗口、左侧标签、离线列表）、`src/components/sense/`（窗口外框、节点分组框、可编辑控件）；样式集中在 `src/styles/main.css` 的 `.sk-*`。
- Visuals 标签里的选项定义、默认值和访客覆盖在 `src/sense/config.ts`，通过根元素的 `data-*` 生效。
- 数据层（`src/stores`、`src/utils`、`InstanceDetail`、图表）沿用 LiquidBounce 主题。
- 发布：工作区的 `tools/release-theme.sh gamesense X.Y.Z`。
