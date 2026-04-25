import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * GlassCard - liquid glass floating card with gradient hairline border.
 * Used in hero to anchor a key trust signal.
 */
export const GlassCard = ({
  tag,
  title,
  subtitle,
  className = "",
}: {
  tag: string;
  title: React.ReactNode;
  subtitle: string;
  className?: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className={`relative w-[220px] rounded-2xl p-5 ${className}`}
      style={{
        background: "rgba(255,255,255,0.02)",
        backgroundBlendMode: "luminosity",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.08), 0 20px 50px -20px rgba(0,0,0,0.6)",
      }}
    >
      {/* gradient hairline border */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          padding: "1px",
          background: "linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.05))",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude" as const,
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-primary mb-3">
          <Sparkles className="w-3 h-3" />
          {tag}
        </div>
        <div className="font-display text-base leading-snug">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{subtitle}</div>
      </div>
    </motion.div>
  );
};
