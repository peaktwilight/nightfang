import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  Radar,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { ScanEventsResponse } from "@/types";
import { formatTime, summarizePayload } from "@/lib/format";
import { StatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardEmpty, CardEyebrow, CardHeader, CardRow, CardTitle } from "@/components/ui/card";

export function EventTimeline({
  events,
}: {
  events: ScanEventsResponse["events"];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardEyebrow>Activity</CardEyebrow>
          <CardTitle className="mt-2">Timeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <CardEmpty>No pipeline events recorded.</CardEmpty>
        ) : (
          events.map((event) => {
            const Icon = iconForEvent(event.stage, event.eventType);

            return (
              <CardRow key={event.id} className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <div className="mt-0.5 inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--accent)]">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">
                          {event.stage} · {event.eventType}
                        </div>
                        {event.agentRole ? <StatusBadge value={event.agentRole} /> : null}
                      </div>
                      <div className="text-sm text-[var(--muted)]">{summarizePayload(event.payload)}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {event.findingId ? `Finding ${event.findingId.slice(0, 8)} · ` : ""}
                        {formatTime(event.timestamp)}
                      </div>
                    </div>
                  </div>
                  {event.payload ? (
                    <details className="min-w-[16rem] rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted)]">
                      <summary className="cursor-pointer list-none font-medium text-white">Raw payload</summary>
                      <pre className="mt-3 text-xs text-[var(--muted)]">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </CardRow>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function iconForEvent(stage: string, eventType: string) {
  const value = `${stage}:${eventType}`.toLowerCase();
  if (value.includes("attack")) return ShieldAlert;
  if (value.includes("agent")) return Bot;
  if (value.includes("verify")) return CheckCircle2;
  if (value.includes("finding")) return CircleAlert;
  if (value.includes("scan")) return Radar;
  if (value.includes("analysis")) return Sparkles;
  return Activity;
}
