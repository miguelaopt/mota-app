import { TabBar } from "@/components/TabBar";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  return (
    <>
      <main className="app-main mx-auto w-full max-w-lg">{children}</main>
      <TabBar />
    </>
  );
}
