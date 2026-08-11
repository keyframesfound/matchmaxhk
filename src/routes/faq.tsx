import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ | MatchMax" },
      { name: "description", content: "Frequently asked questions about MatchMax tutoring." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: FAQPage,
});

const FAQ_ITEMS = [
  {
    q: "How do I get paid?",
    a: "After a lesson is confirmed, payment is handled through the agreed MatchMax process. You keep your lesson earnings according to the current commission structure.",
  },
  {
    q: "How many days does it usually take to find students?",
    a: "Matching speed depends on subject demand, your profile quality, and availability. Many tutors receive relevant requests within around 1 to 2 weeks.",
  },
  {
    q: "What are typical tutoring rates?",
    a: "Rates vary by subject, level, and tutor experience. You can set your own hourly rate and adjust it based on demand and outcomes.",
  },
  {
    q: "Do I need teaching experience to join?",
    a: "Experience helps, but strong academic results, communication skills, and a complete profile are also important for approval and matching.",
  },
  {
    q: "Can I teach both online and in person?",
    a: "Yes. You can set your lesson mode preferences in your profile and update them anytime based on your schedule.",
  },
];

function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-black">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-black">FAQs</p>
            <h1 className="mt-3 text-center text-4xl font-black tracking-tight text-black sm:text-5xl">
              Ask us anything
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-black">
              Have any questions? We&apos;re here to assist you.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="rounded-2xl border border-border bg-white px-5 py-2 sm:px-8">
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item, index) => (
                  <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
                    <AccordionTrigger className="py-6 text-left text-xl font-extrabold text-black hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-black">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
