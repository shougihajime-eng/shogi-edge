import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated, logout } from "@/lib/auth/admin";

const nav = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/players", label: "棋士" },
  { href: "/admin/matches", label: "対局" },
  { href: "/admin/head-to-head", label: "直接対戦" },
  { href: "/admin/player-stats", label: "成績入力" },
  { href: "/admin/results", label: "結果確定" },
  { href: "/admin/weights", label: "重み調整" },
  { href: "/admin/reflections", label: "振り返り" },
  { href: "/admin/amateurs", label: "アマ選手" },
  { href: "/admin/import", label: "CSV一括取込" },
  { href: "/admin/wiki-sync", label: "Wikipedia 同期" },
  { href: "/admin/scraper-status", label: "自動取得状況" },
];

async function doLogout() {
  "use server";
  await logout();
  redirect("/admin/login");
}

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-sumi-950">
      <aside className="relative hidden w-56 shrink-0 border-r border-washi-100/8 bg-sumi-900/40 md:block">
        <div className="border-b border-washi-100/5 px-5 py-4">
          <Link href="/admin" className="font-serif text-lg font-semibold">
            Shogi Edge
          </Link>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-shu-400">admin</p>
        </div>
        <nav className="space-y-0.5 p-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-md px-3 py-2 text-xs text-sumi-200 hover:bg-sumi-800 hover:text-washi-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-washi-100/5 p-3">
          <form action={doLogout}>
            <button className="w-full rounded-md px-3 py-2 text-left text-xs text-sumi-400 hover:bg-sumi-800">
              ログアウト
            </button>
          </form>
          <Link
            href="/"
            className="block rounded-md px-3 py-2 text-xs text-sumi-400 hover:bg-sumi-800"
          >
            ← サイトに戻る
          </Link>
        </div>
      </aside>

      {/* mobile nav */}
      <div className="fixed top-0 z-30 flex w-full items-center justify-between border-b border-washi-100/5 bg-sumi-950/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/admin" className="font-serif text-base font-semibold">
          Shogi Edge 管理
        </Link>
        <form action={doLogout}>
          <button className="text-xs text-sumi-400">出</button>
        </form>
      </div>
      <main className="flex-1 px-6 py-8 md:px-10 pt-16 md:pt-8">
        <div className="md:hidden mb-4 -mx-2 overflow-x-auto">
          <div className="flex gap-1 px-2 whitespace-nowrap">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md border border-washi-100/8 px-3 py-1.5 text-[11px] text-sumi-200"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
