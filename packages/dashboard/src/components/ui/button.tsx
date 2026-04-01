import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-white/[0.06]",
        outline: "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
        secondary: "bg-white/[0.06] text-[var(--secondary-foreground)] hover:bg-white/[0.1]",
        ghost: "text-[var(--foreground)]/80 hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
        accent: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#ef4444]",
        success: "bg-[var(--success-soft)] text-[var(--foreground)] hover:bg-[var(--success)]/20",
        warning: "bg-[var(--warning-soft)] text-[var(--foreground)] hover:bg-[var(--warning)]/18",
        danger: "bg-[var(--danger-soft)] text-[var(--foreground)] hover:bg-[var(--danger)]/20",
        destructive: "bg-[var(--danger-soft)] text-[var(--foreground)] hover:bg-[var(--danger)]/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5",
        icon: "size-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
