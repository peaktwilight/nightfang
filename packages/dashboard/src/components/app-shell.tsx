import { Activity, Command, LayoutDashboard, Radar, ShieldAlert } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import type { DashboardResponse, ScanRecord } from "@/types";
import { Button } from "@/components/ui/button";

function routeLabel(pathname: string): string {
  if (pathname.startsWith("/findings")) return "Finding workbench";
  if (pathname.startsWith("/scans")) return "Scan dossier";
  return "Mission control";
}

function routeSummary(pathname: string): string {
  if (pathname.startsWith("/findings")) {
    return "Deduplicated findings, triage controls, and evidence panes.";
  }

  if (pathname.startsWith("/scans")) {
    return "Run timelines, grouped findings, and execution metadata.";
  }

  return "Overview of scans, findings, and operator state.";
}

export function AppShell({
  children,
  dashboard,
  scans,
  onOpenPalette,
}: {
  children: React.ReactNode;
  dashboard?: DashboardResponse;
  scans?: ScanRecord[];
  onOpenPalette: () => void;
}) {
  const location = useLocation();
  const newFamilies = dashboard?.groups.filter((group) => group.latest.triageStatus === "new").length ?? 0;
  const activeRuns = scans?.filter((scan) => scan.status === "running").length ?? 0;

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)]">
      <div className="xl:grid xl:min-h-screen xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-black/15 px-5 py-6 backdrop-blur-xl xl:flex xl:flex-col xl:gap-6">
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                pwnkit
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white">Operator shell</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                Local mission control for scans, evidence, and triage.
              </div>
            </div>

            <nav className="space-y-2">
              <ShellNavLink to="/dashboard" icon={LayoutDashboard} label="Overview" />
              <ShellNavLink to="/findings" icon={ShieldAlert} label="Findings" />
              <ShellNavLink to="/scans" icon={Radar} label="Scans" />
            </nav>
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Live state
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                  <span className="text-sm text-[var(--muted)]">New families</span>
                  <span className="text-xl font-semibold text-white">{newFamilies}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                  <span className="text-sm text-[var(--muted)]">Active runs</span>
                  <span className="text-xl font-semibold text-white">{activeRuns}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-[var(--muted)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Hotkeys
              </div>
              <div className="mt-3">`Cmd/Ctrl+K` command palette</div>
              <div>`/` quick launch</div>
              <div>`Esc` close overlays</div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(7,16,24,0.78)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-8">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  {routeLabel(location.pathname)}
                </div>
                <div className="text-lg font-semibold text-white">{routeSummary(location.pathname)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--muted)] lg:flex">
                  <Activity className="size-4 text-[var(--accent)]" />
                  {dashboard?.groups.length ?? 0} families tracked
                </div>
                <Button variant="accent" onClick={onOpenPalette}>
                  <Command className="size-4" />
                  Launchpad
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto flex max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">
            <nav className="flex gap-2 overflow-x-auto pb-1 xl:hidden">
              <MobileShellNav to="/dashboard" label="Overview" />
              <MobileShellNav to="/findings" label="Findings" />
              <MobileShellNav to="/scans" label="Scans" />
            </nav>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function ShellNavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={[
            "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
            isActive
              ? "border-[var(--accent)]/25 bg-[var(--accent)]/12 text-white"
              : "border-white/0 bg-transparent text-[var(--muted)] hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
          ].join(" ")}
        >
          <Icon className="size-4" />
          <span>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function MobileShellNav({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={[
            "rounded-full border px-3 py-2 text-sm whitespace-nowrap",
            isActive
              ? "border-[var(--accent)]/25 bg-[var(--accent)]/12 text-white"
              : "border-white/10 bg-white/[0.04] text-[var(--muted)]",
          ].join(" ")}
        >
          {label}
        </div>
      )}
    </NavLink>
  );
}
