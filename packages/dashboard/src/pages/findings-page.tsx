import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, History, Link2, NotebookPen } from "lucide-react";
import { getFindingFamily, updateFindingFamilyTriage } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-panel";
import { EntityList, EntityListItem } from "@/components/entity-list";
import { EvidenceTabs } from "@/components/evidence-tabs";
import { InspectorPane } from "@/components/inspector-pane";
import { PageHeader } from "@/components/page-header";
import { SeverityBadge, StatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatTime } from "@/lib/format";
import type { DashboardResponse } from "@/types";

export function FindingsPage({
  dashboard,
}: {
  dashboard: DashboardResponse;
}) {
  const { fingerprint } = useParams<{ fingerprint?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return dashboard.groups;
    return dashboard.groups.filter((group) =>
      [group.latest.title, group.latest.category, group.latest.severity, group.latest.triageStatus]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [dashboard.groups, search]);

  const selectedFingerprint = fingerprint ?? filteredGroups[0]?.fingerprint ?? null;

  useEffect(() => {
    if (!fingerprint && filteredGroups[0]) {
      navigate(`/findings/${filteredGroups[0].fingerprint}`, { replace: true });
    }
  }, [filteredGroups, fingerprint, navigate]);

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
        summary="Review recurring findings as families, keep evidence in the center, and hold triage controls in a dedicated inspector."
      />

      <section className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <EntityList
          title={`${filteredGroups.length} grouped findings`}
          description="Searchable family queue with stable selection."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search title, category, severity, triage"
        >
          {filteredGroups.map((group) => (
            <Link key={group.fingerprint} to={`/findings/${group.fingerprint}`} className="block">
              <EntityListItem
                title={group.latest.title}
                description={`${group.latest.category} · ${group.count} hits across ${group.scanCount} scans`}
                meta={`Fingerprint ${group.fingerprint.slice(0, 10)}…`}
                selected={group.fingerprint === selectedFingerprint}
                badges={
                  <>
                    <SeverityBadge severity={group.latest.severity} />
                    <StatusBadge value={group.latest.triageStatus} />
                  </>
                }
              />
            </Link>
          ))}
        </EntityList>

        {!selectedFingerprint ? (
          <EmptyState title="No finding family selected" body="Choose a finding family from the queue to open evidence." />
        ) : familyQuery.isLoading ? (
          <LoadingState label="Finding family" />
        ) : familyQuery.error ? (
          <ErrorState error={familyQuery.error} />
        ) : familyQuery.data ? (
          <>
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Evidence
                    </div>
                    <CardTitle className="mt-2 text-2xl">{familyQuery.data.latest.title}</CardTitle>
                    <CardDescription className="mt-3 max-w-3xl leading-6">
                      {familyQuery.data.latest.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SeverityBadge severity={familyQuery.data.latest.severity} />
                    <StatusBadge value={familyQuery.data.latest.status} />
                    <StatusBadge value={familyQuery.data.latest.triageStatus} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <ScrollArea className="h-[calc(100vh-18rem)] pr-4">
                  <div className="space-y-6">
                    <EvidenceTabs
                      request={familyQuery.data.latest.evidenceRequest}
                      response={familyQuery.data.latest.evidenceResponse}
                      analysis={familyQuery.data.latest.evidenceAnalysis}
                    />

                    <Card className="border-white/8 bg-black/12">
                      <CardHeader>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                            Occurrences
                          </div>
                          <CardTitle className="mt-2">{familyQuery.data.rows.length} matching findings</CardTitle>
                          <CardDescription>Every occurrence tracked under this family fingerprint.</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {familyQuery.data.rows.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-white">{row.id.slice(0, 8)}</div>
                                <div className="text-sm text-[var(--muted)]">
                                  Scan {row.scanId.slice(0, 8)} · {formatTime(row.timestamp)}
                                </div>
                              </div>
                              <StatusBadge value={row.status} />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <FindingInspector
              fingerprint={familyQuery.data.fingerprint}
              triageStatus={familyQuery.data.latest.triageStatus}
              triageNote={familyQuery.data.latest.triageNote ?? ""}
              category={familyQuery.data.latest.category}
              status={familyQuery.data.latest.status}
              rows={familyQuery.data.rows.length}
              scanCount={new Set(familyQuery.data.rows.map((row) => row.scanId)).size}
              onTriage={(triageStatus, triageNote) => triageMutation.mutate({ triageStatus, triageNote })}
              isSaving={triageMutation.isPending}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function FindingInspector({
  fingerprint,
  triageStatus,
  triageNote,
  category,
  status,
  rows,
  scanCount,
  onTriage,
  isSaving,
}: {
  fingerprint: string;
  triageStatus: "new" | "accepted" | "suppressed";
  triageNote: string;
  category: string;
  status: string;
  rows: number;
  scanCount: number;
  onTriage: (triageStatus: "new" | "accepted" | "suppressed", triageNote: string) => void;
  isSaving: boolean;
}) {
  const [note, setNote] = useState(triageNote);

  useEffect(() => {
    setNote(triageNote);
  }, [triageNote, fingerprint]);

  return (
    <InspectorPane
      eyebrow="Inspector"
      title="Triage and metadata"
      description="Keep decision controls and family context out of the evidence flow."
    >
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={triageStatus} />
        <StatusBadge value={status} />
      </div>

      <div className="space-y-3 text-sm text-[var(--muted)]">
        <InspectorStat icon={Link2} label="Fingerprint" value={fingerprint} />
        <InspectorStat icon={History} label="Occurrences" value={`${rows} findings across ${scanCount} scans`} />
        <InspectorStat icon={CheckCircle2} label="Category" value={category} />
      </div>

      <Separator />

      <label className="block space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <NotebookPen className="size-4 text-[var(--accent)]" />
          Triage note
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-32 w-full rounded-[1.2rem] border border-white/10 bg-black/12 px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          placeholder="Add why this is valid, suppressed, or needs more evidence"
        />
      </label>

      <div className="grid gap-2">
        <Button variant="success" disabled={isSaving} onClick={() => onTriage("accepted", note)}>
          Accept family
        </Button>
        <Button variant="warning" disabled={isSaving} onClick={() => onTriage("suppressed", note)}>
          Suppress family
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={() => onTriage("new", note)}>
          Reopen family
        </Button>
      </div>
    </InspectorPane>
  );
}

function InspectorStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/12 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        <Icon className="size-4 text-[var(--accent)]" />
        {label}
      </div>
      <div className="mt-2 break-all text-sm text-white">{value}</div>
    </div>
  );
}
