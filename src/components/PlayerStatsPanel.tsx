import type { Player, PlayerStats } from "@/types/db";

interface Props {
  player: Player;
  stats: PlayerStats | null;
  side: "left" | "right";
}

export function PlayerStatsPanel({ player, stats, side }: Props) {
  const align = side === "left" ? "text-left" : "text-right";
  const items: { label: string; value: string }[] = [
    {
      label: "段位",
      value: player.rank,
    },
    {
      label: "レーティング",
      value: `R${player.rating.toFixed(0)}`,
    },
    ...(stats
      ? [
          {
            label: "直近1ヶ月",
            value:
              stats.recent_1m_wins + stats.recent_1m_losses > 0
                ? `${stats.recent_1m_wins}勝${stats.recent_1m_losses}敗 (.${(
                    (stats.recent_1m_wins / Math.max(1, stats.recent_1m_wins + stats.recent_1m_losses)) *
                    1000
                  )
                    .toFixed(0)
                    .padStart(3, "0")})`
                : "—",
          },
          {
            label: "通算",
            value:
              stats.total_wins + stats.total_losses > 0
                ? `${stats.total_wins}勝${stats.total_losses}敗`
                : "—",
          },
          {
            label: "現在",
            value:
              stats.current_streak === 0
                ? "—"
                : stats.current_streak > 0
                  ? `${stats.current_streak}連勝`
                  : `${-stats.current_streak}連敗`,
          },
          {
            label: "先手勝率",
            value:
              stats.sente_wins + stats.sente_losses > 0
                ? `.${((stats.sente_wins / (stats.sente_wins + stats.sente_losses)) * 1000)
                    .toFixed(0)
                    .padStart(3, "0")}`
                : "—",
          },
          {
            label: "後手勝率",
            value:
              stats.gote_wins + stats.gote_losses > 0
                ? `.${((stats.gote_wins / (stats.gote_wins + stats.gote_losses)) * 1000)
                    .toFixed(0)
                    .padStart(3, "0")}`
                : "—",
          },
        ]
      : []),
  ];

  return (
    <div className={`${align} space-y-4`}>
      <div>
        <h2 className="font-name text-2xl md:text-3xl font-semibold">{player.name}</h2>
        <p className="mt-1 text-xs text-sumi-400">
          {player.region === "tokyo" ? "東京" : player.region === "kansai" ? "関西" : ""}
          {player.master ? ` / 師匠 ${player.master}` : ""}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        {items.map((i) => (
          <div key={i.label} className={`${align} space-y-0.5`}>
            <dt className="text-[10px] uppercase tracking-wider text-sumi-500">{i.label}</dt>
            <dd className="font-num font-medium tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>
      {!stats && (
        <p className="text-[10px] text-sumi-500">
          直近成績の蓄積データ未登録 (管理画面から入力するとここに反映)
        </p>
      )}
    </div>
  );
}
