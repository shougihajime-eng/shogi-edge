"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { date: string; rating: number }[];
  currentRating: number;
}

export function RatingHistoryChart({ data, currentRating }: Props) {
  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
        <h3 className="mb-2 font-serif text-lg">レーティング推移</h3>
        <p className="text-xs text-sumi-400">
          スナップショットを 2 件以上入力するとここに推移グラフが出ます (現在値:{" "}
          <span className="font-num text-washi-100">R{currentRating.toFixed(0)}</span>)
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg">レーティング推移</h3>
        <span className="font-num text-xs text-sumi-300 tabular-nums">
          直近 {data.length} スナップショット
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(245,241,232,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9a9aa3", fontSize: 10 }}
              tickFormatter={(d: string) => d.slice(5)}
              stroke="#3b3b45"
            />
            <YAxis
              tick={{ fill: "#9a9aa3", fontSize: 10 }}
              stroke="#3b3b45"
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#16161a",
                border: "1px solid rgba(245,241,232,0.08)",
                fontSize: 11,
                color: "#f5f1e8",
              }}
              formatter={(v) => [`R${Number(v).toFixed(0)}`, "Rating"]}
            />
            <Line
              type="monotone"
              dataKey="rating"
              stroke="#c8102e"
              strokeWidth={2}
              dot={{ fill: "#c8102e", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
