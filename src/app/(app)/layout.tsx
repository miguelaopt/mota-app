import { TabBar } from "@/components/TabBar";
import { UndoProvider } from "@/components/undo/UndoProvider";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  return (
    <UndoProvider>
      <main className="app-main mx-auto w-full max-w-lg">{children}</main>
      <TabBar />
    </UndoProvider>
  );
}
