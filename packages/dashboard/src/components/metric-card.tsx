import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  tone?: "neutral" | "danger" | "warning" | "success" | "accent";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            {label}
          </div>
          <div
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)]",
              tone === "danger" && "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]",
              tone === "warning" && "border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]",
              tone === "success" && "border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]",
              tone === "accent" && "border-[var(--accent)]/20 bg-[var(--accent)]/14 text-[var(--accent)]",
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
          <div className="text-xs leading-5 text-[var(--muted)]">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}
