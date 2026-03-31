import { Badge } from "@/components/ui/badge";

export function SeverityBadge({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();
  const variant =
    normalized === "critical" || normalized === "high"
      ? "danger"
      : normalized === "medium"
        ? "warning"
        : normalized === "low"
          ? "info"
          : "neutral";

  return <Badge variant={variant}>{severity}</Badge>;
}

export function StatusBadge({
  value,
}: {
  value: string;
}) {
  const normalized = value.toLowerCase();
  const variant =
    normalized === "accepted" || normalized === "complete" || normalized === "completed"
      ? "success"
      : normalized === "suppressed"
        ? "warning"
        : normalized === "running"
          ? "accent"
          : normalized === "failed" || normalized === "critical"
            ? "danger"
            : "neutral";

  return <Badge variant={variant}>{value}</Badge>;
}
