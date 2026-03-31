import { CardRow } from "@/components/ui/card";

export function MetaTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <CardRow className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className={`mt-2 text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</div>
    </CardRow>
  );
}
