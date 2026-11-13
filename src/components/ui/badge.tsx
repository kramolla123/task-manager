import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        neutral: "border-tone-neutral/25 bg-tone-neutral/10 text-tone-neutral",
        info: "border-tone-info/25 bg-tone-info/10 text-tone-info",
        progress: "border-tone-progress/25 bg-tone-progress/10 text-tone-progress",
        warn: "border-tone-warn/30 bg-tone-warn/12 text-tone-warn",
        success: "border-tone-success/25 bg-tone-success/10 text-tone-success",
        danger: "border-tone-danger/25 bg-tone-danger/10 text-tone-danger",
        design: "border-tone-design/25 bg-tone-design/10 text-tone-design",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };