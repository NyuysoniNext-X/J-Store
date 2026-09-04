import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared star-rating display component.
 * Replaces inline star loops duplicated across ProductCard and product.$id.
 */
export function StarRating({
  value,
  size = 16,
  showValue = false,
  count,
  className,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={
              i < Math.round(value) ? "fill-gold text-gold" : "fill-muted text-muted-foreground"
            }
          />
        ))}
      </div>
      {showValue && (
        <span className="text-xs font-medium">
          {value.toFixed(1)}
          {typeof count === "number" && <span className="text-muted-foreground"> ({count})</span>}
        </span>
      )}
    </div>
  );
}
