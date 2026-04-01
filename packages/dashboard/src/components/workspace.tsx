import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Workspace({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid min-h-[42rem] gap-4 xl:grid-cols-[22rem_minmax(0,1fr)_20rem]", className)}>
      {children}
    </section>
  );
}

export function WorkspaceSidebar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

export function WorkspaceMain({
  children,
  className,
  span = false,
}: {
  children: ReactNode;
  className?: string;
  span?: boolean;
}) {
  return <div className={cn("min-w-0", span && "xl:col-span-2", className)}>{children}</div>;
}

export function WorkspaceAside({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 xl:sticky xl:top-[5.25rem] xl:self-start", className)}>{children}</div>;
}

// Backwards-compatible aliases while pages are being normalized.
export const WorkspacePane = WorkspaceMain;
export const WorkspaceSecondaryPane = WorkspaceAside;
