import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COURSE_ENQUIRY_MESSAGE_MAX_CHARS,
  type CourseEnquiryWhoFor,
} from "@/features/business/course-showcase";
import { submitCourseEnquiry } from "@/features/business/course-showcase.functions";
import { cn } from "@/lib/utils";

/**
 * #815 §2.5 (AC-CRS-2/3) + §2.3 (AC-TUT-3): one enquiry form behind both the
 * public course card and an affiliate "Request lesson". It is an enquiry, never
 * an enrolment: the lead lands in the centre's Requests inbox, and a tutor
 * request carries `requestedTutorCode` so the centre sees who was asked for.
 */
type CourseEnquiryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  orgName: string;
  course: { id: string; title: string } | null;
  tutor?: { tutorCode: string; displayName: string } | null;
  onSubmitted?: () => void;
};

export function CourseEnquiryModal({
  open,
  onOpenChange,
  orgSlug,
  orgName,
  course,
  tutor = null,
  onSubmitted,
}: CourseEnquiryModalProps) {
  const { t } = useTranslation();
  const submitEnquiry = useServerFn(submitCourseEnquiry);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whoFor, setWhoFor] = useState<CourseEnquiryWhoFor>("myself");
  const [message, setMessage] = useState("");
  const [botField, setBotField] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Every opening starts from a clean form: a reopened dialog must never leak
  // the previous visitor's contact details.
  useEffect(() => {
    if (!open) return;
    setName("");
    setPhone("");
    setEmail("");
    setWhoFor("myself");
    setMessage("");
    setBotField("");
    setSubmitting(false);
    setAttempted(false);
  }, [open]);

  const whoOptions: { value: CourseEnquiryWhoFor; label: string }[] = [
    { value: "myself", label: t("centre_channel.enquiry_who_self") },
    { value: "my_child", label: t("centre_channel.enquiry_who_child") },
  ];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    // Neither a course nor a tutor: nothing to enquire about, so nothing is sent.
    if (!course && !tutor) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      toast.error(t("centre_channel.enquiry_required"));
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      // A course enquiry keys off `courseId`; a tutor request keys off
      // `requestedTutorCode`. The two are mutually exclusive on this form.
      await submitEnquiry({
        data: {
          orgSlug,
          courseId: course?.id ?? null,
          requestedTutorCode: tutor?.tutorCode ?? null,
          name: trimmedName,
          phone: trimmedPhone,
          email: email.trim() || null,
          whoFor,
          message: message.trim() || null,
          botField: botField || null,
        },
      });
      toast.success(t("centre_channel.enquiry_success"));
      onOpenChange(false);
      onSubmitted?.();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : t("centre_channel.enquiry_error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const nameInvalid = attempted && !name.trim();
  const phoneInvalid = attempted && !phone.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("centre_channel.enquiry_title")}</DialogTitle>
          <DialogDescription>
            {t("centre_channel.enquiry_intro", { name: orgName })}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
          {course ? (
            <p className="rounded-[var(--radius-control)] border border-border bg-muted/60 px-3 py-2 text-sm font-medium text-[color:var(--ink)]">
              {t("centre_channel.enquiry_course_label", { title: course.title })}
            </p>
          ) : tutor ? (
            <p className="rounded-[var(--radius-control)] border border-border bg-muted/60 px-3 py-2 text-sm font-medium text-[color:var(--ink)]">
              {t("centre_channel.enquiry_tutor_label", { name: tutor.displayName })}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-enquiry-name">{t("centre_channel.enquiry_name")}</Label>
              <Input
                id="course-enquiry-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={nameInvalid || undefined}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-enquiry-phone">{t("centre_channel.enquiry_phone")}</Label>
              <Input
                id="course-enquiry-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                aria-invalid={phoneInvalid || undefined}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-enquiry-email">{t("centre_channel.enquiry_email")}</Label>
            <Input
              id="course-enquiry-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium leading-none text-[color:var(--ink)]">
              {t("centre_channel.enquiry_who")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {whoOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--ring)] has-[:focus-visible]:ring-offset-2",
                    whoFor === option.value
                      ? "border-[color:var(--ink)]/40 bg-[color:var(--ink)]/[0.04] font-semibold text-[color:var(--ink)]"
                      : "border-[color:var(--ink)]/15 text-muted-foreground hover:border-[color:var(--ink)]/25",
                  )}
                >
                  <input
                    type="radio"
                    name="whoFor"
                    value={option.value}
                    checked={whoFor === option.value}
                    onChange={() => setWhoFor(option.value)}
                    className="sr-only"
                    disabled={submitting}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="course-enquiry-message">{t("centre_channel.enquiry_message")}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {message.length}/{COURSE_ENQUIRY_MESSAGE_MAX_CHARS}
              </span>
            </div>
            <Textarea
              id="course-enquiry-message"
              name="message"
              rows={4}
              maxLength={COURSE_ENQUIRY_MESSAGE_MAX_CHARS}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Honeypot: a visitor never sees or focuses this; a bot fills it. */}
          <div aria-hidden="true" className="hidden">
            <label htmlFor="course-enquiry-botfield">Company website</label>
            <input
              id="course-enquiry-botfield"
              name="botField"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={botField}
              onChange={(event) => setBotField(event.target.value)}
            />
          </div>

          <DialogFooter className="mt-1 gap-2 sm:justify-end">
            <Button
              type="submit"
              variant="solid"
              color="blue"
              className="w-full font-bold sm:w-auto"
              loading={submitting}
            >
              {submitting
                ? t("centre_channel.enquiry_sending")
                : t("centre_channel.enquiry_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
