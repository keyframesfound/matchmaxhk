import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TICKET_BODY_MAX,
  TICKET_NOTE_MAX,
  TICKET_REASON_LABELS,
  TICKET_REASON_LABELS_ZH,
  TICKET_REASONS,
  replyError,
  type TicketReason,
} from "@/features/cases/support-tickets";
import {
  getMyCaseTicket,
  openCaseTicket,
  postTicketMessage,
  type TicketAuthorRole,
} from "@/features/cases/support-tickets.functions";

/**
 * #816 §2.3: the party-facing half of the support ticket. The desk answers in
 * `CaseSupportTicketsPanel`; this card is the only place a parent, tutor or
 * centre contact can open one and reply, so `openCaseTicket` finally has a UI
 * caller.
 *
 * English-first with 繁中 on the same line: the card renders on both the EN and
 * zh-HK routes, so the copy is inline rather than a locale key (same pattern as
 * the desk panel).
 */
const COPY = {
  title: "Support ticket / 支援工單",
  loading: "Loading support ticket… / 正在載入支援工單…",
  unavailable: "Support tickets are not available yet. / 支援工單暫未開放。",
  loadError: "Couldn’t load the ticket. Try again. / 未能載入工單，請再試一次。",
  prompt: "Something wrong with this case? / 此個案有問題？",
  getHelp: "Get help / 尋求協助",
  cancel: "Cancel / 取消",
  reasonLabel: "What is the issue? / 問題是甚麼？",
  noteLabel: "Tell us more / 補充說明",
  notePlaceholder: "What happened, in one or two lines. / 以一兩句說明發生了甚麼。",
  noteRequired: "A note is required for Other. / 選擇「其他」時必須填寫說明。",
  open: "Open ticket / 開啟工單",
  opening: "Opening… / 正在開啟…",
  staffNote:
    "MatchMax staff will reply here. Please do not include phone numbers, emails or links. / MatchMax 職員會在此回覆。請勿包含電話號碼、電郵或連結。",
  noMessages: "No replies yet. / 尚未回覆。",
  replyLabel: "Reply / 回覆",
  replyPlaceholder:
    "Write a reply. No phone numbers, emails or links. / 請輸入回覆。不可包含電話號碼、電郵或連結。",
  send: "Send / 送出",
  sending: "Sending… / 正在送出…",
  errNoteRequired: "Add a note when the reason is Other. / 選擇「其他」時請填寫說明。",
  errNoteTooLong: "The note must be 500 characters or fewer. / 說明不可超過 500 字。",
  errContact:
    "Remove phone numbers, emails, links or chat-app names. / 請移除電話號碼、電郵、連結或通訊軟件名稱。",
  errEmpty: "Write something before sending. / 請先輸入內容。",
  errTooLong: "Keep it to 500 characters or fewer. / 內容不可超過 500 字。",
  errExists: "This case already has an open ticket. / 此個案已有處理中的工單。",
  errClosed: "This ticket is already closed. / 此工單已經結束。",
  errForbidden: "You cannot open a ticket on this case. / 你不能在此個案開啟工單。",
  errUnavailable: "Support tickets are not available yet. / 支援工單暫未開放。",
  errGeneric: "Couldn’t complete that. Try again. / 未能完成，請再試一次。",
} as const;

const ROLE_LABEL: Record<TicketAuthorRole, string> = {
  parent: "Parent / 家長",
  tutor: "Tutor / 導師",
  centre: "Centre / 中心",
  staff: "MatchMax staff / MatchMax 職員",
};

/** Server error codes and local helper codes share one copy table. */
function messageForError(code: string): string {
  switch (code) {
    case "NOTE_REQUIRED":
      return COPY.errNoteRequired;
    case "NOTE_TOO_LONG":
      return COPY.errNoteTooLong;
    case "EMPTY":
      return COPY.errEmpty;
    case "TOO_LONG":
      return COPY.errTooLong;
    case "CONTACT_DETAILS":
      return COPY.errContact;
    case "TICKET_EXISTS":
      return COPY.errExists;
    case "TICKET_CLOSED":
    case "TICKET_NOT_OPEN":
      return COPY.errClosed;
    case "TICKETS_UNAVAILABLE":
      return COPY.errUnavailable;
    case "FORBIDDEN":
    case "CASE_NOT_FOUND":
      return COPY.errForbidden;
    default:
      return COPY.errGeneric;
  }
}

function reasonLine(reason: TicketReason): string {
  return `${TICKET_REASON_LABELS[reason]} / ${TICKET_REASON_LABELS_ZH[reason]}`;
}

function closedLine(count: number): string {
  return count === 1
    ? "1 closed ticket (read only) / 1 張已結束工單（只讀）"
    : `${count} closed tickets (read only) / ${count} 張已結束工單（只讀）`;
}

export function CaseSupportTicketCard({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const fetchTicket = useServerFn(getMyCaseTicket);
  const openTicket = useServerFn(openCaseTicket);
  const sendMessage = useServerFn(postTicketMessage);
  const headingId = useId();
  const reasonId = useId();
  const noteId = useId();
  const replyId = useId();

  const [helpOpen, setHelpOpen] = useState(false);
  const [reason, setReason] = useState<TicketReason>("fee_amount");
  const [note, setNote] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const queryKey = ["case-support-ticket", caseId];
  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => fetchTicket({ data: { caseId } }),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: () => openTicket({ data: { caseId, reason, note: note.trim() || null } }),
    onSuccess: () => {
      setNote("");
      setHelpOpen(false);
      setNotice(null);
      invalidate();
    },
    onError: (error: Error) => setNotice(messageForError(error.message)),
  });

  const reply = useMutation({
    mutationFn: (ticketId: string) => sendMessage({ data: { ticketId, body } }),
    onSuccess: () => {
      setBody("");
      setNotice(null);
      invalidate();
    },
    onError: (error: Error) => setNotice(messageForError(error.message)),
  });

  const ticket = data?.open ?? null;
  const closed = data?.closed ?? [];
  const busy = create.isPending || reply.isPending;
  const noteMissing = reason === "other" && note.trim().length === 0;

  const onOpen = () => {
    // ticketInputError lives in the shared module; the local check keeps the
    // reason select from posting a note the server would reject anyway.
    if (noteMissing) {
      setNotice(COPY.noteRequired);
      return;
    }
    create.mutate();
  };

  const onReply = (ticketId: string) => {
    const error = replyError(body);
    if (error) {
      setNotice(messageForError(error));
      return;
    }
    reply.mutate(ticketId);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-4"
    >
      <div className="flex items-center gap-1.5">
        <LifeBuoy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 id={headingId} className="text-sm font-semibold text-[color:var(--ink)]">
          {COPY.title}
        </h2>
      </div>

      {isPending ? <p className="text-xs text-muted-foreground">{COPY.loading}</p> : null}
      {isError ? <p className="text-xs text-destructive">{COPY.loadError}</p> : null}
      {data?.available === false ? (
        <p className="text-xs text-muted-foreground">{COPY.unavailable}</p>
      ) : null}

      {!isPending && !isError && data?.available !== false ? (
        ticket ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--ink)]">
              {reasonLine(ticket.reason)}
            </p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[ticket.openedByRole]}</p>
            {ticket.note ? (
              <p className="whitespace-pre-wrap text-sm text-[color:var(--ink)]">{ticket.note}</p>
            ) : null}

            <ul className="space-y-2 border-t border-border pt-2">
              {ticket.messages.length === 0 ? (
                <li className="text-xs text-muted-foreground">{COPY.noMessages}</li>
              ) : (
                ticket.messages.map((message) => (
                  <li key={message.id}>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {ROLE_LABEL[message.authorRole]}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-[color:var(--ink)]">
                      {message.body}
                    </p>
                  </li>
                ))
              )}
            </ul>

            <div className="space-y-2 border-t border-border pt-2">
              <label
                className="block text-xs font-medium text-[color:var(--ink)]"
                htmlFor={replyId}
              >
                {COPY.replyLabel}
              </label>
              <Textarea
                id={replyId}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={TICKET_BODY_MAX}
                rows={3}
                placeholder={COPY.replyPlaceholder}
              />
              <Button
                type="button"
                size="sm"
                disabled={busy || body.trim().length === 0}
                onClick={() => onReply(ticket.id)}
              >
                {reply.isPending ? COPY.sending : COPY.send}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">{COPY.staffNote}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{COPY.prompt}</p>

            {!helpOpen ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setNotice(null);
                  setHelpOpen(true);
                }}
              >
                {COPY.getHelp}
              </Button>
            ) : (
              <div className="space-y-2">
                <label
                  className="block text-xs font-medium text-[color:var(--ink)]"
                  htmlFor={reasonId}
                >
                  {COPY.reasonLabel}
                </label>
                <Select value={reason} onValueChange={(value) => setReason(value as TicketReason)}>
                  <SelectTrigger id={reasonId} className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_REASONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {reasonLine(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label
                  className="block text-xs font-medium text-[color:var(--ink)]"
                  htmlFor={noteId}
                >
                  {COPY.noteLabel}
                </label>
                <Textarea
                  id={noteId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={TICKET_NOTE_MAX}
                  rows={3}
                  placeholder={COPY.notePlaceholder}
                />
                {noteMissing ? (
                  <p className="text-xs text-muted-foreground">{COPY.noteRequired}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" disabled={busy || noteMissing} onClick={onOpen}>
                    {create.isPending ? COPY.opening : COPY.open}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setHelpOpen(false);
                      setNotice(null);
                    }}
                  >
                    {COPY.cancel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      ) : null}

      {notice ? <p className="text-xs text-destructive">{notice}</p> : null}

      {closed.length > 0 ? (
        <p className="text-xs text-muted-foreground">{closedLine(closed.length)}</p>
      ) : null}
    </section>
  );
}
