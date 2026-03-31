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

export function WorkspacePane({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

export function WorkspaceSecondaryPane({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 xl:sticky xl:top-[5.25rem] xl:self-start", className)}>{children}</div>;
}
