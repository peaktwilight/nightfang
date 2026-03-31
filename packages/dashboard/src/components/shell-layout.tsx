import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Command,
  FileSearch,
  LayoutDashboard,
  Menu,
  PlayCircle,
  Radar,
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { DashboardResponse, ScanRecord } from "@/types";
import { cn } from "@/lib/utils";

export function ShellLayout({
  dashboard,
  scans,
}: {
  dashboard?: DashboardResponse;
  scans?: ScanRecord[];
}) {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const routeMeta = useMemo(() => {
    if (location.pathname.startsWith("/findings")) {
      return {
        eyebrow: "Triage",
        title: "Finding Workbench",
        summary: "Group recurring evidence, inspect payloads, and resolve triage from a stable split-pane view.",
      };
    }
    if (location.pathname.startsWith("/scans")) {
      return {
        eyebrow: "Execution",
        title: "Run Control",
        summary: "Track scan history, event streams, and finding families without losing timeline context.",
      };
    }
    return {
      eyebrow: "Overview",
      title: "Mission Control",
      summary: "A local operator surface for scan activity, evidence, and decision-making.",
    };
  }, [location.pathname]);

  const activeScans = dashboard?.scans.filter((scan) => scan.status === "running").length ?? 0;
  const newFamilies = dashboard?.groups.filter((group) => group.latest.triageStatus === "new").length ?? 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target
        ? ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable
        : false;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }

      if (!typing && event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(102,217,255,0.08),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.22))]" />
      <div className="relative grid min-h-screen xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/8 bg-black/18 px-5 py-6 backdrop-blur-xl xl:flex xl:flex-col">
          <SidebarContent activeScans={activeScans} newFamilies={newFamilies} />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/8 bg-[rgba(7,16,24,0.72)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="xl:hidden"
                    onClick={() => setMobileNavOpen(true)}
                  >
                    <Menu className="size-5" />
                  </Button>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      {routeMeta.eyebrow}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-white">{routeMeta.title}</div>
                    <div className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{routeMeta.summary}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setPaletteOpen(true)}>
                    <Command className="size-4" />
                    Command palette
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      ⌘K
                    </span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{activeScans} active scans</Badge>
                <Badge variant="warning">{newFamilies} new families</Badge>
                <Badge variant="neutral">{scans?.length ?? 0} stored runs</Badge>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
            <Outlet />
          </main>
        </div>
      </div>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="left-auto right-4 top-4 h-[min(88vh,42rem)] w-[min(92vw,22rem)] translate-x-0 translate-y-0 p-0">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="h-full overflow-hidden rounded-[inherit]">
            <SidebarContent activeScans={activeScans} newFamilies={newFamilies} mobile />
          </div>
        </DialogContent>
      </Dialog>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        dashboard={dashboard}
        scans={scans}
      />
    </div>
  );
}

function SidebarContent({
  activeScans,
  newFamilies,
  mobile = false,
}: {
  activeScans: number;
  newFamilies: number;
  mobile?: boolean;
}) {
  return (
    <div className={cn("flex h-full flex-col gap-6", mobile && "p-5")}>
      <div className="space-y-3">
        <Link to="/dashboard" className="block">
          <div className="text-3xl font-bold lowercase tracking-[0.08em] text-[var(--danger)]">pwnkit</div>
          <div className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted)]">
            Mission-grade local control surface for scans, evidence, triage, and operator context.
          </div>
        </Link>
      </div>

      <nav className="space-y-2">
        <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Overview" />
        <SidebarLink to="/findings" icon={FileSearch} label="Finding workbench" />
        <SidebarLink to="/scans" icon={PlayCircle} label="Run control" />
      </nav>

      <div className="space-y-4 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Situation
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SidebarStat icon={Radar} label="Active" value={String(activeScans)} />
          <SidebarStat icon={Activity} label="New" value={String(newFamilies)} />
        </div>
        <Separator />
        <div className="space-y-2 text-sm text-[var(--muted)]">
          <div>`Cmd/Ctrl+K` opens the command palette</div>
          <div>`/` jumps into search</div>
          <div>`Esc` closes overlays and panes</div>
        </div>
      </div>

      <div className="mt-auto rounded-[1.4rem] border border-[var(--accent)]/12 bg-[var(--accent)]/8 p-4 text-sm text-[var(--muted)]">
        Paperclip-style flow comes from stable panel geography, not decorative cards. This shell keeps that structure fixed while pages rotate content.
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
          isActive
            ? "border-[var(--accent)]/24 bg-[var(--accent)]/12 text-white"
            : "border-transparent bg-transparent text-[var(--muted)] hover:border-white/8 hover:bg-white/[0.04] hover:text-white",
        )
      }
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/12 p-3">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <Icon className="size-4" />
        <span className="text-xs uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
