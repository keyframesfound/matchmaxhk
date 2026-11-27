import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { LifeBuoy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import { Textarea } from "@/components/ui/textarea";
import {
  listCaseTickets,
  replyToTicket,
  resolveTicket,
  type CaseSupportTicket,
  type TicketAuthorRole,
} from "@/features/cases/support-tickets.functions";
import {
  TICKET_BODY_MAX,
  TICKET_NOTE_MAX,
  TICKET_REASON_LABELS,
  TICKET_REASON_LABELS_ZH,
  replyError,
} from "@/features/cases/support-tickets";

/**
 * #816 §2.3: support tickets on the case desk. One open ticket per case, a
 * staff reply box that rejects contact details, and Resolve / Close. The panel
 * is deliberately narrow: a ticket is a case record, not a chat product.
 * English-first desk copy with 繁中 on the lines the HK desk relies on.
 */
const COPY = {
  title: "Support ticket / 支援票",
  subtitle:
    "One open ticket per case. Staff answer inside the ticket, not on WhatsApp. / 每個個案同時只有一張處理中的支援票，職員會在此回覆。",
  empty: "No support ticket on this case. / 此個案沒有支援票。",
  unavailable: "Support tickets are not available yet. / 支援工單暫未開放。",
  loading: "Loading tickets… / 正在載入支援票…",
  loadError: "Couldn’t load tickets. Try again. / 未能載入支援票，請再試一次。",
  replyLabel: "Staff reply / 職員回覆",
  replyPlaceholder:
    "Write a reply. No phone numbers, emails or links. / 請輸入回覆。不可包含電話號碼、電郵或連結。",
  reply: "Reply / 回覆",
  resolutionLabel: "Resolution note (optional) / 處理備註（可選）",
  resolutionPlaceholder: "What was agreed, in one or two lines. / 以一兩句交代處理結果。",
  resolve: "Resolve / 已處理",
  close: "Close / 結束",
  closedHeading: "Closed tickets / 已結束支援票",
  noMessages: "No replies yet. / 尚未回覆。",
  errEmpty: "Reply cannot be empty. / 回覆不可留空。",
  errTooLong: "Reply must be 500 characters or fewer. / 回覆不可超過 500 字。",
  errContact:
    "Remove phone numbers, emails, links or chat-app names. / 請移除電話號碼、電郵、連結或通訊軟件名稱。",
  errResolutionTooLong: "Resolution must be 500 characters or fewer. / 處理備註不可超過 500 字。",
  errNotOpen: "This ticket is already closed. / 此支援票已經結束。",
  errGeneric: "Couldn’t complete that. Try again. / 未能完成，請再試一次。",
} as const;

const ROLE_LABEL: Record<TicketAuthorRole, string> = {
  parent: "Parent / 家長",
  tutor: "Tutor / 導師",
  centre: "Centre / 中心",
  staff: "MatchMax staff / MatchMax 職員",
};

function messageForError(code: string): string {
  switch (code) {
    case "TOO_LONG":
      return COPY.errTooLong;
    case "CONTACT_DETAILS":
      return COPY.errContact;
    case "RESOLUTION_TOO_LONG":
      return COPY.errResolutionTooLong;
    case "TICKET_NOT_OPEN":
      return COPY.errNotOpen;
    default:
      return COPY.errGeneric;
  }
}

function reasonLine(ticket: CaseSupportTicket): string {
  return `${TICKET_REASON_LABELS[ticket.reason]} / ${TICKET_REASON_LABELS_ZH[ticket.reason]}`;
}

function age(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function CaseSupportTicketsPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const fetchTickets = useServerFn(listCaseTickets);
  const sendReply = useServerFn(replyToTicket);
  const settle = useServerFn(resolveTicket);
  const [body, setBody] = useState("");
  const [resolution, setResolution] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const queryKey = ["case-support-tickets", caseId];

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => fetchTickets({ data: { caseId } }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const reply = useMutation({
    mutationFn: (ticketId: string) => sendReply({ data: { ticketId, body } }),
    onSuccess: () => {
      setBody("");
      setNotice(null);
      invalidate();
    },
    onError: (e: Error) => setNotice(messageForError(e.message)),
  });

  const resolve = useMutation({
    mutationFn: (input: { ticketId: string; nextStatus: "resolved" | "closed" }) =>
      settle({ data: { ...input, resolution: resolution || null } }),
    onSuccess: () => {
      setResolution("");
      setNotice(null);
      invalidate();
    },
    onError: (e: Error) => setNotice(messageForError(e.message)),
  });

  const onReply = (ticketId: string) => {
    const error = replyError(body);
    if (error) {
      setNotice(
        error === "CONTACT_DETAILS"
          ? COPY.errContact
          : error === "TOO_LONG"
            ? COPY.errTooLong
            : COPY.errEmpty,
      );
      return;
    }
    reply.mutate(ticketId);
  };

  const onResolve = (ticketId: string, nextStatus: "resolved" | "closed") => {
    if (resolution.trim().length > TICKET_NOTE_MAX) {
      setNotice(COPY.errResolutionTooLong);
      return;
    }
    resolve.mutate({ ticketId, nextStatus });
  };

  const open = data?.open ?? null;
  const closed = data?.closed ?? [];
  const busy = reply.isPending || resolve.isPending;

  // The ticket tables ship with migration 20261127140000. Until the
  // environment has them, the desk gets one quiet line and no controls.
  if (data?.available === false) {
    return (
      <ConsolePanel>
        <p className="text-xs text-muted-foreground">{COPY.unavailable}</p>
      </ConsolePanel>
    );
  }

  return (
    <ConsolePanel>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
        <LifeBuoy className="h-4 w-4" aria-hidden="true" />
        {COPY.title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{COPY.subtitle}</p>

      {isPending ? <p className="mt-2 text-xs text-muted-foreground">{COPY.loading}</p> : null}
      {isError ? <p className="mt-2 text-xs text-destructive">{COPY.loadError}</p> : null}

      {!isPending && !isError && !open ? (
        <p className="mt-3 text-xs text-muted-foreground">{COPY.empty}</p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-bold text-[color:var(--ink)]">{reasonLine(open)}</p>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_LABEL[open.openedByRole]} · {age(open.createdAt)}
              </p>
            </div>
            {open.note ? (
              <p className="mt-1.5 whitespace-pre-wrap text-xs text-[color:var(--ink)]">
                {open.note}
              </p>
            ) : null}

            <ul className="mt-3 space-y-2 border-t border-[color:var(--ink)]/[0.07] pt-3">
              {open.messages.length === 0 ? (
                <li className="text-xs text-muted-foreground">{COPY.noMessages}</li>
              ) : (
                open.messages.map((message) => (
                  <li key={message.id}>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {ROLE_LABEL[message.authorRole]} · {age(message.createdAt)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-[color:var(--ink)]">
                      {message.body}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-medium text-[color:var(--ink)]"
              htmlFor="support-ticket-reply"
            >
              {COPY.replyLabel}
            </label>
            <Textarea
              id="support-ticket-reply"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={TICKET_BODY_MAX}
              rows={3}
              placeholder={COPY.replyPlaceholder}
              className="text-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || body.trim().length === 0}
              onClick={() => onReply(open.id)}
            >
              {COPY.reply}
            </Button>
          </div>

          <div className="space-y-2 border-t border-[color:var(--ink)]/[0.07] pt-3">
            <label
              className="text-xs font-medium text-[color:var(--ink)]"
              htmlFor="support-ticket-resolution"
            >
              {COPY.resolutionLabel}
            </label>
            <Textarea
              id="support-ticket-resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              maxLength={TICKET_NOTE_MAX}
              rows={2}
              placeholder={COPY.resolutionPlaceholder}
              className="text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => onResolve(open.id, "resolved")}
              >
                {COPY.resolve}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onResolve(open.id, "closed")}
              >
                {COPY.close}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? <p className="mt-2 text-xs text-destructive">{notice}</p> : null}

      {closed.length > 0 ? (
        <div className="mt-3 border-t border-[color:var(--ink)]/[0.07] pt-2">
          <p className="text-xs font-semibold text-[color:var(--ink)]">{COPY.closedHeading}</p>
          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {closed.map((ticket) => (
              <li key={ticket.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {reasonLine(ticket)} · {ticket.status}
                </span>
                <span className="text-[11px]">{age(ticket.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ConsolePanel>
  );
}
