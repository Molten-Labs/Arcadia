import { cn } from "@/lib/utils";

export const ArcadiaLogo = ({ className }: { className?: string }) => (
  <img
    src="/arcadia-logo-new.svg"
    alt="Arcadia Protocol logo"
    draggable={false}
    className={cn("h-8 w-8 object-contain select-none", className)}
    style={{ filter: "brightness(0) invert(1)" }}
  />
);

export const ArcadiaWordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "apex-wordmark hidden text-left text-foreground sm:inline-block md:text-[22px] xl:text-[24px] max-w-[14.5rem] truncate text-[20px]",
      className
    )}
  >
    Arcadia Protocol
  </span>
);
