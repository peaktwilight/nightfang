import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-white/12 bg-white/6 text-[var(--foreground)] hover:bg-white/10",
        outline: "border-white/14 bg-transparent text-[var(--foreground)] hover:bg-white/6",
        ghost: "border-transparent bg-transparent text-[var(--muted)] hover:bg-white/6 hover:text-[var(--foreground)]",
        accent: "border-[var(--accent)]/30 bg-[var(--accent)]/16 text-[var(--foreground)] hover:bg-[var(--accent)]/22",
        success: "border-[var(--success)]/30 bg-[var(--success)]/14 text-[var(--foreground)] hover:bg-[var(--success)]/20",
        warning: "border-[var(--warning)]/30 bg-[var(--warning)]/14 text-[var(--foreground)] hover:bg-[var(--warning)]/20",
        danger: "border-[var(--danger)]/30 bg-[var(--danger)]/14 text-[var(--foreground)] hover:bg-[var(--danger)]/20",
      },
      size: {
        default: "h-11",
        sm: "h-9 rounded-xl px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-11 rounded-2xl px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ className, size, variant }))} {...props} />;
}

export { buttonVariants };
