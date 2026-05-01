import { cn } from "@/lib/utils";

export const ArcadiaLogo = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 128 128"
        role="img"
        aria-label="Arcadia logo"
        className={cn("h-8 w-8 text-primary", className)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M64 9 113 27v40c0 27-18.5 44.5-49 54-30.5-9.5-49-27-49-54V27L64 9Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
        />
        <path
            d="M64 18 103 32v48L64 45 25 80V32l39-14Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
        />
        <path
            d="m25 91 39-35 39 35-8 16-31-28-31 28-8-16Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
        />
    </svg>
);
