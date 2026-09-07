export type PipelineStep = {
  title: string;
  detail: string;
  badge?: string;
};

type VerificationPipelineProps = {
  eyebrow: string;
  title: string;
  lead: string;
  steps: PipelineStep[];
  handoffLabel: string;
  handoffFrom: string;
  handoffTo: string;
  demoNote: string;
};

export function VerificationPipeline({
  eyebrow,
  title,
  lead,
  steps,
  handoffLabel,
  handoffFrom,
  handoffTo,
  demoNote,
}: VerificationPipelineProps) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="h-fit lg:sticky lg:top-24">
          <p className="text-sm font-bold text-[#8ecdf8]">{eyebrow}</p>
          <h2 className="mt-4 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">{lead}</p>

          <ol className="mt-10 hidden space-y-3 lg:block" aria-hidden="true">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-center gap-3 text-sm font-bold text-[#1d9bf0]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1d9bf0]/60 bg-[#1d9bf0]/15 text-xs text-[#8ecdf8]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.title}
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              {handoffLabel}
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-white/70">
                {handoffFrom}
              </span>
              <span aria-hidden="true" className="text-[#1d9bf0]">
                →
              </span>
              <span className="rounded-md border border-[#1d9bf0]/40 bg-[#1d9bf0]/10 px-2.5 py-1 text-xs font-bold text-[#8ecdf8]">
                {handoffTo}
              </span>
            </span>
            <span className="text-xs text-white/30">{demoNote}</span>
          </div>
        </div>

        <ol className="relative space-y-6 border-l-2 border-[#1d9bf0]/30 pl-8 sm:pl-10">
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[41px] top-7 h-4 w-4 rounded-full border-2 border-[#1d9bf0] bg-[#1d9bf0] shadow-[0_0_12px_rgba(29,155,240,0.7)] sm:-left-[49px]"
              />
              <article className="w-full rounded-[var(--radius-panel)] border border-[#1d9bf0]/45 bg-white/[0.05] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-extrabold tracking-[0.18em] text-[#1d9bf0]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step.badge ? (
                    <span className="rounded-full border border-[#1d9bf0]/40 bg-[#1d9bf0]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#8ecdf8]">
                      {step.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{step.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">{step.detail}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
