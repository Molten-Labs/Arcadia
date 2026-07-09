/**
 * Content column beside the desktop sidebar. Offsets left by the rail width at
 * >= md (where the sidebar shows, for guests and connected users alike); mobile
 * renders full-bleed beneath the bottom bar. Reserves bottom space on mobile so
 * scrolled content clears the fixed bottom nav + the iOS home-indicator safe area.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-14">
      <div className="flex flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
    </div>
  );
}
