# 比丘拟 PKUni_Latinex

面向北京大学拉丁语标准化考试公开范围的非官方真题制式模拟网站。

- GitHub Pages 公开版：<https://etymodes.github.io/PKUni_Latinex/>
- 完整账号版：<https://pkuni-latinex.peterpig123456.chatgpt.site>

## 已实现

- 初级、中级、混合难度、进阶四档训练
- 形态、句法、句式、词典回溯、古典阅读、分句翻译六类题目
- 客观题即时判分与翻译题对照自评
- 有序选题、随机洗牌与 180 分钟随机组卷
- ChatGPT 登录/注册、退出换号与 D1 云端学习进度
- 分难度词汇量测量、词头掌握统计和每日词源知识
- 依据北大考纲对 Wheelock 与 LLPSI 内容进行双轴映射
- Wheelock 全 40 章、LLPSI 全 35 章教材覆盖矩阵
- 400+ 道教材派生任务：词汇词典回溯、形态、句法、句式、古典语体和英译
- 北大正式制式（约 180 词整段英译）与知识诊断两种随机组卷
- 管理员题库覆盖、停用和自建题目后台
- 2017–2025 公开考试资料核验档案
- 响应式布局与键盘答题（数字键选择，Enter 提交）
- 吉祥物“哔丘 Pikku”：浅蓝、深蓝、白三色卡通丘鹬，经典动作是抬起一侧翅膀作“翅膀赞”；保持丘鹬长直喙结构
- 独立品牌 Logo 与站点图标（不使用或仿制北京大学校徽）

## 定位与免责声明

“真题模拟”指复现公开考试的作者范围、语言能力要求、约 180 词英译任务和 180 分钟时长。目前公开网络上没有找到可核验的历年完整原卷，本站不会把自拟题或任意原典节选冒充北京大学历年真题。网站与北京大学无隶属或授权关系。

调查过程与来源见 [`docs/past-paper-research.md`](docs/past-paper-research.md)。

题库取材、难度映射、版权边界和质量规则见 [`docs/question-bank-methodology.md`](docs/question-bank-methodology.md)。题目为根据教材知识点与公开考纲重新编写的训练材料，不复制教材练习，也不把模拟题标作历年真题。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 验证

```bash
npm run lint
npm run build
npm run build:pages
```
