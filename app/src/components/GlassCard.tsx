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
      className={`surface-elevated relative w-[220px] rounded-lg p-5 ${className}`}
    >
      {/* gradient hairline border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-primary/35"
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase text-primary mb-3">
          <Sparkles className="w-3 h-3" />
          {tag}
        </div>
        <div className="font-display text-base leading-snug">{title}</div>
        <div className="type-small text-muted-foreground mt-2">{subtitle}</div>
      </div>
    </motion.div>
  );
};
