import { Layout } from "@/components/Layout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/faq";

const FAQ = () => (
  <Layout>
    <div className="container py-16 max-w-3xl">
      <h1 className="font-display type-h1 font-semibold">Frequently asked questions</h1>
      <Accordion type="single" collapsible className="mt-8">
        {FAQ_ITEMS.map((item, i) => (
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
