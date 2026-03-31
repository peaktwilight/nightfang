import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, ShieldQuestion } from "lucide-react";
import { getFindingFamily, updateFindingFamilyTriage } from "@/api";
import { EntityList, EntityListItem } from "@/components/entity-list";
import { EvidenceTabs } from "@/components/evidence-tabs";
import { InspectorPane } from "@/components/inspector-pane";
import { MetaTile } from "@/components/meta-tile";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-panel";
import { SeverityBadge, StatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardDescription, CardEmpty, CardEyebrow, CardHeader, CardRow, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Workspace, WorkspacePane, WorkspaceSecondaryPane } from "@/components/workspace";
import { formatTime } from "@/lib/format";
import type { DashboardResponse, FindingFamilyResponse } from "@/types";

export function FindingsPage({ dashboard }: { dashboard: DashboardResponse }) {
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
              <CardEmpty className="py-8">No findings match the current filter.</CardEmpty>
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
          <WorkspacePane className="xl:col-span-2">
            <EmptyState
              title="No finding family selected"
              body="Choose a family from the inbox to inspect evidence."
            />
          </WorkspacePane>
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
            <CardEyebrow>Triage note</CardEyebrow>
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
              <CardEyebrow>Occurrences</CardEyebrow>
              <CardTitle className="mt-2">Matching findings</CardTitle>
              <CardDescription>Each row is an occurrence grouped into this family.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rows.map((row) => (
              <CardRow key={row.id} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-white">{row.id.slice(0, 8)}</div>
                  <div className="text-xs text-[var(--muted)]">
                    scan {row.scanId.slice(0, 8)} · {formatTime(row.timestamp)}
                  </div>
                </div>
                <StatusBadge value={row.status} />
              </CardRow>
            ))}
          </CardContent>
        </Card>
      </WorkspaceSecondaryPane>
    </>
  );
}
