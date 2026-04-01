import { ChevronRight } from "lucide-react";
import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export function Breadcrumb({ className, ...props }: ComponentPropsWithoutRef<"nav">) {
  return <nav aria-label="breadcrumb" className={cn("flex", className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentPropsWithoutRef<"ol">) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]", className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: ComponentPropsWithoutRef<"li">) {
  return <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

export function BreadcrumbLink({
  asChild = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "a";
  return <Comp className={cn("transition-colors hover:text-white", className)} {...props} />;
}

export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("font-medium text-white", className)} aria-current="page" {...props} />;
}

export function BreadcrumbSeparator({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn("text-[var(--muted-foreground)]", className)} role="presentation" {...props}>
      <ChevronRight className="size-3.5" />
    </li>
  );
}
