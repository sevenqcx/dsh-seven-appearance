# Seven 外观 (`dsh-seven-appearance`)

基于 [RMvdesi/obsidian-prism](https://github.com/RMvdesi/obsidian-prism)（GPL-3.0-only）深度移植与定制的 DeepSeek Harness 外观与效率增强插件，涵盖主题配色、棱镜光效、像素伙伴舞台、本地动静态壁纸、统一模型与推理选择器、下一步提示词推荐、划词与右键侧边追问及会话工作台增强。

## 功能

### v1.0.0

- 正式更名为 **Seven 外观（Seven Appearance）** 并发布公开插件包 `dsh-seven-appearance`。
- 新增对话区右键菜单与侧边栏追问分支（与划词追问统一开关，按住 Shift 保留系统菜单）。
- 新增下一步提示词推荐：空输入框内联半透明幽灵文字，回复停住瞬间出建议（本地零延迟兜底 + 轻量模型流式预取升级，支持纯本地模式、`Tab` 填入、`Shift+Tab` 换一条）。
- 修复棱镜流光边框与超椭圆圆角贴合、正圆/胶囊保形，以及侧边追问栏防串框。

### v0.4.0

- 统一模型选择器：固定宽度、免翻页双栏、搜索与收藏、快捷键 `⌘⇧M`，适配 4 套主题。
- 推理等级滑块 + 切工水晶光效，档位跟随当前模型。
- 离线品牌 Logo 与 Magpie 逻辑分组（路由组 → Codex → Antigravity → AWS Quick）。
- 单击模型切换不关弹窗，双击或点外部关闭。

### v0.3.0

- 划选会话文字后，可引用、生成解释请求或复制；引用会填入输入框，发送前可继续编辑。
- 会话大纲增加搜索与分类；支持收起、固定和快捷键 `Alt+Shift+O`。
- 增加输入框棱镜光效、状态指示、回复动画和中英文切换。

## 原有功能

### Batch 2（v0.2.0 — 方向 A 视觉打磨）

1. **空会话主页 & 对话页 WebGL2 ASCII 矩阵涟漪与地平线光晕**
   - 完整集成 `vendor/ripple-core.js` WebGL2/2D 双栈引擎，挂载于 DSH 空会话 `[data-phase="hero"]` 与可选对话流 `[data-phase="active"]`
   - 鼠标滑过产生星云光晕与矩阵字符波动，点击触发扩散波纹，品牌标题区自动避让（Calm Zone）；静止时停止动画，后台页面清理画布，失焦时进入休眠；启用壁纸或流式回复时自动让位
2. **Smoked Obsidian 黑曜切面质感统一**
   - 覆盖用户消息气泡 `[data-message-bubble]`、工具调用与思考折叠块 `[data-tool]` / `[data-chat-group-part="reasoning"]`、交付物与 Diff 审查卡片 `[data-presented-file]` / `[data-changed-files]` / `[data-changes-review]`、内联路径芯片与立体 `kbd` 键帽
   - 4 套深浅主题（Obsidian / Warm / Crystal / Alabaster）均独立校准高光切面与 Diff 边条色板，可随时通过「黑曜切面质感统一」总开关一键还原
3. **场景预设 & 配置 JSON 导入/导出**
   - 内置三档场景预设：**完整光效**（Full Prism）、**专注编码**（Focus Code）、**静默省电**（Quiet Eco），切换时保留当前明暗调色板与本地壁纸
   - 支持导出 `obsidian-prism-config.json` 与导入恢复（导出自动剥离本机壁纸绑定，导入时自动保留目标机器现有本地壁纸）

### Batch 1（v0.1.0 基础套件）

1. **四套精选深浅主题 & 强调色系统**
   - 深色：`Obsidian 黑曜`（冷曜钴蓝）、`Warm Charcoal 暖炭`（沉稳暖炭陶橙）
   - 浅色：`Crystal 晶白`（清透瓷白）、`Alabaster 暖陶`（温润纸白）
   - 8 档强调色（跟随主题 / 棱镜 / 钴蓝 / 暖陶 / 翠绿 / 紫晶 / 琥珀 / 玫瑰）、3 档界面圆角、5 款等宽代码字体
   - 映射至 DSH 原生 `--dsw-alias-*` / `--dsw-specific-*` CSS 变量，自动跟随 DSH `data-ds-dark-theme`，支持一键总开关还原原生外观
2. **棱镜微光、流式淡入与丝滑光标**
   - 输入框棱镜光环（`@property` 旋转棱镜描边，聚焦/流式生成时动态提亮）与柔和环境氛围光晕
   - 流式回复文字淡入（基于 CSS Custom Highlight API，零 DOM 侵入）
   - 输入框丝滑弹簧光标（支持 `<textarea>` 与 `contenteditable`）
3. **可交互像素伙伴舞台（含 Deepy 像素鲸鱼）**
   - 完整集成 `dual-mascot-rig.js` 像素物理引擎，驻留于 `[data-composer-card]` 上沿
   - 支持拖拽、点击互动、流式生成工作态，预设涵盖双宠（Clawd + Cat）、迷你蟹群、四宠（含 Deepy 鲸鱼 & 像素龙）以及单宠模式
4. **本地自定义图片 / 视频壁纸服务**
   - Host 端 HTTP 接口存储于 `~/.dsh/obsidian-prism/wallpapers/`，支持 PNG/JPG/WebP/GIF/AVIF/MP4/WebM/MOV（最大 80MB）
   - 视频流支持标准 HTTP `Range` (`206 Partial Content`) 播放，切后台自动暂停省电；提供不透明度、模糊度、卡片磨砂透底调节
5. **会话工作台增强**
   - 长代码块自动折叠 + 吸顶语言/行数操作栏（可自定义行数阈值）
   - 右侧悬浮会话大纲导航（超过 2 轮提问自动出现，悬停预览、点击平滑跳转）
6. **双入口实时外观工坊**
   - 原生注册到 DSH **设置 → Seven 外观** 独立分区
   - 右下角轻巧快捷入口按钮 + 全局快捷键 `Alt+Shift+P` 随时唤出侧滑抽屉，设置持久化至 `~/.dsh/obsidian-prism/settings.json`

## 构建与测试

```bash
npm run build   # 打包 vendor/dual-mascot-rig.js + src/*.js -> client.js
npm run check   # 校验 index.js 与 client.js 语法
npm test        # 构建并运行全部单元测试
```

## 开源协议与致谢

本插件遵循 **GNU General Public License v3.0 (GPL-3.0-only)**，详见 `LICENSE`、`NOTICE` 与 `THIRD_PARTY_NOTICES.md`。
