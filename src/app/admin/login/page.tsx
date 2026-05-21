import { redirect } from "next/navigation";
import { loginWithPassword, isAuthenticated } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const ok = await loginWithPassword(password);
  if (ok) redirect("/admin");
  redirect("/admin/login?err=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  if (await isAuthenticated()) redirect("/admin");
  const { err } = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 bg-board-grid">
      <h1 className="font-serif text-3xl font-bold mb-2">管理画面</h1>
      <p className="text-xs text-sumi-400 mb-8">合言葉を入力してください。</p>
      <form action={login} className="w-full space-y-3">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="合言葉"
          className="w-full rounded-lg border border-washi-100/10 bg-sumi-900 px-4 py-3 text-base placeholder-sumi-500 focus:border-shu-500 focus:outline-none"
        />
        {err === "1" ? (
          <p className="text-xs text-shu-400">合言葉が違います。</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-lg bg-shu-500 px-4 py-3 text-sm font-medium text-washi-100 hover:bg-shu-600"
        >
          ログイン
        </button>
      </form>
      <p className="mt-8 text-[11px] text-sumi-500">
        合言葉を変更したい場合は .env.local の ADMIN_PASSWORD と Vercel 環境変数を書き換えてください。
      </p>
    </div>
  );
}
