import * as Tabs from "@radix-ui/react-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EvidenceTabs({
  request,
  response,
  analysis,
}: {
  request: string;
  response: string;
  analysis?: string | null;
}) {
  return (
    <Tabs.Root defaultValue="request" className="space-y-4">
      <Tabs.List className="flex flex-wrap gap-2">
        {[
          ["request", "Evidence request"],
          ["response", "Evidence response"],
          ["analysis", "Analysis"],
        ].map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className={cn(
              "rounded-md border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] transition",
              "data-[state=active]:border-[var(--accent)]/25 data-[state=active]:bg-[var(--accent)]/12 data-[state=active]:text-white",
            )}
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="request">
        <Card className="border-white/8 bg-black/12">
          <CardContent className="p-4">
            <pre className="text-sm leading-6 text-[var(--muted)]">{request}</pre>
          </CardContent>
        </Card>
      </Tabs.Content>
      <Tabs.Content value="response">
        <Card className="border-white/8 bg-black/12">
          <CardContent className="p-4">
            <pre className="text-sm leading-6 text-[var(--muted)]">{response}</pre>
          </CardContent>
        </Card>
      </Tabs.Content>
      <Tabs.Content value="analysis">
        <Card className="border-white/8 bg-black/12">
          <CardContent className="p-4">
            <pre className="text-sm leading-6 text-[var(--muted)]">{analysis ?? "No evidence analysis recorded."}</pre>
          </CardContent>
        </Card>
      </Tabs.Content>
    </Tabs.Root>
  );
}
