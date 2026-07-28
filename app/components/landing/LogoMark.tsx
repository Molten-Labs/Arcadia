import Image from "next/image";
import { cn } from "@/lib/utils";

export const ORB_GRADIENT =
  "radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--color-acid) 35%, var(--color-chrome-1)), var(--color-acid) 58%, color-mix(in srgb, var(--color-acid) 40%, var(--color-void)))";

export type LogoMarkProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 26, className }: LogoMarkProps) {
  return (
    <Image
      src="/logo.svg"
      alt="Arcadia"
      width={size}
      height={size}
      className={cn("inline-block shrink-0 object-contain", className)}
    />
  );
}
