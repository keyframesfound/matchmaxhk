import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
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
    <PublicPage>
      <PageIntro
        align="center"
        description="Have any questions? We're here to assist you."
        eyebrow="FAQs"
        title="Ask Us Anything"
        width="default"
      />

      <section className="py-10 sm:py-14">
        <PageContainer width="default">
          <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] px-5 py-2 shadow-[var(--shadow-brand)] sm:px-8">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
                  <AccordionTrigger className="py-6 text-left text-xl font-bold text-foreground hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </PageContainer>
      </section>
    </PublicPage>
  );
}
