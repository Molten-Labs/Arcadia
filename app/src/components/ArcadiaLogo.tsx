import { cn } from "@/lib/utils";

export const ArcadiaLogo = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center justify-center rounded-lg bg-white/10 p-1 shrink-0",
      className
    )}
  >
    <img
      src="/arcadia-logo-new.svg"
      alt="Arcadia Protocol logo"
      draggable={false}
      className="h-7 w-7 object-contain select-none"
      style={{ filter: "brightness(0) invert(1)" }}
    />
  </span>
);

export const ArcadiaWordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "apex-wordmark hidden text-left text-foreground sm:inline-block md:text-[22px] xl:text-[24px] max-w-[14.5rem] truncate text-[25px]",
      className
    )}
  >
    Arcadia Protocol
  </span>
);
