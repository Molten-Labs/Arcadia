import { cn } from "@/lib/utils";

export const ArcadiaLogo = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        role="img"
        aria-label="Arcadia logo"
        className={cn("h-8 w-8 apex-chevron-mark", className)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <polygon points="2,2 14,12 2,22 6,22 18,12 6,2" fill="currentColor" opacity="0.92" />
        <polygon points="8,6 16,12 8,18 10,18 18,12 10,6" fill="currentColor" opacity="0.45" />
    </svg>
);

export const ArcadiaWordmark = ({ className }: { className?: string }) => (
    <span className={cn("apex-wordmark text-foreground sm:text-[38px] hidden sm:inline-block md:text-[34px] text-[20px] text-left", className)}>
        Arcadia Protocol
    </span>
);
