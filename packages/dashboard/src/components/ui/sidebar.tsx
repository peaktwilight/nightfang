import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Sidebar({ className, ...props }: ComponentPropsWithoutRef<"aside">) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-[var(--border)] p-4", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-6 p-4", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-[var(--border)] p-4", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("space-y-2", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: ComponentPropsWithoutRef<"ul">) {
  return <ul className={cn("space-y-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: ComponentPropsWithoutRef<"li">) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
}) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors",
        isActive
          ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
          : "text-[color:rgba(235,242,247,0.8)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}
