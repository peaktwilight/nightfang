import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, Siren, Sparkles } from "lucide-react";
import { getScanEvents, getScanFindings } from "@/api";
import { EntityList, EntityListItem } from "@/components/entity-list";
import { EventTimeline } from "@/components/event-timeline";
import { InspectorPane } from "@/components/inspector-pane";
import { MetaTile } from "@/components/meta-tile";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-panel";
import { SeverityBadge, StatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardEmpty, CardEyebrow, CardHeader, CardRow, CardTitle } from "@/components/ui/card";
import { Workspace, WorkspacePane, WorkspaceSecondaryPane } from "@/components/workspace";
import { formatDuration, formatTime } from "@/lib/format";
import type { ScanEventsResponse, ScanFindingsResponse, ScanRecord } from "@/types";

export function ScansPage({ scans }: { scans: ScanRecord[] }) {
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
              <CardEmpty className="py-8">No scans match the current filter.</CardEmpty>
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

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardEyebrow>Grouped findings</CardEyebrow>
              <CardTitle className="mt-2">Families in this run</CardTitle>
              <CardDescription>Deduplicated findings produced by this scan.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {findings.groups.length === 0 ? (
              <CardEmpty>No finding families recorded for this run.</CardEmpty>
            ) : (
              findings.groups.map((group) => (
                <CardRow key={group.fingerprint}>
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
                </CardRow>
              ))
            )}
          </CardContent>
        </Card>
      </WorkspaceSecondaryPane>
    </>
  );
}
