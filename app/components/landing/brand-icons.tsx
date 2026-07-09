import { cn } from "@/lib/utils";

/**
 * Official protocol marks for the trust strip, inlined from each project's own
 * brand asset (Solana + Jupiter via web3icons, Drift via drift.trade's D-logo).
 * Gradient ids are namespaced so the marquee's duplicated copies do not clash.
 * currentColor is used only where the source mark is monochrome (Drift).
 */

export function SolanaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path fill="url(#arc-sol-solana-a)" d="M18.413 7.902a.62.62 0 0 1-.411.163H3.58c-.512 0-.77-.585-.416-.928l2.369-2.284a.6.6 0 0 1 .41-.169H20.42c.517 0 .77.59.41.935z"/>
      <path fill="url(#arc-sol-solana-b)" d="M18.413 19.158a.62.62 0 0 1-.411.158H3.58c-.512 0-.77-.58-.416-.923l2.369-2.29a.6.6 0 0 1 .41-.163H20.42c.517 0 .77.586.41.928z"/>
      <path fill="url(#arc-sol-solana-c)" d="M18.413 10.473a.62.62 0 0 0-.411-.158H3.58c-.512 0-.77.58-.416.923l2.369 2.29c.111.103.257.16.41.163H20.42c.517 0 .77-.586.41-.928z"/>
      <defs>
      <linearGradient id="arc-sol-solana-a" x1="3.001" x2="21.459" y1="55.041" y2="54.871" gradientUnits="userSpaceOnUse">
      <stop stopColor="#599DB0"/>
      <stop offset="1" stopColor="#47F8C3"/>
      </linearGradient>
      <linearGradient id="arc-sol-solana-b" x1="3.001" x2="21.341" y1="9.168" y2="9.027" gradientUnits="userSpaceOnUse">
      <stop stopColor="#C44FE2"/>
      <stop offset="1" stopColor="#73B0D0"/>
      </linearGradient>
      <linearGradient id="arc-sol-solana-c" x1="4.036" x2="20.303" y1="12.003" y2="12.003" gradientUnits="userSpaceOnUse">
      <stop stopColor="#778CBF"/>
      <stop offset="1" stopColor="#5DCDC9"/>
      </linearGradient>
      </defs>
    </svg>
  );
}

export function JupiterMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path fill="url(#arc-jup-JUP-a)" d="M4.723 16.919a9.05 9.05 0 0 0 2.837 2.478 9.4 9.4 0 0 0 3.64 1.143c-.66-.957-1.62-1.837-2.82-2.507-1.198-.67-2.468-1.037-3.658-1.115"/>
      <path fill="url(#arc-jup-JUP-b)" d="M9.993 15.365c-2.31-1.292-4.81-1.62-6.598-1.04q.259.827.68 1.589c1.554-.035 3.25.371 4.83 1.254 1.578.883 2.786 2.1 3.525 3.418a9.6 9.6 0 0 0 1.771-.218c-.361-1.784-1.899-3.711-4.208-5.003"/>
      <path fill="url(#arc-jup-JUP-c)" d="M21 10.122a8.7 8.7 0 0 0-1.562-3.178 9.05 9.05 0 0 0-2.73-2.337 9.4 9.4 0 0 0-3.46-1.125 9.5 9.5 0 0 0-3.643.268c1.976.233 4.17.947 6.322 2.15S19.811 8.584 21 10.122"/>
      <path fill="url(#arc-jup-JUP-d)" d="M18.124 14.337c-1.011-1.617-2.744-3.166-4.88-4.36-2.134-1.193-4.39-1.875-6.35-1.92-1.723-.04-3.016.443-3.547 1.323l-.01.015q-.072.247-.127.496c.741-.281 1.6-.438 2.556-.456 2.124-.038 4.5.616 6.695 1.842 2.193 1.227 3.962 2.892 4.98 4.686.455.808.74 1.604.853 2.365q.196-.17.385-.351l.008-.017c.531-.881.326-2.201-.563-3.623"/>
      <path fill="url(#arc-jup-JUP-e)" d="M11.62 12.67c-3.27-1.83-6.883-2.116-8.62-.84q.005.6.095 1.194a7.5 7.5 0 0 1 1.57-.28c1.942-.14 4.082.38 6.025 1.467 1.942 1.086 3.473 2.619 4.308 4.31.231.464.407.951.525 1.452a9 9 0 0 0 1.125-.511c.29-2.085-1.758-4.964-5.028-6.793"/>
      <path fill="url(#arc-jup-JUP-f)" d="M19.805 11.63c-1.023-1.615-2.771-3.168-4.922-4.37s-4.414-1.894-6.38-1.95c-1.498-.041-2.658.308-3.26.969 2.499-.408 5.794.277 8.988 2.063s5.446 4.203 6.315 6.493c.298-.83.038-1.973-.741-3.205"/>
      <defs>
      <linearGradient id="arc-jup-JUP-a" x1="31.514" x2="-11.852" y1="-44.073" y2="1.318" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#C7F284"/>
      <stop offset="1" stopColor="#00BEF0"/>
      </linearGradient>
      <linearGradient id="arc-jup-JUP-b" x1="22.308" x2="-1.561" y1="-15.359" y2="11.673" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#C7F284"/>
      <stop offset="1" stopColor="#00BEF0"/>
      </linearGradient>
      <linearGradient id="arc-jup-JUP-c" x1="11.502" x2="-11.828" y1="12.343" y2="38.055" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#C7F284"/>
      <stop offset="1" stopColor="#00BEF0"/>
      </linearGradient>
      <linearGradient id="arc-jup-JUP-d" x1="16.445" x2="1.436" y1="1.484" y2="19.792" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#C7F284"/>
      <stop offset="1" stopColor="#00BEF0"/>
      </linearGradient>
      <linearGradient id="arc-jup-JUP-e" x1="18.777" x2="1.508" y1="-4.563" y2="16.538" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#C7F284"/>
      <stop offset="1" stopColor="#00BEF0"/>
      </linearGradient>
      <linearGradient id="arc-jup-JUP-f" x1="14.986" x2="7.18" y1="6.9" y2="20.843" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#C7F284"/>
      <stop offset="1" stopColor="#00BEF0"/>
      </linearGradient>
      </defs>
    </svg>
  );
}

export function DriftMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path fill="currentColor" d="M17.8731 17.5047C17.8731 18.2225 17.6057 18.8518 17.1763 19.3344C17.1712 19.3401 17.1677 19.347 17.1662 19.3545C17.1597 19.3853 17.1873 19.4125 17.218 19.405C18.4559 19.0999 19.4569 18.0424 19.4569 16.6538V9.45485C19.4569 7.32679 18.2683 5.36037 16.3387 4.29634L8.54768 0L7.00433 0.873256L14.7549 5.14727C16.6844 6.21131 17.8731 8.17772 17.8731 10.3058V17.5047Z"/>
      <path fill="currentColor" d="M15.6953 18.7339V11.5349C15.6953 9.40685 14.5067 7.44043 12.5771 6.3764L4.82656 2.10238L6.36991 1.22913L14.161 5.52547C16.0905 6.5895 17.2791 8.55591 17.2791 10.684V17.8829C17.2791 19.2716 16.2782 20.329 15.0402 20.6341C15.0096 20.6416 14.9819 20.6145 14.9884 20.5836C14.99 20.5761 14.9935 20.5692 14.9986 20.5635C15.4279 20.0809 15.6953 19.4516 15.6953 18.7339Z"/>
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M2.5498 3.39016L4.11326 2.50552L11.9043 6.80187C13.8338 7.8659 15.0225 9.83231 15.0225 11.9604V19.1948L15.0223 19.1947C14.9957 21.3575 12.537 22.7016 10.568 21.6158L3.50671 17.7219L2.5498 17.2078V3.39016ZM13.4386 12.8338V17.013L8.1922 14.1199V6.50164L10.3205 7.67527C12.25 8.7393 13.4386 10.7057 13.4386 12.8338ZM6.21241 5.40989L7.00433 5.84659V14.7745L7.08747 14.8191L13.4386 18.3214V19.1299L6.22263 15.1507L6.21241 15.1565V5.40989ZM4.92555 4.70025V15.8432L4.96277 15.8635L4.92555 15.8846L13.4289 20.5737C13.3578 20.9477 12.9111 21.1611 12.5477 20.9607L4.13364 16.3208V4.26355L4.92555 4.70025Z"/>
    </svg>
  );
}
