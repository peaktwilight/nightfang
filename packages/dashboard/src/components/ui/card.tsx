import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-panel)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4 p-4 pb-0", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-[var(--muted)]", className)} {...props} />;
}

export function CardEyebrow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

const cardRowVariants = cva(
  "rounded-md bg-[var(--secondary)] px-4 py-3 text-sm transition-colors",
  {
    variants: {
      interactive: {
        true: "hover:bg-[var(--accent-soft)]",
        false: "",
      },
      selected: {
        true: "bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]",
        false: "",
      },
    },
    defaultVariants: {
      interactive: false,
      selected: false,
    },
  },
);

type CardRowProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardRowVariants>;

export function CardRow({
  className,
  interactive,
  selected,
  ...props
}: CardRowProps) {
  return <div className={cn(cardRowVariants({ className, interactive, selected }))} {...props} />;
}

export function CardList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("divide-y divide-[var(--border)]", className)} {...props} />;
}

const cardListItemVariants = cva("px-4 py-3 text-sm transition-colors", {
  variants: {
    interactive: {
      true: "hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
      false: "",
    },
    selected: {
      true: "bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]",
      false: "",
    },
  },
  defaultVariants: {
    interactive: false,
    selected: false,
  },
});

type CardListItemProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardListItemVariants>;

export function CardListItem({
  className,
  interactive,
  selected,
  ...props
}: CardListItemProps) {
  return <div className={cn(cardListItemVariants({ className, interactive, selected }))} {...props} />;
}

export function CardEmpty({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-[var(--border)] bg-[var(--secondary)]/40 px-4 py-10 text-center text-sm text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
