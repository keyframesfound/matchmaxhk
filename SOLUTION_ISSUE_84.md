### Solución Técnica Detallada

Para implementar el Programa de Referidos para Tutores, la actualización del banner superior y la modificación de los Términos de Servicio (TOS), se realizarán los siguientes cambios en el código de la aplicación (arquitectura React / Next.js / Tailwind CSS):

---

### 1. Componente de Banner Superior (`components/TopBanner.tsx`)
Se implementa un carrusel/rotador de texto automático que alterna cada 5 segundos entre el mensaje actual y la nueva promoción del programa de referidos.

```tsx
// components/TopBanner.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export const TopBanner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const bannerItems = [
    {
      text: "Free for parents. Fair for tutors. Keep more with a low 1.5-lesson commission.",
      link: "/how-it-works",
      linkText: ""
    },
    {
      text: "🚀 Tutors: Refer a friend for a case and earn a 15% cash bonus!",
      link: "/how-it-works#referral-program",
      linkText: "Click here for details"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % bannerItems.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [bannerItems.length]);

  const activeItem = bannerItems[currentIndex];

  return (
    <div className="bg-blue-950 text-white text-sm py-2 px-4 text-center sticky top-0 z-50 transition-all duration-500 ease-in-out flex items-center justify-center gap-2">
      <span>{activeItem.text}</span>
      {activeItem.linkText && (
        <Link 
          href={activeItem.link} 
          className="underline font-semibold hover:text-blue-200 transition-colors"
        >
          [{activeItem.linkText}]
        </Link>
      )}
    </div>
  );
};
```

---

### 2. Sección del Programa de Referidos (`components/TutorReferralProgram.tsx`)
Se crea una nueva sección explicativa con las reglas del programa que se integrará tanto en `/how-it-works` como en el Dashboard de Tutores.

```tsx
// components/TutorReferralProgram.tsx
import React from 'react';

export const TutorReferralProgram = () => {
  return (
    <section id="referral-program" className="my-8 p-6 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        The MatchMax Tutor Referral Bounty
      </h2>
      <p className="text-slate-700 mb-4">
        Did your student ask you to recommend a tutor for another subject? Don't give the case away for free! Refer your friends to MatchMax, and we will pay you for the introduction.
      </p>

      <div className="space-y-4">
        <div className="p-4 bg-white rounded border border-slate-100">
          <h3 className="font-semibold text-blue-900">The Reward</h3>
          <p className="text-slate-700">
            You earn <strong>15%</strong> of the total MatchMax Administrative Matching Fee for that specific case.
          </p>
        </div>

        <div className="p-4 bg-white rounded border border-slate-100">
          <h3 className="font-semibold text-blue-900">The Conditions</h3>
          <ol className="list-decimal list-inside text-slate-700 space-y-1">
            <li>The payout is valid for the <strong>first successful case match</strong> of the newly referred tutor only.</li>
            <li>The 15% cash bounty will be transferred to you via FPS strictly <strong>after</strong> the referred tutor completes their first two (2) lessons and MatchMax has successfully collected the matching fee from the parent.</li>
          </ol>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold text-blue-950">How to Claim</h3>
          <p className="text-slate-800">
            Simply message our team in your dedicated MatchMax WhatsApp group and say:{' '}
            <span className="italic font-medium">"I have a tutor to refer for this student's English case."</span>{' '}
            We will handle the official matching and log your referral bonus!
          </p>
        </div>
      </div>
    </section>
  );
};
```

---

### 3. Actualización de Sección 3 en Términos de Servicio (`pages/tos.tsx` / `app/tos/page.tsx`)
Se reemplaza el texto de la Sección 3 para contemplar la prohibición de derivaciones privadas y la integración con el programa oficial.

```tsx
// app/tos/page.tsx (Extracto Sección 3)
export default function TermsOfServicePage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      
      {/* ... Secciones 1 y 2 ... */}

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          3. Non-Circumvention (Bypassing) & Unauthorized Referrals
        </h2>
        <p className="text-slate-700 leading-relaxed mb-3">
          By utilizing MatchMax to connect with a tutor or client, both parties agree not to bypass the platform to avoid the initial Administrative Matching Fee.
        </p>
        <p className="text-slate-700 leading-relaxed mb-3">
          Furthermore, Tutors are strictly prohibited from acting as unauthorized agents. Tutors may not solicit MatchMax Clients for private, non-platform tutoring arrangements, nor may they refer non-platform tutors directly to Clients to circumvent MatchMax's matching services.
        </p>
        <p className="text-slate-700 leading-relaxed">
          If MatchMax determines that a parent and tutor have colluded to schedule private lessons prior to the payment of the MatchMax fee, or if a Tutor executes an unauthorized secondary referral, both parties will be permanently banned from the network, and the Client and/or Tutor agrees to a liquidated damages penalty of HK$2,000 for breach of contract. Authorized referrals must be processed exclusively through the official MatchMax Referral Program.
        </p>
      </section>

      {/* ... Demás secciones ... */}
    </main>
  );
}
```

---

### Generación de Commit Git

```bash
git add components/TopBanner.tsx components/TutorReferralProgram.tsx app/how-it-works/page.tsx app/tos/page.tsx
git commit -m "feat(referral): implement Tutor Referral Program, update TopBanner rotator, and update TOS Section 3

- Add auto-rotating promotional banner for Tutor Referral Bounty (15% cash bonus)
- Create TutorReferralProgram component detailing rules, conditions, and claim process
- Integrate referral rules section into How It Works & Tutor Dashboard
- Overwrite TOS Section 3 with updated Non-Circumvention and Unauthorized Referrals clauses"
```