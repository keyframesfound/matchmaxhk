import { createFileRoute, redirect } from "@tanstack/react-router";

// Issue #500: the Tutor Playbook folds into the Help Centre (canonical rule:
// every operational topic lives under /help). This route and the old
// /help/tutor-guide/tutor-handbook hub land on the tutor Help tab, where the
// same topics live as native articles (WhatsApp intros, scheduling, reschedules
// and tutor sick days, the admin fee, safeguarding). Hard 301 so search equity
// moves to /help?audience=tutors.
export const Route = createFileRoute("/tutor-playbook")({
  beforeLoad: () => {
    throw redirect({ to: "/help", search: { audience: "tutors" }, statusCode: 301 });
  },
});
