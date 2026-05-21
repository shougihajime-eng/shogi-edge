import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-serif text-6xl font-bold text-sumi-700">404</p>
        <p className="mt-4 font-serif text-xl">ページが見つかりません</p>
        <p className="mt-2 text-xs text-sumi-400">
          URLが間違っているか、削除された可能性があります。
        </p>
        <Link
          href="/"
          className="mt-8 rounded-lg border border-washi-100/10 px-5 py-2 text-sm hover:bg-sumi-800"
        >
          トップへ戻る
        </Link>
      </div>
    </PageShell>
  );
}
