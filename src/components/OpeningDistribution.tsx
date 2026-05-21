"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const OPENING_LABEL: Record<string, string> = {
  ai_kakari: "相掛かり",
  kakugawari: "角換わり",
  yokofudori: "横歩取り",
  yagura: "矢倉",
  gangi: "雁木",
  shikenbisha: "四間飛車",
  sankenbisha: "三間飛車",
  nakabisha: "中飛車",
  mukaibisha: "向かい飛車",
  gokigen: "ゴキゲン中飛車",
  fujii_system: "藤井システム",
  other: "その他",
};

const COLORS = ["#c8102e", "#1b3a5c", "#b8860b", "#a40d24", "#2d4f78", "#df6470", "#6a8aad", "#d4a73f"];

interface Props {
  dist: Record<string, number> | null;
}

export function OpeningDistribution({ dist }: Props) {
  if (!dist || Object.keys(dist).length === 0) {
    return (
      <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
        <h3 className="mb-2 font-serif text-lg">想定戦型</h3>
        <p className="text-xs text-sumi-400">
          直接対戦履歴が無いため戦型予測は判断保留。両者の直近棋譜から手動で登録可能。
        </p>
      </div>
    );
  }
  const data = Object.entries(dist)
    .map(([k, v]) => ({ name: OPENING_LABEL[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <h3 className="mb-3 font-serif text-lg">想定戦型</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={40}
                outerRadius={70}
                stroke="#07070a"
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#16161a",
                  border: "1px solid rgba(245,241,232,0.08)",
                  fontSize: 11,
                  color: "#f5f1e8",
                }}
                formatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {d.name}
              </span>
              <span className="font-num tabular-nums text-sumi-300">
                {(d.value * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
