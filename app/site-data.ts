export type DrawResult = {
  issue: string;
  date: string;
  numbers: number[];
  special: number;
};

export const results: DrawResult[] = [
  { issue: "2026088", date: "2026-08-11", numbers: [8, 17, 26, 32, 41, 45], special: 12 },
  { issue: "2026087", date: "2026-08-09", numbers: [4, 11, 19, 28, 35, 47], special: 23 },
  { issue: "2026086", date: "2026-08-07", numbers: [2, 14, 21, 30, 39, 46], special: 7 },
  { issue: "2026085", date: "2026-08-05", numbers: [6, 13, 18, 27, 34, 42], special: 49 },
  { issue: "2026084", date: "2026-08-03", numbers: [1, 9, 16, 25, 37, 44], special: 31 },
  { issue: "2026083", date: "2026-08-01", numbers: [5, 12, 20, 29, 36, 48], special: 15 },
  { issue: "2026082", date: "2026-07-30", numbers: [3, 10, 17, 24, 38, 43], special: 26 },
  { issue: "2026081", date: "2026-07-28", numbers: [7, 14, 22, 33, 40, 45], special: 18 },
  { issue: "2026080", date: "2026-07-26", numbers: [2, 8, 19, 27, 35, 41], special: 30 },
  { issue: "2026079", date: "2026-07-24", numbers: [6, 11, 23, 31, 39, 47], special: 16 },
  { issue: "2026078", date: "2026-07-22", numbers: [4, 13, 20, 28, 37, 49], special: 9 },
  { issue: "2026077", date: "2026-07-20", numbers: [1, 15, 21, 32, 42, 46], special: 25 },
];

export const zodiacAnimals = [
  { name: "鼠", emoji: "🐭" }, { name: "牛", emoji: "🐮" },
  { name: "虎", emoji: "🐯" }, { name: "兔", emoji: "🐰" },
  { name: "龙", emoji: "🐲" }, { name: "蛇", emoji: "🐍" },
  { name: "马", emoji: "🐴" }, { name: "羊", emoji: "🐑" },
  { name: "猴", emoji: "🐵" }, { name: "鸡", emoji: "🐔" },
  { name: "狗", emoji: "🐶" }, { name: "猪", emoji: "🐷" },
] as const;
