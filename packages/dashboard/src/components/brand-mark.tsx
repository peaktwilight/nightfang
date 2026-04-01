import logoUrl from "../../../../assets/nightfang-logo.svg";
import iconGifUrl from "../../../../assets/pwnkit-icon.gif";
import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  animated = false,
  className,
}: {
  compact?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const imageUrl = animated ? iconGifUrl : logoUrl;

  if (compact) {
    return (
      <img
        alt="pwnkit"
        src={imageUrl}
        className={cn("size-9 rounded-md object-cover shadow-[0_6px_18px_rgba(0,0,0,0.22)]", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        alt="pwnkit"
        src={imageUrl}
        className="size-10 rounded-md object-cover shadow-[0_8px_20px_rgba(0,0,0,0.26)]"
      />
      <div className="space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          pwnkit
        </div>
        <div className="text-sm font-medium text-white">Nightfang operator shell</div>
      </div>
    </div>
  );
}
