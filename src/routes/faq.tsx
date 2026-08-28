import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    a: "Parents pay you directly for your lessons via your preferred payment method. After parents pay you, you pay MatchMax our agency commission for the 1st and 11th lesson of that student contract. All earnings for all other lessons are 100% yours.",
  },
  {
    q: "How many days does it usually take to find students?",
    a: "Matching speed depends on subject demand, your profile quality, and availability. Many tutors receive relevant student matching requests within 1 to 2 weeks.",
  },
  {
    q: "What are typical tutoring rates?",
    a: "Usual market rates typically range between HK$300 to HK$600 per hour. However, rates vary depending on lesson mode (online vs. in-person), duration, level, subject complexity, and your academic background. Tutors can discuss and negotiate rates directly with parents to agree on a fair fee.",
  },
  {
    q: "Do I need teaching experience to join?",
    a: "Prior experience helps, but strong academic results, clear communication skills, and a complete profile are equally important for verification and student matching.",
  },
  {
    q: "Can I teach both online and in person?",
    a: "Yes. You can set your preferred lesson modes and target locations in your profile and update them anytime as your schedule changes.",
  },
  {
    q: "What happens if a parent doesn't pay me?",
    a: "While payment arrangements are made directly between you and the parent, MatchMax takes payment protection seriously. If a parent fails to pay for completed lessons, we will intervene, follow up directly with the parent, and use all appropriate lawful methods to help you recover your unpaid fees.",
  },
];

function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-foreground">
              FAQs
            </p>
            <h1 className="mt-3 text-center text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Ask us anything
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-foreground">
              Have any questions? We&apos;re here to assist you.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="rounded-2xl border border-border bg-[color:var(--surface)] px-5 py-2 sm:px-8">
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item, index) => (
                  <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
                    <AccordionTrigger className="py-6 text-left text-xl font-extrabold text-foreground hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-foreground">
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
