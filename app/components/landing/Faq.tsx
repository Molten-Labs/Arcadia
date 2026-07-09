"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "./data";

/** FAQ: accessible single-open accordion over the canonical questions. */
export function Faq() {
  return (
    <Accordion type="single" collapsible className="grid max-w-[920px] gap-3.5">
      {FAQ_ITEMS.map((item, i) => (
        <AccordionItem key={item.q} value={`faq-${i}`}>
          <AccordionTrigger className="text-[clamp(1rem,1.7vw,1.22rem)]">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="text-[1rem] leading-[1.65] text-muted">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
