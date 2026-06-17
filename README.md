# YJ飞行器

一个可直接部署到 GitHub Pages 的联机飞行棋网页。

## 当前功能

- 双页面结构：房间配置创建页 + 棋盘对战页
- 暗黑磨砂 UI，预留星云黑金、极光蓝紫、碳纤暗影三套皮肤
- Supabase 房间联网，支持跨设备实时同步
- 玩家加入后绑定专属颜色，只能操作自己的棋子
- 只有当前回合玩家可以掷骰子和走棋，其他玩家按钮置灰
- 当前回合玩家卡片高亮闪烁，并带回合切换提示
- 支持 2/3/4 人开局，空位由 AI 托管
- AI 自动掷骰子、走棋，随机中文昵称和头像
- 新玩家可在玩家面板接管 AI 席位
- 真人 + AI 混合回合队列，AI 走棋会同步给所有客户端
- 聊天、战况记录、快速聊天保留
- 全套交互音效：进房、回合切换、掷骰子、移动、拒绝操作
- WebAudio 合成循环 BGM，无需额外音乐文件
- 右上角音量按钮统一控制 BGM 和音效

## 文件说明

- `index.html`：页面结构
- `style.css`：界面样式和暗色皮肤
- `game.js`：游戏规则、AI、联机同步、音效
- `multiplayer-config.js`：Supabase 项目地址和可发布密钥
- `supabase-schema.sql`：Supabase 数据表和实时同步配置

## 部署

把下面这些文件上传到 GitHub 仓库根目录即可：

- `index.html`
- `style.css`
- `game.js`
- `multiplayer-config.js`
- `supabase-schema.sql`
- `README.md`

GitHub Pages 仍然选择 `main` 分支和 `/ root`，保存后访问仓库的 Pages 链接。

## Supabase 联机配置

你已经完成了主要配置，后续如果换项目，步骤是：

1. 在 Supabase 创建免费项目。
2. 打开 SQL Editor，运行 `supabase-schema.sql`。
3. 在 Project Settings -> API 中复制 Project URL 和 publishable key。
4. 填入 `multiplayer-config.js`。
5. 重新上传到 GitHub Pages。

注意：只能把 publishable key 放到网页里，不要把 secret key 上传到 GitHub。
