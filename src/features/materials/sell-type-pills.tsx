import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type SellType = "note" | "pack" | "course" | "video" | "marking";

const PILLS: { type: SellType; to: string; search?: { type: string } }[] = [
  { type: "note", to: "/account/notes/new" },
  { type: "pack", to: "/account/folders/new" },
  { type: "course", to: "/account/courses/new", search: { type: "course" } },
  { type: "video", to: "/account/courses/new", search: { type: "video" } },
  { type: "marking", to: "/account/services/new", search: { type: "marking" } },
];

/** #556: the five seller types. Each opens the existing editor for that listing. */
export function SellTypePills({ active }: { active: SellType }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("materials_store.type_nav")} className="mb-6 flex flex-wrap gap-2">
      {PILLS.map(({ type, to, search }) => (
        <Link
          key={type}
          to={to}
          search={search}
          aria-current={active === type ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
            active === type
              ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
              : "border-border text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/30",
          )}
        >
          {t(`materials_store.type_${type}`)}
        </Link>
      ))}
    </nav>
  );
}
