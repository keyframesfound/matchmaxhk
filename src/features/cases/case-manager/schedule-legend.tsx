import { useTranslation } from "react-i18next";

import { SCHEDULE_STATES } from "@/features/cases/case-schedule";

/**
 * #636: the one legend for schedule states. Other surfaces (#551, #605, #659,
 * #660) reuse the same .mm-slot-* classes and schedule_state.* copy.
 */
export function ScheduleLegend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      {SCHEDULE_STATES.map((state) => (
        <li key={state} title={t(`schedule_state.${state}_hint`)} className="flex items-center gap-1.5">
          <span aria-hidden className={`mm-slot-${state} h-3 w-3 rounded-[4px]`} />
          {t(`schedule_state.${state}`)}
        </li>
      ))}
    </ul>
  );
}
