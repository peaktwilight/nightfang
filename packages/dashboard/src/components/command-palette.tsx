import { useEffect, useMemo } from "react";
import { FileSearch, LayoutDashboard, PlayCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFindingFamily, updateFindingFamilyTriage } from "@/api";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { DashboardResponse, ScanRecord } from "@/types";

type PaletteAction = {
  id: string;
  group: string;
  label: string;
  meta: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords: string[];
  shortcut?: string;
};

export function CommandPalette({
  open,
  onOpenChange,
  dashboard,
  scans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard?: DashboardResponse;
  scans?: ScanRecord[];
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const selectedFingerprint = location.pathname.match(/^\/findings\/([^/]+)/)?.[1] ?? null;
  const selectedScanId = location.pathname.match(/^\/scans\/([^/]+)/)?.[1] ?? null;

  const selectedFamilyQuery = useQuery({
    queryKey: ["finding-family", selectedFingerprint],
    queryFn: () => getFindingFamily(selectedFingerprint!),
    enabled: open && Boolean(selectedFingerprint),
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

  const items = useMemo<PaletteAction[]>(() => {
    const base: PaletteAction[] = [
      {
        id: "page-overview",
        group: "Pages",
        label: "Open operator overview",
        meta: "Dashboard",
        icon: LayoutDashboard,
        keywords: ["overview dashboard home operator"],
        run: () => navigate("/dashboard"),
      },
      {
        id: "page-findings",
        group: "Pages",
        label: "Open finding inbox",
        meta: "Families and triage",
        icon: FileSearch,
        keywords: ["findings inbox families evidence triage"],
        run: () => navigate("/findings"),
      },
      {
        id: "page-scans",
        group: "Pages",
        label: "Open run history",
        meta: "Scans and timelines",
        icon: PlayCircle,
        keywords: ["scans runs timeline history"],
        run: () => navigate("/scans"),
      },
    ];

    if (selectedFingerprint) {
      base.unshift(
        {
          id: "triage-accept",
          group: "Actions",
          label: "Accept selected finding family",
          meta: "Mark as accepted",
          icon: ShieldCheck,
          keywords: ["accept finding triage"],
          shortcut: "Enter",
          run: () => triageMutation.mutate({ triageStatus: "accepted", triageNote: selectedFamilyQuery.data?.latest.triageNote ?? "" }),
        },
        {
          id: "triage-suppress",
          group: "Actions",
          label: "Suppress selected finding family",
          meta: "Mark as suppressed",
          icon: ShieldOff,
          keywords: ["suppress finding triage"],
          shortcut: "Shift+S",
          run: () => triageMutation.mutate({ triageStatus: "suppressed", triageNote: selectedFamilyQuery.data?.latest.triageNote ?? "" }),
        },
      );
    }

    if (selectedScanId) {
      base.unshift({
        id: "scan-detail",
        group: "Actions",
        label: "Focus selected scan timeline",
        meta: "Open current run detail",
        icon: PlayCircle,
        keywords: ["scan timeline detail current"],
        run: () => navigate(`/scans/${selectedScanId}`),
      });
    }

    for (const group of dashboard?.groups.slice(0, 14) ?? []) {
      base.push({
        id: `finding-${group.fingerprint}`,
        group: "Finding Families",
        label: group.latest.title,
        meta: `${group.latest.severity} · ${group.latest.triageStatus}`,
        icon: FileSearch,
        keywords: [group.latest.title, group.latest.category, group.latest.severity, group.latest.triageStatus],
        run: () => navigate(`/findings/${group.fingerprint}`),
      });
    }

    for (const scan of scans?.slice(0, 14) ?? []) {
      base.push({
        id: `scan-${scan.id}`,
        group: "Scans",
        label: scan.target,
        meta: `${scan.status} · ${scan.depth} · ${scan.runtime}`,
        icon: PlayCircle,
        keywords: [scan.target, scan.status, scan.depth, scan.runtime, scan.mode],
        run: () => navigate(`/scans/${scan.id}`),
      });
    }

    return base;
  }, [dashboard?.groups, navigate, scans, selectedFingerprint, selectedFamilyQuery.data?.latest.triageNote, selectedScanId, triageMutation]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Mission command
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            Search pages, scan runs, finding families, and context-aware triage actions.
          </div>
        </div>
        <CommandInput placeholder="Jump to a page, run, finding family, or action" />
        <CommandList>
          <CommandEmpty>No matching commands.</CommandEmpty>
          {["Actions", "Pages", "Finding Families", "Scans"].map((group) => {
            const entries = items.filter((item) => item.group === group);
            if (entries.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {entries.map((item) => (
                  <CommandItem
                    key={item.id}
                    keywords={item.keywords}
                    value={`${item.label} ${item.meta}`}
                    onSelect={() => {
                      item.run();
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--accent)]">
                        <item.icon className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{item.label}</div>
                        <div className="text-xs text-[var(--muted)]">{item.meta}</div>
                      </div>
                    </div>
                    {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
                <CommandSeparator />
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
