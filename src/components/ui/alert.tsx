import * as React from "react";
import { cn } from "@/lib/utils";

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-md border bg-muted px-4 py-3 text-sm", className)}
      role="alert"
      {...props}
    />
  ),
);
Alert.displayName = "Alert";

export { Alert };
