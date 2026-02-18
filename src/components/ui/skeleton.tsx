import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/useReducedMotion"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className={cn(
        "rounded-md bg-primary/10",
        // Only apply the pulse animation when the user hasn't opted out
        !reducedMotion && "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
