import { motion } from "framer-motion";

interface Logo { name: string; }

const logos: Logo[] = [
  { name: "Solana" },
  { name: "Pyth" },
  { name: "Jupiter" },
  { name: "Phantom" },
  { name: "Jito" },
  { name: "Marinade" },
  { name: "Drift" },
  { name: "Kamino" },
  { name: "Helius" },
];

export const InfiniteSlider = () => {
  return (
    <section className="border-y border-border/50 bg-card/55 backdrop-blur-sm py-8">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="md:border-r md:border-border md:pr-8 shrink-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary/80">// powered by</div>
            <div className="text-sm font-display mt-1">Best-in-class infrastructure</div>
          </div>
          <div className="flex-1 overflow-hidden relative [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <motion.div
              className="flex gap-12 items-center whitespace-nowrap"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              {[...logos, ...logos].map((l, i) => (
                <div key={i} className="font-display type-h3 font-semibold text-muted-foreground/60 hover:text-foreground transition-colors shrink-0">
                  {l.name}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
