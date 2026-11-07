import type { TFunction } from "i18next";

/** #636: small helpers shared by the series and edit dialogs. */
export const DURATION_CHOICES_MIN = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

export function minuteToClock(minute: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

export function clockToMinute(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function scheduleErrorText(t: TFunction, code: string): string {
  return t(`sor.schedule_next_err_${code}`, { defaultValue: t("case_manager.schedule_error") });
}
