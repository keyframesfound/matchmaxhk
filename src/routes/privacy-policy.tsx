import { createFileRoute } from "@tanstack/react-router";
import { UserCog, FileText, Lock } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | MatchMax" },
      {
        name: "description",
        content: "Privacy policy and trust-and-safety principles for using MatchMax.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPolicyPage,
});

export const INTRO_TEXT = "At MatchMax, ('MatchMax', 'we' or 'us'), we respect your legal rights to privacy when collecting, storing, using and transmitting personal data. This statement explains our personal data practices in compliance with the requirements of the Personal Data (Privacy) Ordinance (Cap. 486) of the Laws of the Hong Kong Special Administrative Region.";

const SECTIONS = [
  {
    icon: FileText,
    title: "Purpose of Collection",
    description: "We will only use personal data collected from you for one or more of the following purposes:",
    points: [
      "To establish and maintain a record of your involvement in any MatchMax activities;",
      "To provide services you have requested from us;",
      "To answer your inquiry;",
      "To keep you informed of new developments or programmes we believe may be of interest to you."
    ],
    footer: "We will not use or disclose your personal data for any other purpose without first seeking your written consent, unless authorised or required by law. We will not publish or make known publicly to others any and all personal data provided to us such as health information, Hong Kong ID card, address or contact details in newsletters, email or phone inquiries, or bulletins without the written consent by you."
  },
  {
    icon: Lock,
    title: "Data Security",
    description: "We will take reasonable measures to keep secure the personal data which we hold and to protect it from any and all unauthorised disclosure and misuse.",
    points: []
  },
  {
    icon: UserCog,
    title: "Access to Personal Data",
    description: "You have the right to opt out of any communication from us. We will only maintain your personal data if legally permitted to do so, after you have instructed us not to send information and communications to you. You have the right to request access to and correction of your personal data as provided in the Personal Data (Privacy) Ordinance. Your right of access includes the right to obtain a copy of your personal data and the right to correct any of the data that is inaccurate.",
    footer: "Requests for access to and/or correction of your personal data relating to your application should be sent to:\n\nExecutive Director\nMatchMax",
    points: []
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="flex-1 pb-16">
        
        {/* Hero Section */}
        <section className="bg-[#041344] py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#77E8EE]">
              We are committed to a safe, transparent, and trustworthy experience for both parents and tutors.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
          
          {/* Intro Box */}
          <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-base font-medium leading-relaxed text-[#0A245F]">
              {INTRO_TEXT}
            </p>
          </div>

          {/* Policy Sections */}
          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <article 
                key={section.title} 
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
              >
                <div className="flex flex-col items-start gap-6 sm:flex-row">
                  
                  {/* Icon Container */}
                  <div className="rounded-xl bg-[#77E8EE]/20 p-4 text-[#0A245F]">
                    <section.icon className="h-7 w-7" strokeWidth={2.5} />
                  </div>
                  
                  {/* Content Container */}
                  <div className="flex-1 space-y-4">
                    <h2 className="text-2xl font-black text-[#041344]">
                      {section.title}
                    </h2>
                    
                    {section.description && (
                      <p className="text-slate-600 leading-relaxed">
                        {section.description}
                      </p>
                    )}
                    
                    {section.points && section.points.length > 0 && (
                      <ul className="space-y-2 pl-6 text-slate-600 marker:text-[#2ED5DE]">
                        {section.points.map((point) => (
                          <li key={point} className="list-disc pl-1">{point}</li>
                        ))}
                      </ul>
                    )}
                    
                    {section.footer && (
                      <div className="mt-6 whitespace-pre-wrap rounded-xl bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 border border-slate-100">
                        {section.footer}
                      </div>
                    )}
                  </div>

                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}