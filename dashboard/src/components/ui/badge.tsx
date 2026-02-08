import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--verity-blue-primary)]/20 text-[var(--verity-blue-primary)] border border-[var(--verity-blue-primary)]/30",
        secondary:
          "bg-[var(--background-elevated)] text-[var(--foreground-muted)] border border-[var(--border)]",
        success:
          "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
        warning:
          "bg-yellow-500/15 text-yellow-500 border border-yellow-500/30",
        destructive:
          "bg-red-500/15 text-red-500 border border-red-500/30",
        info:
          "bg-blue-500/15 text-blue-500 border border-blue-500/30",
        allow:
          "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
        warn:
          "bg-yellow-500/15 text-yellow-500 border border-yellow-500/30",
        require:
          "bg-blue-500/15 text-blue-500 border border-blue-500/30",
        block:
          "bg-red-500/15 text-red-500 border border-red-500/30",
        outline:
          "border border-[var(--border)] text-[var(--foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
