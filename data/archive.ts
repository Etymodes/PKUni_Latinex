export type ArchiveEntry = {
  year: string;
  levels: string;
  verified: string;
  paperStatus: "未发现公开原卷" | "未检出举行记录";
  sourceLabel: string;
  sourceUrl: string;
};

export const archiveEntries: ArchiveEntry[] = [
  { year: "2017.09", levels: "初级拉丁语", verified: "首场考试；3 小时；约 180 词；Caesar 或 Cornelius Nepos 原文英译。", paperStatus: "未发现公开原卷", sourceLabel: "2017 考试通知（人大转载）", sourceUrl: "https://history.ruc.edu.cn/tzgg/3d53cbbed6eb4f6ca271c32780b2126f.htm" },
  { year: "2018.04", levels: "初级拉丁语", verified: "第二场初级考试；命题人访谈确认从古典拉丁语语料库选择适合水平的段落。", paperStatus: "未发现公开原卷", sourceLabel: "命题人访谈（文汇）", sourceUrl: "https://wenhui.whb.cn/zhuzhan/xueren/20180427/196410.html" },
  { year: "2019", levels: "初级／中级", verified: "公开刊物保存了当期考试标准与范围；搜索未见试卷正文。", paperStatus: "未发现公开原卷", sourceLabel: "《拉丁语言文化研究》第 7 期", sourceUrl: "https://www.latinitassinica.com/wp-content/uploads/2019/06/issue-n7-final1.pdf" },
  { year: "2020", levels: "—", verified: "在北大现有公开栏目与全网索引中未检出该年度举行通知；不能仅据此断言官方取消。", paperStatus: "未检出举行记录", sourceLabel: "北大标准化考试栏目", sourceUrl: "https://www.history.pku.edu.cn/xfgdxzx/ldyks/index.htm" },
  { year: "2021.05", levels: "初级／中级", verified: "5 月 29 日 13:00–16:00；首次在北京大学与东北师范大学两地同时举行。", paperStatus: "未发现公开原卷", sourceLabel: "2021 官方通知", sourceUrl: "https://www.history.pku.edu.cn/xwgg/tzgg1/9b1eb98066984a12baaf9cad882ef038.htm" },
  { year: "2022.05", levels: "初级／中级", verified: "北大与东北师大考点；初、中级同日 13:00–16:00。", paperStatus: "未发现公开原卷", sourceLabel: "2022 官方通知", sourceUrl: "https://www.history.pku.edu.cn/xwgg/tzgg1/58899273bf1348b992aa0b8e1975c92c.htm" },
  { year: "2023.05", levels: "初级／中级", verified: "北大、东北师大、复旦三地；公开 9 页范围说明，但不含当年试卷。", paperStatus: "未发现公开原卷", sourceLabel: "2023 官方范围 PDF", sourceUrl: "https://www.history.pku.edu.cn/docs/2023-03/5b58d945239d4527adff7d20c8610aac.pdf" },
  { year: "2024.05", levels: "初级／中级", verified: "北大、东北师大、复旦三地；北京考点为理科教学楼 102。", paperStatus: "未发现公开原卷", sourceLabel: "2024 北大考场通知", sourceUrl: "https://www.history.pku.edu.cn/xwgg/tzgg1/9ada5223be62480ea58406a01fc9795f.htm" },
  { year: "2025.05", levels: "初级／中级", verified: "考试范围与 2023–2024 连续；初级指定 Caesar/Nepos，中级指定 Sallust/Cicero。", paperStatus: "未发现公开原卷", sourceLabel: "2025 官方通知与范围", sourceUrl: "https://www.history.pku.edu.cn/xwgg/tzgg1/60d5c328becc479581e6b256668edd4f.htm" },
  { year: "2026", levels: "—", verified: "截至 2026-07-13，官方站内与全网索引均未检出 2026 届举行通知；本站不据此推定永久停办。", paperStatus: "未检出举行记录", sourceLabel: "北大通知公告索引", sourceUrl: "https://www.history.pku.edu.cn/xwgg/tzgg1/index1.htm" }
];
