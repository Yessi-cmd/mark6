"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrawResult } from "./site-data";
import { zodiacAnimals } from "./site-data";

type View = "home" | "history" | "zodiac" | "forecast" | "mystery" | "trend";
type DailyForecast = {
  dateText: string;
  zodiacs: number[];
  six: number[];
  eight: number[];
  specials: number[];
  wave: "红波" | "蓝波" | "绿波";
  tails: number[];
  poem: string[];
  mysteryTitle: string;
  mysteryNumber: number;
};

const navItems: { view: View; icon: string; label: string }[] = [
  { view: "home", icon: "首", label: "首页" },
  { view: "history", icon: "开", label: "开奖" },
  { view: "zodiac", icon: "肖", label: "生肖" },
  { view: "forecast", icon: "参", label: "资料" },
  { view: "trend", icon: "势", label: "走势" },
];

const redNumbers = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]);
const blueNumbers = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]);

function numberColor(value: number) {
  if (redNumbers.has(value)) return "red";
  if (blueNumbers.has(value)) return "blue";
  return "green";
}

function isDrawResult(value: unknown): value is DrawResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DrawResult>;
  const allNumbers = Array.isArray(record.numbers) ? [...record.numbers, record.special] : [];
  return typeof record.issue === "string"
    && /^\d{7}$/.test(record.issue)
    && typeof record.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    && Array.isArray(record.numbers)
    && record.numbers.length === 6
    && allNumbers.length === 7
    && allNumbers.every((number) => Number.isInteger(number) && Number(number) >= 1 && Number(number) <= 49)
    && new Set(allNumbers).size === 7;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickMany(total: number, count: number, random: () => number) {
  const pool = Array.from({ length: total }, (_, index) => index + 1);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function createDailyForecast(issue: string): DailyForecast {
  const now = new Date();
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const random = seededRandom(hashSeed(`${date}-${issue}-safemark6`));
  const zodiacs = pickMany(12, 4, random).map((value) => value - 1);
  const eight = pickMany(49, 8, random);
  const six = pickMany(12, 6, random).map((value) => value - 1);
  const specials = pickMany(49, 4, random);
  const wave = (["红波", "蓝波", "绿波"] as const)[Math.floor(random() * 3)];
  const poemTemplates = [
    ["山前猛虎下山岗", "一轮明月照西窗", "三更犬吠人归晚", "一马当先入彩堂"],
    ["清风拂柳月初升", "灵蛇绕树静无声", "金鸡报晓迎新日", "白兔衔春过小桥"],
    ["云开远岭见青松", "牛踏春泥步步稳", "猿啼深谷人初醒", "飞龙乘势上长空"],
  ];
  return {
    dateText: date,
    zodiacs,
    six,
    eight,
    specials,
    wave,
    tails: pickMany(10, 3, random).map((value) => value - 1),
    poem: poemTemplates[Math.floor(random() * poemTemplates.length)],
    mysteryTitle: ["云岭寻踪", "月下听松", "桥畔春声"][Math.floor(random() * 3)],
    mysteryNumber: Math.floor(random() * 9) + 1,
  };
}

function zodiacForNumber(value: number) {
  const currentYearZodiacIndex = 6; // 2026 丙午马年
  return zodiacAnimals[(currentYearZodiacIndex - ((value - 1) % 12) + 12) % 12];
}

function zodiacNumbers(index: number) {
  const currentYearZodiacIndex = 6;
  const start = ((currentYearZodiacIndex - index + 12) % 12) + 1;
  return Array.from({ length: 5 }, (_, offset) => start + offset * 12).filter((value) => value <= 49);
}

function Ball({ value, special = false, compact = false }: { value: number; special?: boolean; compact?: boolean }) {
  return (
    <span className={`number-ball ${numberColor(value)}${special ? " special" : ""}${compact ? " compact" : ""}`} aria-label={`${special ? "特码" : "号码"} ${value}`}>
      {String(value).padStart(2, "0")}
    </span>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="back-button" onClick={onClick}><span aria-hidden="true">‹</span> 返回首页</button>;
}

function Notice() {
  return (
    <div className="notice" role="note">
      <span className="notice-mark" aria-hidden="true">娱</span>
      <div><strong>娱乐资料说明</strong><p>以下内容由固定规则随机生成，不代表真实预测能力，请理性阅读。</p></div>
    </div>
  );
}

function MysteryArtwork({ forecast, expanded = false }: { forecast: DailyForecast; expanded?: boolean }) {
  const animals = forecast.zodiacs.slice(0, 3).map((index) => zodiacAnimals[index]);
  return (
    <div className={`mystery-art${expanded ? " expanded-art" : ""}`} role="img" aria-label={`今日玄机图：${animals.map((animal) => animal.name).join("、")}`}>
      <div className="art-sun" />
      <div className="art-cloud cloud-one" /><div className="art-cloud cloud-two" />
      <div className="art-mountain mountain-back" /><div className="art-mountain mountain-front" />
      <div className="art-river" /><div className="art-bridge" />
      <div className="art-bamboo">竹<br />影</div>
      <span className="art-animal animal-main">{animals[0].emoji}</span>
      <span className="art-animal animal-side">{animals[1].emoji}</span>
      <span className="art-animal animal-small">{animals[2].emoji}</span>
      <div className="art-seal">{forecast.mysteryNumber}</div>
      <div className="art-copy"><small>每日玄机图</small><strong>{forecast.mysteryTitle}</strong><span>静观 · 自得 · 随缘</span></div>
    </div>
  );
}

function HomeView({ latest, forecast, navigate, openImage }: { latest: DrawResult; forecast: DailyForecast; navigate: (view: View) => void; openImage: () => void }) {
  const specialZodiac = zodiacForNumber(latest.special);
  return (
    <>
      <section className="hero card" id="draw">
        <SectionHeader eyebrow="官方数据 · 自动更新" title="最新开奖记录" action={<span className="date-chip">{latest.date}</span>} />
        <div className="draw-meta">
          <strong>第 {latest.issue} 期</strong>
          <span><i className="verified-dot" aria-hidden="true">✓</i> 已核对香港马会开奖记录</span>
        </div>
        <div className="draw-grid">
          <div className="regular-numbers" aria-label="六个正码">
            {latest.numbers.map((number) => <div className="ball-wrap" key={number}><Ball value={number} /><span>{zodiacForNumber(number).name}</span></div>)}
          </div>
          <span className="plus">＋</span>
          <div className="special-wrap"><div className="ball-wrap"><Ball value={latest.special} special /><span>{specialZodiac.emoji} {specialZodiac.name}</span></div><b>特码</b></div>
        </div>
        <button className="primary-button" onClick={() => navigate("history")}>查看全部开奖记录 <span aria-hidden="true">›</span></button>
      </section>

      <section className="card forecast-card" id="forecast">
        <SectionHeader eyebrow="每日固定 · 隔日更新" title="今日参考资料" action={<span className="seed-date">{forecast.dateText}</span>} />
        <Notice />
        <div className="forecast-block">
          <h3><span className="tiny-icon">肖</span> 今日生肖参考</h3>
          <div className="zodiac-picks">
            {forecast.zodiacs.map((index) => <span className="zodiac-pill" key={index}><i>{zodiacAnimals[index].emoji}</i><b>{zodiacAnimals[index].name}</b></span>)}
          </div>
        </div>
        <div className="forecast-block">
          <h3><span className="tiny-icon">八</span> 今日八码</h3>
          <div className="mini-balls">{forecast.eight.map((number) => <Ball key={number} value={number} compact />)}</div>
        </div>
        <div className="forecast-summary">
          <div><span>波色参考</span><strong className={`wave ${forecast.wave === "红波" ? "red-text" : forecast.wave === "蓝波" ? "blue-text" : "green-text"}`}>● {forecast.wave}</strong></div>
          <div><span>尾数参考</span><strong>{forecast.tails.join(" · ")}</strong></div>
        </div>
        <button className="text-button" onClick={() => navigate("forecast")}>查看完整今日资料 <span aria-hidden="true">›</span></button>
      </section>

      <section className="card mystery-card" id="mystery">
        <SectionHeader eyebrow="每日一图" title="今日玄机图" action={<button className="plain-action" onClick={() => navigate("mystery")}>查看解读</button>} />
        <button className="image-button" onClick={openImage} aria-label="放大查看今日玄机图"><MysteryArtwork forecast={forecast} /><span className="zoom-hint"><b aria-hidden="true">＋</b> 点击图片，放大查看</span></button>
      </section>

      <section className="card poem-card">
        <SectionHeader eyebrow="每日一诗" title="今日玄机诗" />
        <blockquote>{forecast.poem.map((line) => <span key={line}>{line}</span>)}</blockquote>
        <p>参考：{forecast.zodiacs.slice(0, 3).map((index) => zodiacAnimals[index].name).join(" / ")}</p>
      </section>

      <section className="card shortcuts">
        <SectionHeader eyebrow="常用入口" title="热门资料" />
        <div className="shortcut-grid">
          <button onClick={() => navigate("forecast")}><span>壹</span><b>平特一肖</b><small>今日参考</small></button>
          <button onClick={() => navigate("forecast")}><span>陆</span><b>六肖参考</b><small>每日固定</small></button>
          <button onClick={() => navigate("zodiac")}><span>肖</span><b>生肖号码</b><small>2026 年表</small></button>
          <button onClick={() => navigate("trend")}><span>势</span><b>波色走势</b><small>近期开奖</small></button>
        </div>
      </section>
    </>
  );
}

function HistoryView({ results, onBack }: { results: DrawResult[]; onBack: () => void }) {
  const [visible, setVisible] = useState(6);
  return <section className="card page-card"><BackButton onClick={onBack} /><SectionHeader eyebrow={`已收录 ${results.length} 期`} title="历史开奖记录" /><p className="source-note">开奖记录来自香港马会公开结果，经格式、日期及号码完整性校验后收录。</p><div className="history-list">{results.slice(0, visible).map((result) => <article key={result.issue}><div><b>第 {result.issue} 期</b><time>{result.date}</time></div><div className="history-balls">{result.numbers.map((number) => <Ball key={number} value={number} compact />)}<span className="history-plus">＋</span><Ball value={result.special} compact special /></div></article>)}</div>{visible < results.length && <button className="primary-button" onClick={() => setVisible((value) => value + 12)}>查看更多记录</button>}</section>;
}

function ZodiacView({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <section className="card page-card"><BackButton onClick={onBack} /><SectionHeader eyebrow="2026 丙午马年" title="十二生肖号码表" /><p className="page-intro">点击任一生肖，可单独放大查看对应号码。</p><div className="zodiac-table">{zodiacAnimals.map((animal, index) => <button className={selected === index ? "selected" : ""} key={animal.name} onClick={() => setSelected(selected === index ? null : index)}><span className="zodiac-face">{animal.emoji}</span><b>{animal.name}</b><span className="zodiac-numbers">{zodiacNumbers(index).map((number) => String(number).padStart(2, "0")).join(" · ")}</span></button>)}</div>{selected !== null && <div className="zodiac-detail" role="status"><span>{zodiacAnimals[selected].emoji}</span><div><small>{zodiacAnimals[selected].name}肖号码</small><strong>{zodiacNumbers(selected).map((number) => String(number).padStart(2, "0")).join("　")}</strong></div></div>}</section>;
}

function ForecastView({ forecast, onBack }: { forecast: DailyForecast; onBack: () => void }) {
  const sources = ["金算盘", "老码书", "福星堂", "六合先生", "好运婆婆"];
  return <section className="card page-card"><BackButton onClick={onBack} /><SectionHeader eyebrow={forecast.dateText} title="今日完整资料" /><Notice /><div className="detail-group"><h3>生肖参考</h3><div className="zodiac-picks">{forecast.zodiacs.map((index) => <span className="zodiac-pill" key={index}><i>{zodiacAnimals[index].emoji}</i><b>{zodiacAnimals[index].name}</b></span>)}</div></div><div className="detail-group"><h3>六肖参考</h3><p className="large-copy">{forecast.six.map((index) => zodiacAnimals[index].name).join(" · ")}</p></div><div className="detail-group"><h3>八码参考</h3><div className="mini-balls">{forecast.eight.map((number) => <Ball key={number} value={number} compact />)}</div></div><div className="detail-group"><h3>特码参考</h3><div className="mini-balls">{forecast.specials.map((number) => <Ball key={number} value={number} compact />)}</div></div><div className="forecast-summary"><div><span>波色参考</span><strong>{forecast.wave}</strong></div><div><span>尾数参考</span><strong>{forecast.tails.join(" · ")}</strong></div></div><h3 className="subheading">多份资料互相参考</h3><div className="source-list">{sources.map((source, sourceIndex) => <div key={source}><b>{source}</b><span>{forecast.six.slice(sourceIndex % 3, sourceIndex % 3 + 3).map((index) => zodiacAnimals[index].name).join(" · ")}</span></div>)}</div></section>;
}

function MysteryView({ forecast, onBack, openImage }: { forecast: DailyForecast; onBack: () => void; openImage: () => void }) {
  return <section className="card page-card"><BackButton onClick={onBack} /><SectionHeader eyebrow="每日一图" title="玄机图解读" /><button className="image-button" onClick={openImage} aria-label="放大查看今日玄机图"><MysteryArtwork forecast={forecast} expanded /><span className="zoom-hint"><b aria-hidden="true">＋</b> 点击图片，放大查看</span></button><div className="interpretation"><h3>观图提示</h3><p>画中取山、水、桥与生肖意象，以传统码书形式呈现。今日图中出现的生肖为 <strong>{forecast.zodiacs.slice(0, 3).map((index) => zodiacAnimals[index].name).join("、")}</strong>，数字印记为 <strong>{forecast.mysteryNumber}</strong>。</p><p>图文均为娱乐随机资料，不具备预测未来开奖结果的能力。</p></div></section>;
}

function TrendView({ results, onBack }: { results: DrawResult[]; onBack: () => void }) {
  const sample = results.slice(0, 10);
  const waveCounts = { red: 0, blue: 0, green: 0 };
  const zodiacCounts = Array(12).fill(0) as number[];
  let odd = 0;
  let big = 0;
  sample.forEach((result) => {
    if (redNumbers.has(result.special)) waveCounts.red += 1; else if (blueNumbers.has(result.special)) waveCounts.blue += 1; else waveCounts.green += 1;
    zodiacCounts[zodiacAnimals.indexOf(zodiacForNumber(result.special))] += 1;
    if (result.special % 2) odd += 1;
    if (result.special >= 25) big += 1;
  });
  const max = Math.max(...zodiacCounts, 1);
  return <section className="card page-card"><BackButton onClick={onBack} /><SectionHeader eyebrow={`近 ${sample.length} 期真实记录`} title="简单走势统计" /><div className="notice calm"><span className="notice-mark">i</span><div><strong>请注意</strong><p>历史结果不影响下一期开奖概率。</p></div></div><h3 className="subheading">特码生肖出现次数</h3><div className="bar-chart">{zodiacAnimals.map((animal, index) => <div key={animal.name}><span>{animal.name}</span><i><em style={{ width: `${(zodiacCounts[index] / max) * 100}%` }} /></i><b>{zodiacCounts[index]} 次</b></div>)}</div><h3 className="subheading">分类统计</h3><div className="stat-grid"><div><span>红波</span><b>{waveCounts.red}</b></div><div><span>蓝波</span><b>{waveCounts.blue}</b></div><div><span>绿波</span><b>{waveCounts.green}</b></div><div><span>单数</span><b>{odd}</b></div><div><span>双数</span><b>{sample.length - odd}</b></div><div><span>大数</span><b>{big}</b></div></div></section>;
}

export function HomeClient({ initialResults }: { initialResults: DrawResult[] }) {
  const [view, setView] = useState<View>("home");
  const [results, setResults] = useState(initialResults);
  const [fontSize, setFontSize] = useState<"large" | "xlarge">(() => {
    if (typeof window === "undefined") return "large";
    return window.localStorage.getItem("safemark6-font") === "xlarge" ? "xlarge" : "large";
  });
  const [imageOpen, setImageOpen] = useState(false);
  const forecast = useMemo(() => createDailyForecast(results[0].issue), [results]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/results.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0 && data.every(isDrawResult)) setResults(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js?v=2", { updateViaCache: "none" })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.font = fontSize;
    window.localStorage.setItem("safemark6-font", fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (!imageOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setImageOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageOpen]);

  const navigate = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate("home")} aria-label="返回天天好彩首页"><span className="brand-copy"><strong>天天好彩</strong><small>六合资料 · 安心阅读</small></span></button>
          <div className="font-control" aria-label="字体大小"><span>字号</span><button className={fontSize === "large" ? "active" : ""} onClick={() => setFontSize("large")} aria-pressed={fontSize === "large"}>大</button><button className={fontSize === "xlarge" ? "active" : ""} onClick={() => setFontSize("xlarge")} aria-pressed={fontSize === "xlarge"}>特大</button></div>
        </div>
      </header>

      <main>
        {view === "home" && <HomeView latest={results[0]} forecast={forecast} navigate={navigate} openImage={() => setImageOpen(true)} />}
        {view === "history" && <HistoryView results={results} onBack={() => navigate("home")} />}
        {view === "zodiac" && <ZodiacView onBack={() => navigate("home")} />}
        {view === "forecast" && <ForecastView forecast={forecast} onBack={() => navigate("home")} />}
        {view === "mystery" && <MysteryView forecast={forecast} onBack={() => navigate("home")} openImage={() => setImageOpen(true)} />}
        {view === "trend" && <TrendView results={results} onBack={() => navigate("home")} />}
      </main>

      <footer><span className="footer-seal" aria-hidden="true">安</span><strong>天天好彩 · 六合资料</strong><p>本站仅提供开奖记录查询、历史统计和娱乐资料，不提供任何投注、充值、交易、客服或博彩服务。</p><p>本站并非香港马会官方网站；开奖记录以香港马会最终公布为准。</p><p className="footer-points"><span>无广告</span><span>无外链</span><span>不收集个人资料</span></p></footer>
      <nav className="bottom-nav" aria-label="主要导航">{navItems.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)} aria-current={view === item.view ? "page" : undefined}><span aria-hidden="true">{item.icon}</span><b>{item.label}</b></button>)}</nav>

      {imageOpen && <div className="image-modal" role="dialog" aria-modal="true" aria-label="放大查看玄机图"><button className="modal-close" onClick={() => setImageOpen(false)}>× 关闭大图</button><div className="modal-scroll"><MysteryArtwork forecast={forecast} expanded /></div><p>可使用双指缩放查看细节</p></div>}
    </div>
  );
}
