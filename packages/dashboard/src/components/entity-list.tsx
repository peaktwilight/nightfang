import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function EntityList({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
}: {
  title: string;
  description: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Queue
          </div>
          <CardTitle className="mt-2">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <label className="flex items-center gap-3">
          <Search className="size-4 text-[var(--muted)]" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 border-white/10 bg-black/15"
          />
        </label>
      </CardHeader>
      <CardContent className="pt-3">
        <ScrollArea className="h-[calc(100vh-21rem)] pr-4">
          <div className="space-y-2">{children}</div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function EntityListItem({
  title,
  description,
  meta,
  badges,
  selected = false,
}: {
  title: string;
  description: string;
  meta?: string;
  badges?: ReactNode;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-white/8 bg-white/[0.03] p-3 transition duration-150 hover:border-white/14 hover:bg-white/[0.05]",
        selected && "border-[var(--accent)]/30 bg-[var(--danger-soft)] shadow-[0_0_0_1px_rgba(255,91,91,0.14)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold leading-5 text-white">{title}</div>
          <div className="text-xs leading-5 text-[var(--muted)]">{description}</div>
          {meta ? <div className="text-xs text-[var(--muted-foreground)]">{meta}</div> : null}
        </div>
        {badges ? <div className="flex max-w-[12rem] flex-wrap justify-end gap-2">{badges}</div> : null}
      </div>
    </div>
  );
}
