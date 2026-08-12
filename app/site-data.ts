export type DrawResult = {
  issue: string;
  date: string;
  numbers: number[];
  special: number;
};

export const zodiacAnimals = [
  { name: "鼠", emoji: "🐭" }, { name: "牛", emoji: "🐮" },
  { name: "虎", emoji: "🐯" }, { name: "兔", emoji: "🐰" },
  { name: "龙", emoji: "🐲" }, { name: "蛇", emoji: "🐍" },
  { name: "马", emoji: "🐴" }, { name: "羊", emoji: "🐑" },
  { name: "猴", emoji: "🐵" }, { name: "鸡", emoji: "🐔" },
  { name: "狗", emoji: "🐶" }, { name: "猪", emoji: "🐷" },
] as const;
