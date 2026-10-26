import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect, DropdownModalContext } from "@/components/ui/searchable-select";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import {
  bookGroupCohort,
  getPublicGroupCohorts,
  type GroupCohortView,
} from "@/lib/group-cohort.functions";
import { cohortAdminFeeHkd } from "@/features/cases/group-cohorts";
import { lesson1Amount, lesson2BalanceAmount } from "@/features/cases/fee-breakdown";
import { cn } from "@/lib/utils";

/**
 * Issue #391, public /group-classes board: open small-group cohorts with
 * live seat counts, plus the sibling booking dialog (one case per parent,
 * student_count = seats; unrelated parents never see each other).
 */

function StatePill({ state }: { state: string }) {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    forming: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    running: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    full: "border-border bg-muted text-[color:var(--ink)]",
    closed: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        styles[state] ?? styles.closed,
      )}
    >
      {t(`group_classes.state_${state}`)}
    </span>
  );
}

function CohortCard({ cohort, onBook }: { cohort: GroupCohortView; onBook: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col rounded-sm border border-border bg-card p-5 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-[color:var(--ink)]/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatePill state={cohort.state} />
        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
          {cohort.curriculum}
        </span>
      </div>
      <h3 className="mt-2.5 text-base font-bold text-[color:var(--ink)]">{cohort.title}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-[color:var(--ink)]">
          {cohort.tutorCode ?? cohort.tutorName}
        </span>
        {cohort.verified ? (
          <BadgeCheck
            className="h-3.5 w-3.5 fill-[#1d9bf0] text-white dark:text-[#0b2230]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        ) : null}
        <span>· {cohort.subject}</span>
        <span>· {cohort.studentLevel}</span>
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 text-[color:var(--brand-link)]" aria-hidden="true" />
          {cohort.weeklySchedule}
        </span>
        <span className="inline-flex items-center gap-1">
          {cohort.mode === "online" ? (
            t("group_classes.mode_online")
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5 text-[color:var(--brand-link)]" aria-hidden="true" />
              {cohort.district}
            </>
          )}
        </span>
      </p>
      {cohort.description ? (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {cohort.description}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
        <div>
          <p className="text-xl font-bold leading-none text-[color:var(--ink)]">
            ${cohort.perStudentRateHkd}
            <span className="ml-1 text-[0.55em] font-medium text-muted-foreground">
              {t("group_classes.per_student_rate_suffix")}
            </span>
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {t("group_classes.seats_line", {
              taken: cohort.seatsTaken,
              max: cohort.maxSeats,
              min: cohort.minSeats,
            })}
          </p>
        </div>
        <Button type="button" size="sm" disabled={!cohort.bookable} onClick={onBook}>
          {cohort.bookable ? t("group_classes.book") : t(`group_classes.state_${cohort.state}`)}
        </Button>
      </div>
    </li>
  );
}

function BookingDialog({ cohort, onClose }: { cohort: GroupCohortView; onClose: () => void }) {
  const { t } = useTranslation();
  const [seats, setSeats] = useState("1");
  const [students, setStudents] = useState([{ firstName: "", grade: "" }]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsappOk, setWhatsappOk] = useState(true);
  const [notes, setNotes] = useState("");
  const [termsAck, setTermsAck] = useState(false);
  const [feeAck, setFeeAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookedCode, setBookedCode] = useState<string | null>(null);

  const seatCount = Number(seats) || 1;
  const adminFee = cohortAdminFeeHkd(cohort.perStudentRateHkd, seatCount);
  const lesson1 = lesson1Amount(cohort.perStudentRateHkd, seatCount);
  const lesson2 = lesson2BalanceAmount(cohort.perStudentRateHkd, seatCount);

  const setSeatCount = (value: string) => {
    const count = Number(value) || 1;
    setSeats(value);
    setStudents((current) => {
      const next = [...current];
      while (next.length < count) next.push({ firstName: "", grade: "" });
      return next.slice(0, count);
    });
  };

  const updateStudent = (index: number, patch: { firstName?: string; grade?: string }) => {
    setStudents((current) =>
      current.map((student, i) => (i === index ? { ...student, ...patch } : student)),
    );
  };

  const canSubmit =
    !submitting &&
    termsAck &&
    feeAck &&
    contactName.trim().length > 0 &&
    contactPhone.trim().length >= 5 &&
    students.every((s) => s.firstName.trim() && s.grade.trim());

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await bookGroupCohort({
        data: {
          cohortId: cohort.id,
          seats: seatCount,
          students: students.map((s) => ({ firstName: s.firstName.trim(), grade: s.grade.trim() })),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          whatsappOk,
          notes: notes.trim() || null,
          termsAck: true,
          feeTermsAck: true,
        },
      });
      setBookedCode(result.caseCode);
      toast.success(t("group_classes.booked_toast", { code: result.caseCode }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "bg-[color:var(--surface)]";

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* In-dialog dropdown: the Radix dialog scroll-lock must not eat the
            portaled list's wheel events (same fix as the FiltersDialog). */}
        <DropdownModalContext.Provider value={true}>
          <DialogHeader>
            <DialogTitle>{t("group_classes.booking_title")}</DialogTitle>
          </DialogHeader>
          {bookedCode ? (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--ink)]">
                {t("group_classes.booked_body", { code: bookedCode })}
              </p>
              <p className="text-sm text-muted-foreground">{t("group_classes.booked_next")}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("group_classes.close")}
                </Button>
                <Button type="button" asChild>
                  <Link to="/account/cases">{t("group_classes.view_cases")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-sm border border-border p-3">
                <p className="text-sm font-bold text-[color:var(--ink)]">{cohort.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {cohort.curriculum} · {cohort.subject} · {cohort.weeklySchedule} ·{" "}
                  {cohort.mode === "online"
                    ? t("group_classes.mode_online")
                    : `${t("group_classes.mode_in_person")} · ${cohort.district ?? ""}`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("group_classes.form_seats")}</Label>
                  <SearchableSelect
                    value={seats}
                    onChange={(v) => setSeatCount(v || "1")}
                    options={Array.from({ length: cohort.seatsLeft }, (_, i) => i + 1).map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2 self-end">
                  <p className="text-xs text-muted-foreground">
                    {t("group_classes.seats_left", { left: cohort.seatsLeft })}
                  </p>
                </div>
              </div>

              {students.map((student, index) => (
                <div key={index} className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("group_classes.form_student_name", { index: index + 1 })}</Label>
                    <Input
                      value={student.firstName}
                      maxLength={40}
                      placeholder={t("group_classes.form_student_name_placeholder")}
                      onChange={(e) => updateStudent(index, { firstName: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("group_classes.form_student_grade", { index: index + 1 })}</Label>
                    <Input
                      value={student.grade}
                      maxLength={40}
                      placeholder={t("group_classes.form_student_grade_placeholder")}
                      onChange={(e) => updateStudent(index, { grade: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("group_classes.form_contact_name")}</Label>
                  <Input
                    value={contactName}
                    maxLength={80}
                    onChange={(e) => setContactName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("group_classes.form_contact_phone")}</Label>
                  <Input
                    value={contactPhone}
                    inputMode="tel"
                    maxLength={40}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                <Checkbox checked={whatsappOk} onCheckedChange={(v) => setWhatsappOk(v === true)} />
                {t("group_classes.form_whatsapp_ok")}
              </label>

              <div className="space-y-2">
                <Label>{t("group_classes.form_notes")}</Label>
                <Textarea
                  value={notes}
                  maxLength={500}
                  rows={2}
                  placeholder={t("group_classes.form_notes_placeholder")}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* #391 fee preview, same math the desk invoices with. */}
              <div className="rounded-sm border border-border p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-[color:var(--ink)]">
                  {t("group_classes.fee_preview_title")}
                </p>
                <p className="mt-1">
                  {t("group_classes.fee_preview_total", {
                    total: adminFee,
                    rate: cohort.perStudentRateHkd,
                    seats: seatCount,
                  })}
                </p>
                <p>{t("group_classes.fee_preview_split", { lesson1, lesson2 })}</p>
                <p className="mt-1">{t("group_classes.fee_preview_note")}</p>
              </div>

              <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Checkbox
                  className="mt-0.5"
                  checked={termsAck}
                  onCheckedChange={(v) => setTermsAck(v === true)}
                />
                <span>{t("group_classes.terms_ack")}</span>
              </label>
              <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Checkbox
                  className="mt-0.5"
                  checked={feeAck}
                  onCheckedChange={(v) => setFeeAck(v === true)}
                />
                <span>{t("group_classes.fee_ack")}</span>
              </label>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                  {t("group_classes.cancel")}
                </Button>
                <Button type="button" onClick={submit} disabled={!canSubmit}>
                  {submitting
                    ? t("group_classes.booking")
                    : t("group_classes.book_confirm", { seats: seatCount })}
                </Button>
              </div>
            </div>
          )}
        </DropdownModalContext.Provider>
      </DialogContent>
    </Dialog>
  );
}

export function GroupClassesBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [booking, setBooking] = useState<GroupCohortView | null>(null);

  const cohortsQuery = useQuery({
    queryKey: ["group-classes", "public"],
    queryFn: () => getPublicGroupCohorts(),
  });

  const cohorts = cohortsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-10 sm:px-8 lg:px-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold text-[color:var(--ink)] sm:text-4xl">
          {t("group_classes.board_title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("group_classes.board_intro")}
        </p>
      </header>

      {cohortsQuery.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">{t("group_classes.loading")}</p>
      ) : cohorts.length === 0 ? (
        <p className="mt-10 rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("group_classes.board_empty")}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cohorts.map((cohort) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              onBook={() => {
                if (user) {
                  setBooking(cohort);
                } else {
                  // Sign in first; the board is public, booking is not.
                  window.location.href = "/auth?redirect=/group-classes";
                }
              }}
            />
          ))}
        </ul>
      )}

      {booking ? <BookingDialog cohort={booking} onClose={() => setBooking(null)} /> : null}
    </div>
  );
}
