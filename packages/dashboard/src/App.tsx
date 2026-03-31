import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  Siren,
  Sparkles,
} from "lucide-react";
import {
  getDashboard,
  getFindingFamily,
  getScanEvents,
  getScanFindings,
  getScans,
  updateFindingFamilyTriage,
} from "@/api";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { EntityList, EntityListItem } from "@/components/entity-list";
import { EvidenceTabs } from "@/components/evidence-tabs";
import { EventTimeline } from "@/components/event-timeline";
import { InspectorPane } from "@/components/inspector-pane";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-panel";
import { SeverityBadge, StatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Workspace, WorkspacePane, WorkspaceSecondaryPane } from "@/components/workspace";
import { formatDuration, formatTime } from "@/lib/format";
import type {
  DashboardResponse,
  FindingFamilyResponse,
  ScanEventsResponse,
  ScanFindingsResponse,
  ScanRecord,
} from "@/types";

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
}

function AppRoutes({
  dashboard,
  scans,
}: {
  dashboard: DashboardResponse;
  scans: ScanRecord[];
}) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage data={dashboard} />} />
      <Route path="/findings" element={<FindingsPage dashboard={dashboard} />} />
      <Route path="/findings/:fingerprint" element={<FindingsPage dashboard={dashboard} />} />
      <Route path="/scans" element={<ScansPage scans={scans} />} />
      <Route path="/scans/:scanId" element={<ScansPage scans={scans} />} />
      <Route
        path="*"
        element={
          <EmptyState
            title="Unknown route"
            body="This dashboard view does not exist yet."
          />
        }
      />
    </Routes>
  );
}

export function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  const scansQuery = useQuery({
    queryKey: ["scans"],
    queryFn: getScans,
  });

  const handleHotkey = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setPaletteOpen((value) => !value);
      return;
    }

    if (!paletteOpen && event.key === "/" && !isTypingTarget(event.target)) {
      event.preventDefault();
      setPaletteOpen(true);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleHotkey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleHotkey]);

  return (
    <AppShell
      dashboard={dashboardQuery.data}
      scans={scansQuery.data}
      onOpenPalette={() => setPaletteOpen(true)}
    >
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        dashboard={dashboardQuery.data}
        scans={scansQuery.data}
      />
      {dashboardQuery.isLoading || scansQuery.isLoading ? (
        <LoadingState label="Mission control" />
      ) : dashboardQuery.error ? (
        <ErrorState error={dashboardQuery.error} />
      ) : scansQuery.error ? (
        <ErrorState error={scansQuery.error} />
      ) : dashboardQuery.data && scansQuery.data ? (
        <AppRoutes dashboard={dashboardQuery.data} scans={scansQuery.data} />
      ) : (
        <EmptyState
          title="No scan data available"
          body="Run a scan first, then reopen the dashboard."
        />
      )}
    </AppShell>
  );
}

function DashboardPage({ data }: { data: DashboardResponse }) {
  const activeScans = data.scans.filter((scan) => scan.status === "running");
  const newFamilies = data.groups.filter((group) => group.latest.triageStatus === "new");
  const highRisk = data.groups.filter((group) =>
    ["critical", "high"].includes(group.latest.severity.toLowerCase()),
  );
  const recentScans = data.scans.slice(0, 6);
  const recentGroups = data.groups.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Operator snapshot"
        summary="Track active scans, triage the newest families, and jump into run detail from one shell."
        actions={
          <Button asChild variant="accent">
            <NavLink to="/findings">Open finding inbox</NavLink>
          </Button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Tracked scans"
          value={data.scans.length}
          hint="Runs recorded in the local database"
          tone="accent"
        />
        <MetricCard
          icon={Siren}
          label="Active scans"
          value={activeScans.length}
          hint="Runs still producing events"
          tone="danger"
        />
        <MetricCard
          icon={AlertCircle}
          label="New families"
          value={newFamilies.length}
          hint="Finding families waiting for triage"
          tone="warning"
        />
        <MetricCard
          icon={Sparkles}
          label="Critical / high"
          value={highRisk.length}
          hint="Families that likely need immediate review"
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Finding families
              </div>
              <CardTitle className="mt-2">Fresh inbox</CardTitle>
              <CardDescription>Latest deduplicated findings waiting for review.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/findings">View all</NavLink>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentGroups.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-white/10 px-4 py-10 text-sm text-[var(--muted)]">
                No findings recorded yet.
              </div>
            ) : (
              recentGroups.map((group) => (
                <NavLink
                  key={group.fingerprint}
                  to={`/findings/${group.fingerprint}`}
                  className="block rounded-[var(--radius)] border border-white/8 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">{group.latest.title}</div>
                      <div className="text-sm text-[var(--muted)]">
                        {group.latest.category} · {group.count} hits across {group.scanCount} scans
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <SeverityBadge severity={group.latest.severity} />
                      <StatusBadge value={group.latest.triageStatus} />
                    </div>
                  </div>
                </NavLink>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Scan runs
              </div>
              <CardTitle className="mt-2">Recent runs</CardTitle>
              <CardDescription>Jump directly into the latest scan dossiers.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/scans">View all</NavLink>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentScans.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-white/10 px-4 py-10 text-sm text-[var(--muted)]">
                No scans recorded yet.
              </div>
            ) : (
              recentScans.map((scan) => (
                <NavLink
                  key={scan.id}
                  to={`/scans/${scan.id}`}
                  className="block rounded-[var(--radius)] border border-white/8 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">{scan.target}</div>
                      <div className="text-sm text-[var(--muted)]">
                        {scan.depth} · {scan.runtime} · {scan.mode} · {formatDuration(scan.durationMs)}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <StatusBadge value={scan.status} />
                      <Badge>{scan.summary.totalFindings} findings</Badge>
                    </div>
                  </div>
                </NavLink>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FindingsPage({ dashboard }: { dashboard: DashboardResponse }) {
  const { fingerprint } = useParams<{ fingerprint?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredGroups = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return dashboard.groups;
    return dashboard.groups.filter((group) =>
      [
        group.latest.title,
        group.latest.category,
        group.latest.severity,
        group.latest.triageStatus,
        group.fingerprint,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [dashboard.groups, deferredSearch]);

  const selectedFingerprint = fingerprint ?? filteredGroups[0]?.fingerprint ?? null;

  useEffect(() => {
    if (!fingerprint && selectedFingerprint) {
      navigate(`/findings/${selectedFingerprint}`, { replace: true });
    }
  }, [fingerprint, navigate, selectedFingerprint]);

  const familyQuery = useQuery({
    queryKey: ["finding-family", selectedFingerprint],
    queryFn: () => getFindingFamily(selectedFingerprint!),
    enabled: Boolean(selectedFingerprint),
  });

  const triageMutation = useMutation({
    mutationFn: ({
      triageStatus,
      triageNote,
    }: {
      triageStatus: "new" | "accepted" | "suppressed";
      triageNote: string;
    }) => updateFindingFamilyTriage(selectedFingerprint!, triageStatus, triageNote),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["finding-family", selectedFingerprint] }),
      ]);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Findings"
        title="Family inbox"
        summary="Deduplicate recurring findings, inspect evidence, and triage families without losing context."
      />

      <Workspace>
        <WorkspacePane>
        <EntityList
          title={`${dashboard.groups.length} grouped findings`}
          description="Search by title, severity, category, or fingerprint."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter finding families"
        >
          {filteredGroups.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[var(--muted)]">
              No findings match the current filter.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <NavLink key={group.fingerprint} to={`/findings/${group.fingerprint}`}>
                {({ isActive }) => (
                  <EntityListItem
                    selected={isActive}
                    title={group.latest.title}
                    description={`${group.latest.category} · ${group.count} hits`}
                    meta={`${group.scanCount} scans`}
                    badges={
                      <>
                        <SeverityBadge severity={group.latest.severity} />
                        <StatusBadge value={group.latest.triageStatus} />
                      </>
                    }
                  />
                )}
              </NavLink>
            ))
          )}
        </EntityList>
        </WorkspacePane>

        {!selectedFingerprint ? (
          <>
            <WorkspacePane className="xl:col-span-2">
              <EmptyState
                title="No finding family selected"
                body="Choose a family from the inbox to inspect evidence."
              />
            </WorkspacePane>
          </>
        ) : familyQuery.isLoading ? (
          <WorkspacePane className="xl:col-span-2">
            <LoadingState label="Finding family" />
          </WorkspacePane>
        ) : familyQuery.error ? (
          <WorkspacePane className="xl:col-span-2">
            <ErrorState error={familyQuery.error} />
          </WorkspacePane>
        ) : familyQuery.data ? (
          <FindingFamilyDetail
            data={familyQuery.data}
            isSaving={triageMutation.isPending}
            onTriage={(triageStatus, triageNote) =>
              triageMutation.mutate({ triageStatus, triageNote })
            }
          />
        ) : (
          <WorkspacePane className="xl:col-span-2">
            <EmptyState
              title="Finding family unavailable"
              body="The selected family could not be loaded from the local database."
            />
          </WorkspacePane>
        )}
      </Workspace>
    </div>
  );
}

function FindingFamilyDetail({
  data,
  onTriage,
  isSaving,
}: {
  data: FindingFamilyResponse;
  onTriage: (triageStatus: "new" | "accepted" | "suppressed", triageNote: string) => void;
  isSaving: boolean;
}) {
  const [note, setNote] = useState(data.latest.triageNote ?? "");

  useEffect(() => {
    setNote(data.latest.triageNote ?? "");
  }, [data.fingerprint, data.latest.triageNote]);

  return (
    <>
      <WorkspacePane>
        <InspectorPane
          eyebrow="Evidence"
          title={data.latest.title}
          description={data.latest.description}
        >
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={data.latest.severity} />
            <StatusBadge value={data.latest.status} />
            <StatusBadge value={data.latest.triageStatus} />
          </div>

          <EvidenceTabs
            request={data.latest.evidenceRequest}
            response={data.latest.evidenceResponse}
            analysis={data.latest.evidenceAnalysis}
          />
        </InspectorPane>
      </WorkspacePane>

      <WorkspaceSecondaryPane className="space-y-4">
        <InspectorPane
          eyebrow="Inspector"
          title="Family posture"
          description="Keep triage controls and family metadata in a dedicated secondary pane."
        >
          <label className="block space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Triage note
            </div>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Capture why this family is actionable, benign, or still needs work."
            />
          </label>

          <div className="space-y-2">
            <MetaTile label="Fingerprint" value={data.fingerprint} mono />
            <MetaTile label="Occurrences" value={String(data.rows.length)} />
            <MetaTile label="Category" value={data.latest.category} />
          </div>

          <div className="grid gap-2">
            <Button
              variant="success"
              onClick={() => onTriage("accepted", note)}
              disabled={isSaving}
            >
              <ShieldCheck className="size-4" />
              Accept
            </Button>
            <Button
              variant="warning"
              onClick={() => onTriage("suppressed", note)}
              disabled={isSaving}
            >
              <ShieldOff className="size-4" />
              Suppress
            </Button>
            <Button
              variant="outline"
              onClick={() => onTriage("new", note)}
              disabled={isSaving}
            >
              <ShieldQuestion className="size-4" />
              Reopen
            </Button>
          </div>
        </InspectorPane>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Occurrences
              </div>
              <CardTitle className="mt-2">Matching findings</CardTitle>
              <CardDescription>Each row is an occurrence grouped into this family.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-white/8 bg-black/10 p-3"
              >
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-white">{row.id.slice(0, 8)}</div>
                  <div className="text-xs text-[var(--muted)]">
                    scan {row.scanId.slice(0, 8)} · {formatTime(row.timestamp)}
                  </div>
                </div>
                <StatusBadge value={row.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </WorkspaceSecondaryPane>
    </>
  );
}

function ScansPage({ scans }: { scans: ScanRecord[] }) {
  const { scanId } = useParams<{ scanId?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredScans = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return scans;
    return scans.filter((scan) =>
      [scan.target, scan.depth, scan.runtime, scan.mode, scan.status, scan.id]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [deferredSearch, scans]);

  const selectedScanId = scanId ?? filteredScans[0]?.id ?? null;

  useEffect(() => {
    if (!scanId && selectedScanId) {
      navigate(`/scans/${selectedScanId}`, { replace: true });
    }
  }, [navigate, scanId, selectedScanId]);

  const eventsQuery = useQuery({
    queryKey: ["scan-events", selectedScanId],
    queryFn: () => getScanEvents(selectedScanId!),
    enabled: Boolean(selectedScanId),
  });

  const findingsQuery = useQuery({
    queryKey: ["scan-findings", selectedScanId],
    queryFn: () => getScanFindings(selectedScanId!),
    enabled: Boolean(selectedScanId),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scans"
        title="Run history"
        summary="Inspect each run as a dossier with metadata, timeline, and grouped findings side by side."
      />

      <Workspace>
        <WorkspacePane>
        <EntityList
          title={`${scans.length} scans`}
          description="Search by target, runtime, mode, depth, or status."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter scan runs"
        >
          {filteredScans.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[var(--muted)]">
              No scans match the current filter.
            </div>
          ) : (
            filteredScans.map((scan) => (
              <NavLink key={scan.id} to={`/scans/${scan.id}`}>
                {({ isActive }) => (
                  <EntityListItem
                    selected={isActive}
                    title={scan.target}
                    description={`${scan.runtime} · ${scan.mode} · ${scan.depth}`}
                    meta={formatTime(scan.startedAt)}
                    badges={
                      <>
                        <StatusBadge value={scan.status} />
                        <Badge>{scan.summary.totalFindings} findings</Badge>
                      </>
                    }
                  />
                )}
              </NavLink>
            ))
          )}
        </EntityList>
        </WorkspacePane>

        {!selectedScanId ? (
          <WorkspacePane className="xl:col-span-2">
            <EmptyState
              title="No scan selected"
              body="Choose a scan from the run history to inspect details."
            />
          </WorkspacePane>
        ) : eventsQuery.isLoading || findingsQuery.isLoading ? (
          <WorkspacePane className="xl:col-span-2">
            <LoadingState label="Scan detail" />
          </WorkspacePane>
        ) : eventsQuery.error ? (
          <WorkspacePane className="xl:col-span-2">
            <ErrorState error={eventsQuery.error} />
          </WorkspacePane>
        ) : findingsQuery.error ? (
          <WorkspacePane className="xl:col-span-2">
            <ErrorState error={findingsQuery.error} />
          </WorkspacePane>
        ) : eventsQuery.data && findingsQuery.data ? (
          <ScanDetail events={eventsQuery.data} findings={findingsQuery.data} />
        ) : (
          <WorkspacePane className="xl:col-span-2">
            <EmptyState
              title="Scan unavailable"
              body="The selected scan could not be loaded from the local database."
            />
          </WorkspacePane>
        )}
      </Workspace>
    </div>
  );
}

function ScanDetail({
  events,
  findings,
}: {
  events: ScanEventsResponse;
  findings: ScanFindingsResponse;
}) {
  const scan = events.scan;

  return (
    <>
      <WorkspacePane className="space-y-4">
        <InspectorPane
          eyebrow="Run detail"
          title={scan.target}
          description={`Started ${formatTime(scan.startedAt)} · ${scan.runtime} runtime · ${scan.mode} mode`}
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={scan.status} />
            <Badge>{scan.depth}</Badge>
            <Badge>{scan.runtime}</Badge>
            <Badge>{scan.mode}</Badge>
          </div>

          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              icon={Activity}
              label="Findings"
              value={scan.summary.totalFindings}
              hint="Grouped and raw findings"
              tone="accent"
            />
            <MetricCard
              icon={Siren}
              label="Critical"
              value={scan.summary.critical}
              hint="Critical-severity findings"
              tone="danger"
            />
            <MetricCard
              icon={AlertCircle}
              label="High"
              value={scan.summary.high}
              hint="High-severity findings"
              tone="warning"
            />
            <MetricCard
              icon={Sparkles}
              label="Duration"
              value={formatDuration(scan.durationMs)}
              hint="Elapsed runtime"
              tone="success"
            />
          </section>

          <EventTimeline events={events.events} />
        </InspectorPane>
      </WorkspacePane>

      <WorkspaceSecondaryPane className="space-y-4">
        <InspectorPane
          eyebrow="Secondary"
          title="Run metadata"
          description="Grouped findings and runtime metadata for the selected scan."
        >
          <div className="space-y-2">
            <MetaTile label="Scan id" value={scan.id} mono />
            <MetaTile label="Started" value={formatTime(scan.startedAt)} />
            <MetaTile
              label="Completed"
              value={scan.completedAt ? formatTime(scan.completedAt) : "In progress"}
            />
            <MetaTile label="Mode" value={`${scan.mode} / ${scan.depth}`} />
          </div>
        </InspectorPane>

        <Card className="overflow-hidden border-white/8 bg-white/[0.025]">
          <CardHeader>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Grouped findings
              </div>
              <CardTitle className="mt-2">Families in this run</CardTitle>
              <CardDescription>Deduplicated findings produced by this scan.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {findings.groups.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[var(--muted)]">
                No finding families recorded for this run.
              </div>
            ) : (
              findings.groups.map((group) => (
                <div
                  key={group.fingerprint}
                  className="rounded-[var(--radius)] border border-white/8 bg-black/10 p-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-white">{group.latest.title}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {group.latest.category} · {group.count} occurrences
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <SeverityBadge severity={group.latest.severity} />
                      <StatusBadge value={group.latest.triageStatus} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </WorkspaceSecondaryPane>
    </>
  );
}

function MetaTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-white/8 bg-black/10 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className={`mt-2 text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
