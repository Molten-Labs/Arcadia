"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { TryDemoButton } from "./TryDemoButton";
import { NAV_LINKS } from "./data";

/**
 * B7 hamburger morph + full-screen glass overlay, md and below. The hamburger
 * lines rotate into an X (never disappear); menu items stagger in with a mask
 * fade/slide. Reduced-motion renders the panel without transitions.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] outline-none transition-colors duration-300 hover:border-acid/50 focus-visible:ring-2 focus-visible:ring-acid md:hidden"
      >
        <span
          aria-hidden
          className={cn(
            "absolute h-[2px] w-[18px] rounded-full bg-ink transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)]",
            open ? "rotate-45" : "-translate-y-[5px]"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute h-[2px] w-[18px] rounded-full bg-ink transition-opacity duration-200",
            open ? "opacity-0" : "opacity-100"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute h-[2px] w-[18px] rounded-full bg-ink transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)]",
            open ? "-rotate-45" : "translate-y-[5px]"
          )}
        />
      </button>

      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-0 z-40 flex flex-col md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 bg-black/80 backdrop-blur-3xl transition-opacity duration-300 motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <nav
          aria-label="Mobile"
          className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-6"
        >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className={cn(
                "w-full max-w-sm rounded-full border border-white/10 bg-white/[0.04] px-6 py-4 text-center font-mono text-[0.9rem] tracking-[0.16em] text-ink uppercase transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-acid/40 focus-visible:ring-2 focus-visible:ring-acid motion-reduce:transition-none",
                open ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-md"
              )}
              style={open ? { transitionDelay: `${100 + i * 100}ms` } : undefined}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="mt-4 w-full max-w-sm"
            onClick={() => setOpen(false)}
          >
            <TryDemoButton size="lg" className="w-full" />
          </div>
        </nav>
      </div>
    </>
  );
}
