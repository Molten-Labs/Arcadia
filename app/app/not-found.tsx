import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>

      {/* Atmospheric glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, rgba(79,158,255,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="text-center relative z-10 px-6">
        {/* Big 404 number */}
        <p
          className="font-black leading-none mb-6 select-none"
          style={{
            fontSize: "clamp(5rem, 20vw, 12rem)",
            color: "var(--color-line)",
            letterSpacing: "-0.06em",
          }}
        >
          404
        </p>

        {/* Error badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6"
          style={{
            background: "var(--color-mint-dim)",
            border: "1px solid rgba(79,158,255,0.25)",
            color: "var(--color-mint)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-mint)" }} />
          Page not found
        </div>

        <p className="text-base mb-8 max-w-sm mx-auto" style={{ color: "var(--color-muted)" }}>
          This route doesn&apos;t exist. You may have followed a broken link or mistyped the address.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold rounded-lg transition-all hover:bg-[var(--color-mint-bright)]"
          style={{
            background: "var(--color-mint)",
            color: "#ffffff",
            padding: "0.75rem 1.5rem",
            fontSize: "0.875rem",
          }}
        >
          <Home size={15} />
          Go home
        </Link>
      </div>
    </div>
  );
}
