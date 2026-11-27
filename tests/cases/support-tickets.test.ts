import { describe, expect, it } from "vitest";

import {
  canOpenTicket,
  isMissingRelation,
  partyTicketAuthorRole,
  replyError,
  ticketInputError,
  ticketIsOpen,
  TICKET_NOTE_MAX,
} from "../../src/features/cases/support-tickets";

describe("ticketInputError", () => {
  it("requires a note when the reason is other", () => {
    expect(ticketInputError({ reason: "other" })).toBe("NOTE_REQUIRED");
    expect(ticketInputError({ reason: "other", note: "" })).toBe("NOTE_REQUIRED");
    expect(ticketInputError({ reason: "other", note: "   " })).toBe("NOTE_REQUIRED");
  });

  it("accepts other with a note", () => {
    expect(
      ticketInputError({ reason: "other", note: "Tutor changed the agreed time." }),
    ).toBeNull();
  });

  it("caps the note at 500 characters", () => {
    expect(ticketInputError({ reason: "other", note: "a".repeat(TICKET_NOTE_MAX) })).toBeNull();
    expect(ticketInputError({ reason: "other", note: "a".repeat(TICKET_NOTE_MAX + 1) })).toBe(
      "NOTE_TOO_LONG",
    );
    expect(ticketInputError({ reason: "fee_amount", note: "a".repeat(TICKET_NOTE_MAX + 1) })).toBe(
      "NOTE_TOO_LONG",
    );
  });

  it("does not need a note for a fixed reason", () => {
    expect(ticketInputError({ reason: "fee_amount" })).toBeNull();
    expect(ticketInputError({ reason: "no_show", note: "   " })).toBeNull();
  });
});

describe("replyError", () => {
  it("rejects a phone number", () => {
    expect(replyError("Call me on 9123 4567 to sort this out.")).toBe("CONTACT_DETAILS");
  });

  it("rejects an email address", () => {
    expect(replyError("Email the parent at tutor@example.com.")).toBe("CONTACT_DETAILS");
  });

  it("rejects a wa.me link", () => {
    expect(replyError("Message me at wa.me/85291234567.")).toBe("CONTACT_DETAILS");
  });

  it("rejects a chat-app name", () => {
    expect(replyError("We can finish this on WhatsApp.")).toBe("CONTACT_DETAILS");
  });

  it("accepts normal desk prose", () => {
    expect(
      replyError("The fee invoice was regenerated. Please check the case page again."),
    ).toBeNull();
  });

  it("rejects empty and over-long replies", () => {
    expect(replyError("")).toBe("EMPTY");
    expect(replyError("   ")).toBe("EMPTY");
    expect(replyError("a".repeat(501))).toBe("TOO_LONG");
    expect(replyError("a".repeat(500))).toBeNull();
  });
});

describe("canOpenTicket", () => {
  it("allows a ticket only when the case has none open", () => {
    expect(canOpenTicket(0)).toBe(true);
    expect(canOpenTicket(1)).toBe(false);
    expect(canOpenTicket(3)).toBe(false);
  });
});

describe("partyTicketAuthorRole", () => {
  it("maps every authorised party to the stored author role", () => {
    expect(partyTicketAuthorRole("parent")).toBe("parent");
    expect(partyTicketAuthorRole("tutor")).toBe("tutor");
    expect(partyTicketAuthorRole("centre")).toBe("centre");
    expect(partyTicketAuthorRole("staff")).toBe("staff");
  });
});

describe("ticketIsOpen", () => {
  it("accepts messages only while the ticket is open", () => {
    expect(ticketIsOpen("open")).toBe(true);
    expect(ticketIsOpen("resolved")).toBe(false);
    expect(ticketIsOpen("closed")).toBe(false);
    expect(ticketIsOpen("")).toBe(false);
  });
});

describe("postTicketMessage validation", () => {
  it("rejects contact details in a party message with the shared helper", () => {
    expect(replyError("Call me on 9123 4567 about the fee.")).toBe("CONTACT_DETAILS");
    expect(replyError("The fee looks wrong for lesson 3.")).toBeNull();
  });

  it("refuses to post on a ticket that is no longer open", () => {
    expect(ticketIsOpen("resolved")).toBe(false);
    expect(ticketIsOpen("closed")).toBe(false);
  });
});

describe("isMissingRelation", () => {
  it("recognises Postgres 42P01 by code", () => {
    expect(isMissingRelation({ code: "42P01", message: "relation does not exist" })).toBe(true);
  });

  it("recognises the describeDbError-wrapped read message", () => {
    expect(
      isMissingRelation(
        new Error(
          'case_support_tickets: relation "public.case_support_tickets" does not exist [42P01]',
        ),
      ),
    ).toBe(true);
  });

  it("recognises the PostgREST schema-cache phrasing", () => {
    expect(
      isMissingRelation(
        "Could not find the table 'public.case_support_tickets' in the schema cache",
      ),
    ).toBe(true);
  });

  it("leaves every other error alone", () => {
    expect(isMissingRelation({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isMissingRelation(new Error("duplicate key value violates unique constraint"))).toBe(
      false,
    );
    expect(isMissingRelation(null)).toBe(false);
    expect(isMissingRelation(undefined)).toBe(false);
    expect(isMissingRelation("network request failed")).toBe(false);
  });
});
