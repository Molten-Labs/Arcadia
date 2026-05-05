import { cn } from "@/lib/utils";

export const ArcadiaLogo = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="3 2 100 124"
    role="img"
    aria-label="Arcadia logo"
    className={cn("h-8 w-8", className)}
    fill="none"
  >
    {/* Shield outline */}
    <path
      d="m52.7 2.7-49.9 16.3c-0.2 0.2-0.3 0.3-0.3 1v43.8c0 28.7 23.5 52.3 49.9 62.2h0.5c13.5-4.3 38.1-17.6 45.9-38 3.2-7.8 4.2-16.2 4.2-24.2v-44.1c0-0.5-0.2-0.6-0.5-0.7l-49.8-16.3z"
      stroke="#42BD79"
      strokeWidth="1.8057"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit="10"
    />
    {/* Top chevron */}
    <path
      d="m52.6 8.5-44.8 14.6 0.1 0.1c-0.1 0.1-0.1 32-0.1 32 0 2.8-0.1 8.2 0.3 14.5l44.4-44.5 44.3 44.5c0.3-2.9 0.2-7.7 0.2-9.9v-36.8l-44.4-14.5z"
      stroke="#42BD79"
      strokeWidth="1.8057"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit="10"
    />
    {/* Middle chevron */}
    <path
      d="m52.5 33.3-43.5 43.4c0.6 3.3 2.2 7.4 3.6 10l39.9-39.8 39.4 39.8c1.8-3.1 3.1-7.2 3.6-10l-43-43.4z"
      stroke="#42BD79"
      strokeWidth="1.8057"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit="10"
    />
    {/* Bottom chevron */}
    <path
      d="m52.5 54-37 37.6c2.3 4.5 14.1 18.8 37 28 15.2-5 31.6-16.9 36.7-27.9l-36.7-37.7z"
      stroke="#42BD79"
      strokeWidth="1.8057"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit="10"
    />
  </svg>
);

export const ArcadiaWordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "apex-wordmark text-foreground sm:text-[38px] text-left hidden sm:inline-block md:text-[34px] text-[20px]",
      className
    )}
  >
    Arcadia Protocol
  </span>
);
