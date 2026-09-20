import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Settings | MatchMax" },
      { name: "description", content: "Manage your MatchMax account settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});
