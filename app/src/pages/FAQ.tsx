import { Layout } from "@/components/Layout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const items = [
  { q: "What is junior capital?", a: "It's the trader's own money, posted as first-loss collateral. If the vault loses money, the junior buffer absorbs the losses before any investor capital is touched." },
  { q: "What happens if a vault freezes?", a: "Trading is permanently disabled. Investors can withdraw any remaining liquidity. The trader's reputation is reduced significantly." },
  { q: "When can I withdraw?", a: "Standard withdrawals settle after a 24-hour cooldown. If junior health drops below 20%, withdrawals become instant." },
  { q: "How are performance fees calculated?", a: "Traders earn 15-20% only on gains above the previous high-water mark. No fees during drawdowns or sideways performance." },
  { q: "Is Kiln custodial?", a: "No. Kiln is a non-custodial protocol on Solana. You sign every transaction yourself." },
  { q: "Why does paper mode exist?", a: "It forces every new trader to build a public, on-chain track record using only their own capital before they can attract investor deposits." },
];

const FAQ = () => (
  <Layout>
    <div className="container py-16 max-w-3xl">
      <h1 className="font-display font-bold text-4xl">Frequently asked questions</h1>
      <Accordion type="single" collapsible className="mt-8">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`i-${i}`} className="border-border">
            <AccordionTrigger className="text-left font-display font-semibold hover:no-underline">{item.q}</AccordionTrigger>
            <AccordionContent className="text-foreground/80">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </Layout>
);

export default FAQ;
