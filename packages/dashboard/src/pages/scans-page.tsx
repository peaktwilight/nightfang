import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Database, SearchCode, ShieldAlert } from "lucide-react";
import { getScanEvents, getScanFindings } from "@/api";
import { EntityList, EntityListItem } from "@/components/entity-list";
import { EventTimeline } from "@/components/event-timeline";
import { InspectorPane } from "@/components/inspector-pane";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-panel";
import { SeverityBadge, StatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration, formatTime } from "@/lib/format";
import type { ScanRecord } from "@/types";

export function ScansPage({
  scans,
}: {
  scans: ScanRecord[];
}) {
  const { scanId } = useParams<{ scanId?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const filteredScans = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return scans;
    return scans.filter((scan) =>
      [scan.target, scan.depth, scan.runtime, scan.mode, scan.status].join(" ").toLowerCase().includes(query),
    );
  }, [scans, search]);

  const selectedScanId = scanId ?? filteredScans[0]?.id ?? null;

  useEffect(() => {
    if (!scanId && filteredScans[0]) {
      navigate(`/scans/${filteredScans[0].id}`, { replace: true });
    }
  }, [filteredScans, navigate, scanId]);

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
        summary="Keep scan selection on the left, mission activity in the center, and metadata plus grouped families in a dedicated right inspector."
      />

      <section className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <EntityList
          title={`${filteredScans.length} runs`}
          description="Searchable execution history with sticky route selection."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search target, depth, runtime, mode"
        >
          {filteredScans.map((scan) => (
            <Link key={scan.id} to={`/scans/${scan.id}`} className="block">
              <EntityListItem
                title={scan.target}
                description={`${scan.depth} · ${scan.runtime} · ${scan.mode}`}
                meta={`Started ${formatTime(scan.startedAt)}`}
                selected={scan.id === selectedScanId}
                badges={
                  <>
                    <StatusBadge value={scan.status} />
                    <StatusBadge value={`${scan.summary.totalFindings} findings`} />
                  </>
                }
              />
            </Link>
          ))}
        </EntityList>

        {!selectedScanId ? (
          <EmptyState title="No scan selected" body="Choose a run from the execution history." />
        ) : eventsQuery.isLoading || findingsQuery.isLoading ? (
          <LoadingState label="Scan detail" />
        ) : eventsQuery.error ? (
          <ErrorState error={eventsQuery.error} />
        ) : findingsQuery.error ? (
          <ErrorState error={findingsQuery.error} />
        ) : eventsQuery.data && findingsQuery.data ? (
          <>
            <div className="space-y-4">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={SearchCode}
                  label="Findings"
                  value={eventsQuery.data.scan.summary.totalFindings}
                  hint="Total findings recorded in this run"
                  tone="accent"
                />
                <MetricCard
                  icon={ShieldAlert}
                  label="Critical"
                  value={eventsQuery.data.scan.summary.critical}
                  hint="Critical severity hits"
                  tone="danger"
                />
                <MetricCard
                  icon={Database}
                  label="Families"
                  value={findingsQuery.data.groups.length}
                  hint="Grouped recurring families in this run"
                  tone="warning"
                />
                <MetricCard
                  icon={CalendarClock}
                  label="Duration"
                  value={formatDuration(eventsQuery.data.scan.durationMs)}
                  hint="Observed runtime for the scan"
                  tone="success"
                />
              </section>

              <Card className="overflow-hidden">
                <CardHeader>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Timeline
                    </div>
                    <CardTitle className="mt-2">{eventsQuery.data.scan.target}</CardTitle>
                    <CardDescription>
                      {eventsQuery.data.scan.depth} · {eventsQuery.data.scan.runtime} · {eventsQuery.data.scan.mode}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={eventsQuery.data.scan.status} />
                    <StatusBadge value={formatDuration(eventsQuery.data.scan.durationMs)} />
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <ScrollArea className="h-[calc(100vh-23rem)] pr-4">
                    <EventTimeline events={eventsQuery.data.events} />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <ScanInspector
              scan={eventsQuery.data.scan}
              groups={findingsQuery.data.groups}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function ScanInspector({
  scan,
  groups,
}: {
  scan: ScanRecord;
  groups: Awaited<ReturnType<typeof getScanFindings>>["groups"];
}) {
  return (
    <InspectorPane
      eyebrow="Inspector"
      title="Run metadata"
      description="Secondary metadata and grouped family summaries stay here so the timeline remains readable."
    >
      <div className="grid gap-3 text-sm text-[var(--muted)]">
        <ScanMeta label="Target" value={scan.target} />
        <ScanMeta label="Started" value={formatTime(scan.startedAt)} />
        <ScanMeta label="Completed" value={scan.completedAt ? formatTime(scan.completedAt) : "In progress"} />
        <ScanMeta label="Mode" value={`${scan.mode} · ${scan.depth} · ${scan.runtime}`} />
      </div>

      <Card className="border-white/8 bg-black/12">
        <CardHeader>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Families
            </div>
            <CardTitle className="mt-2">{groups.length} grouped findings</CardTitle>
            <CardDescription>Recurring families surfaced inside this run.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.slice(0, 8).map((group) => (
            <div key={group.fingerprint} className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">{group.latest.title}</div>
                <div className="text-xs text-[var(--muted)]">
                  {group.latest.category} · {group.count} occurrences
                </div>
                <div className="flex flex-wrap gap-2">
                  <SeverityBadge severity={group.latest.severity} />
                  <StatusBadge value={group.latest.triageStatus} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </InspectorPane>
  );
}

function ScanMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/12 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-2 text-sm text-white">{value}</div>
    </div>
  );
}
