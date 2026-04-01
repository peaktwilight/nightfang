import { Activity, Command, LayoutDashboard, Menu, Radar, ShieldAlert } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import type { DashboardResponse, ScanRecord } from "@/types";
import { BrandMark } from "@/components/brand-mark";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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

function routePage(pathname: string): string {
  if (pathname.startsWith("/findings")) return "Findings";
  if (pathname.startsWith("/scans")) return "Scans";
  return "Overview";
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
        <Sidebar className="hidden xl:flex">
          <SidebarHeader className="space-y-2">
            <BrandMark animated />
            <div className="text-xl font-bold tracking-tight text-white">Operator shell</div>
            <div className="text-sm leading-6 text-[var(--muted)]">
              Local mission control for scans, evidence, and triage.
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <ShellNavLink to="/dashboard" icon={LayoutDashboard} label="Overview" meta="Snapshot and priorities" />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <ShellNavLink to="/findings" icon={ShieldAlert} label="Findings" meta="Families, evidence, triage" />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <ShellNavLink to="/scans" icon={Radar} label="Scans" meta="Runs, events, dossiers" />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Situation</SidebarGroupLabel>
              <SidebarGroupContent className="space-y-1">
                <ContextStat label="New families" value={String(newFamilies)} />
                <ContextStat label="Active runs" value={String(activeRuns)} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="space-y-2 text-xs leading-5 text-[var(--muted)]">
            <SidebarGroupLabel className="px-0">Hotkeys</SidebarGroupLabel>
            <div>`Cmd/Ctrl+K` launchpad</div>
            <div>`/` search</div>
            <div>`Esc` close overlays</div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(9,11,16,0.94)]">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 xl:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Open navigation">
                        <Menu className="size-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[18rem] p-0">
                      <SheetHeader className="border-b border-[var(--border)] p-4 pr-12">
                        <div className="mb-2">
                          <BrandMark />
                        </div>
                        <SheetTitle className="text-left text-base font-semibold text-white">Operator shell</SheetTitle>
                        <SheetDescription className="text-left text-sm text-[var(--muted)]">
                          Navigation, triage context, and scan state.
                        </SheetDescription>
                      </SheetHeader>
                      <Sidebar className="border-r-0 bg-transparent">
                        <SidebarContent>
                          <SidebarGroup>
                            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                            <SidebarGroupContent>
                              <SidebarMenu>
                                <SidebarMenuItem>
                                  <ShellNavLink to="/dashboard" icon={LayoutDashboard} label="Overview" meta="Snapshot and priorities" />
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                  <ShellNavLink to="/findings" icon={ShieldAlert} label="Findings" meta="Families, evidence, triage" />
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                  <ShellNavLink to="/scans" icon={Radar} label="Scans" meta="Runs, events, dossiers" />
                                </SidebarMenuItem>
                              </SidebarMenu>
                            </SidebarGroupContent>
                          </SidebarGroup>
                        </SidebarContent>
                      </Sidebar>
                    </SheetContent>
                  </Sheet>
                  <BrandMark compact />
                </div>

                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>{routeLabel(location.pathname)}</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{routePage(location.pathname)}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="text-base font-semibold text-white">{routeSummary(location.pathname)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--muted)] lg:flex">
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
            <nav className="inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-1 xl:hidden">
              <MobileShellNav to="/dashboard" label="Overview" />
              <MobileShellNav to="/findings" label="Findings" />
              <MobileShellNav to="/scans" label="Scans" />
            </nav>
            {children}
          </main>
        </SidebarInset>
      </div>
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
        <SidebarMenuButton asChild isActive={isActive}>
          <div>
            <Icon className="mt-0.5 size-4" />
            <div className="min-w-0">
              <div className="font-medium">{label}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{meta}</div>
            </div>
          </div>
        </SidebarMenuButton>
      )}
    </NavLink>
  );
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-sm">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-base font-semibold text-white">{value}</span>
    </div>
  );
}

function MobileShellNav({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <Button
          variant={isActive ? "accent" : "ghost"}
          size="sm"
          className="h-8 whitespace-nowrap border-0"
        >
          {label}
        </Button>
      )}
    </NavLink>
  );
}
