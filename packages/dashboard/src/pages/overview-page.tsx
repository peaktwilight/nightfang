import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Compass,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { SeverityBadge, StatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatTime } from "@/lib/format";
import type { DashboardResponse, ScanRecord } from "@/types";

export function OverviewPage({
  dashboard,
  scans,
}: {
  dashboard: DashboardResponse;
  scans: ScanRecord[];
}) {
  const activeScans = dashboard.scans.filter((scan) => scan.status === "running");
  const newFamilies = dashboard.groups.filter((group) => group.latest.triageStatus === "new");
  const highRiskFamilies = dashboard.groups.filter((group) =>
    ["critical", "high"].includes(group.latest.severity.toLowerCase()),
  );
  const acceptedFamilies = dashboard.groups.filter((group) => group.latest.triageStatus === "accepted");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Operator snapshot"
        summary="Watch active runs, review the hottest recurring families, and jump directly into evidence or timeline detail."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/findings">Open finding workbench</Link>
            </Button>
            <Button asChild variant="accent">
              <Link to="/scans">Open run control</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Radar}
          label="Tracked scans"
          value={scans.length}
          hint="Historical runs recorded in local state"
          tone="accent"
        />
        <MetricCard
          icon={Compass}
          label="Active scans"
          value={activeScans.length}
          hint="Runs currently executing or awaiting completion"
          tone="danger"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Critical / high"
          value={highRiskFamilies.length}
          hint="Families requiring immediate operator review"
          tone="warning"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Accepted"
          value={acceptedFamilies.length}
          hint="Families already dispositioned as valid"
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Inbox
              </div>
              <CardTitle className="mt-2">Hot finding families</CardTitle>
              <CardDescription>The newest recurring evidence waiting for triage.</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/findings">See all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(newFamilies.length === 0 ? dashboard.groups : newFamilies).slice(0, 8).map((group) => (
              <Link
                key={group.fingerprint}
                to={`/findings/${group.fingerprint}`}
                className="block rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/22 hover:bg-white/[0.05]"
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
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Runs
              </div>
              <CardTitle className="mt-2">Latest execution lanes</CardTitle>
              <CardDescription>Recent runs with runtime, status, and finding density.</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/scans">See all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.scans.slice(0, 8).map((scan) => (
              <Link
                key={scan.id}
                to={`/scans/${scan.id}`}
                className="block rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">{scan.target}</div>
                    <div className="text-sm text-[var(--muted)]">
                      {scan.depth} · {scan.runtime} · {scan.mode}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Started {formatTime(scan.startedAt)} · {formatDuration(scan.durationMs)}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge value={scan.status} />
                    <StatusBadge value={`${scan.summary.totalFindings} findings`} />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
