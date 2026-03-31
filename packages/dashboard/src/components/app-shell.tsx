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
      <div className="xl:grid xl:min-h-screen xl:grid-cols-[4.5rem_15rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/8 bg-black/30 xl:flex xl:flex-col xl:items-center xl:py-5">
          <div className="flex h-full flex-col items-center gap-4">
            <BrandGlyph compact />
            <nav className="flex flex-col gap-2">
              <RailNavLink to="/dashboard" icon={LayoutDashboard} label="Overview" />
              <RailNavLink to="/findings" icon={ShieldAlert} label="Findings" />
              <RailNavLink to="/scans" icon={Radar} label="Scans" />
            </nav>
            <div className="mt-auto">
              <Button variant="ghost" size="icon" onClick={onOpenPalette} aria-label="Open launchpad">
                <Command className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        <aside className="hidden border-r border-white/8 bg-black/18 px-4 py-5 xl:flex xl:flex-col xl:gap-5">
          <div className="space-y-2 border-b border-white/8 pb-4">
            <BrandGlyph />
            <div className="text-xl font-bold tracking-tight text-white">Operator shell</div>
            <div className="text-sm leading-6 text-[var(--muted)]">
              Local mission control for scans, evidence, and triage.
            </div>
          </div>

          <nav className="space-y-1">
            <ShellNavLink to="/dashboard" icon={LayoutDashboard} label="Overview" meta="Snapshot and priorities" />
            <ShellNavLink to="/findings" icon={ShieldAlert} label="Findings" meta="Families, evidence, triage" />
            <ShellNavLink to="/scans" icon={Radar} label="Scans" meta="Runs, events, dossiers" />
          </nav>

          <div className="space-y-2 border-t border-white/8 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Situation
            </div>
            <ContextStat label="New families" value={String(newFamilies)} />
            <ContextStat label="Active runs" value={String(activeRuns)} />
          </div>

          <div className="mt-auto space-y-2 border-t border-white/8 pt-4 text-xs leading-5 text-[var(--muted)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Hotkeys
            </div>
            <div>`Cmd/Ctrl+K` launchpad</div>
            <div>`/` search</div>
            <div>`Esc` close overlays</div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/8 bg-[rgba(9,11,16,0.94)]">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-6">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  {routeLabel(location.pathname)}
                </div>
                <div className="text-base font-semibold text-white">{routeSummary(location.pathname)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--muted)] lg:flex">
                  <Activity className="size-4 text-[var(--danger)]" />
                  {dashboard?.groups.length ?? 0} families tracked
                </div>
                <Button variant="accent" onClick={onOpenPalette}>
                  <Command className="size-4" />
                  Launchpad
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-6 xl:px-6">
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

function BrandGlyph({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex size-10 items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--danger-soft)] text-base font-bold text-[var(--accent)]">
        ◆
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-base font-bold text-[var(--accent)]">◆</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        pwnkit
      </span>
    </div>
  );
}

function ShellNavLink({
  to,
  icon: Icon,
  label,
  meta,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta: string;
}) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={[
            "flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition",
            isActive
              ? "border-[var(--accent)]/35 bg-[var(--danger-soft)] text-white"
              : "border-white/0 bg-transparent text-[var(--muted)] hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
          ].join(" ")}
        >
          <Icon className="mt-0.5 size-4" />
          <div className="min-w-0">
            <div className="font-medium">{label}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{meta}</div>
          </div>
        </div>
      )}
    </NavLink>
  );
}

function RailNavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <NavLink to={to} aria-label={label} title={label}>
      {({ isActive }) => (
        <div
          className={[
            "flex size-10 items-center justify-center rounded-md border transition",
            isActive
              ? "border-[var(--accent)]/35 bg-[var(--danger-soft)] text-white"
              : "border-transparent text-[var(--muted)] hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
          ].join(" ")}
        >
          <Icon className="size-4" />
        </div>
      )}
    </NavLink>
  );
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/8 bg-black/18 px-3 py-2.5">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-lg font-semibold text-white">{value}</span>
    </div>
  );
}

function MobileShellNav({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={[
            "rounded-md border px-3 py-2 text-sm whitespace-nowrap",
            isActive
              ? "border-[var(--accent)]/35 bg-[var(--danger-soft)] text-white"
              : "border-white/10 bg-white/[0.04] text-[var(--muted)]",
          ].join(" ")}
        >
          {label}
        </div>
      )}
    </NavLink>
  );
}
