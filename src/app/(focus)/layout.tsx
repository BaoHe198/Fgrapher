// Focused flows (Core MVP pass, 02/10/2026): booking a shoot has no
// marketing header or footer - nothing to wander off to mid-request. The
// flow draws its own slim header (Thoát, who you are booking, draft state)
// and a fixed bottom bar.
export default function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="flex min-h-full flex-col bg-bg-page">
      {children}
    </main>
  );
}
