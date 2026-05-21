import Link from "next/link";

const nav = [
  { href: "/", label: "今週の対局" },
  { href: "/players", label: "棋士" },
  { href: "/amateurs", label: "アマ" },
  { href: "/accuracy", label: "精度" },
  { href: "/tournaments-amateur", label: "アマ大会" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-washi-100/8 bg-sumi-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-baseline gap-3">
          <span className="font-serif text-2xl font-bold tracking-wider text-washi-100 group-hover:text-shu-400 transition-colors">
            Shogi Edge
          </span>
          <span className="font-num text-[11px] uppercase tracking-[0.3em] text-sumi-400">
            data-driven yosou
          </span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-1.5 text-sm text-sumi-200 transition-colors hover:bg-sumi-800 hover:text-washi-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/admin"
          className="hidden text-xs text-sumi-400 hover:text-washi-100 md:inline"
        >
          管理
        </Link>
      </div>
      {/* mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-washi-100/5 px-6 py-2 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-sumi-200 hover:bg-sumi-800 hover:text-washi-100"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
