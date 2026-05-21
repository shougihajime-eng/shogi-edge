import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 bg-board-grid">
        {children}
      </main>
      <Footer />
    </>
  );
}
