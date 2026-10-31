import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChildInput, type ChildProfile } from "@/features/children/children";
import { listMyChildren, saveChild } from "@/features/children/children.functions";
import { CHILDREN_QUERY_KEY } from "@/features/children/my-children-section";

type ChildPickerProps = {
  value: string;
  onSelect: (child: ChildProfile | null) => void;
};

/**
 * Issue #459 §8.4: "Booking for: [Anson] [+ Add child]". Picking a child
 * links the case to that sub-profile; tapping the selected child again
 * clears it. A quick add needs only a nickname (the rest lives on /account).
 */
export function ChildPicker({ value, onSelect }: ChildPickerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [nickname, setNickname] = useState("");

  const childrenQuery = useQuery({
    queryKey: CHILDREN_QUERY_KEY,
    queryFn: () => listMyChildren(),
  });
  const children = childrenQuery.data ?? [];

  const addMutation = useMutation({
    mutationFn: () => saveChild({ data: { child: ChildInput.parse({ nickname }) } }),
    onSuccess: (child) => {
      void queryClient.invalidateQueries({ queryKey: CHILDREN_QUERY_KEY });
      setAdding(false);
      setNickname("");
      onSelect(child);
    },
    onError: () => toast.error(t("children.error")),
  });

  const canAdd = nickname.trim().length > 0 && !addMutation.isPending;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-[color:var(--ink)]">
        {t("children.picker_label")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("children.picker_label")}
        className="flex flex-wrap gap-2"
      >
        {children.map((child) => {
          const selected = child.id === value;
          return (
            <button
              key={child.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(selected ? null : child)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                selected
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--surface)]"
                  : "border-border bg-card text-[color:var(--ink)] hover:bg-muted",
              )}
            >
              {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
              {child.nickname}
            </button>
          );
        })}
        {!adding ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("children.add")}
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            autoFocus
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            onKeyDown={(event) => {
              // Enter would submit the whole case request form.
              if (event.key === "Enter") {
                event.preventDefault();
                if (canAdd) addMutation.mutate();
              }
            }}
            placeholder={t("children.picker_add_placeholder")}
            aria-label={t("children.nickname")}
            maxLength={40}
            className="h-10 max-w-xs flex-1"
          />
          <Button type="button" disabled={!canAdd} onClick={() => addMutation.mutate()}>
            {addMutation.isPending ? t("children.saving") : t("children.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
            {t("children.cancel")}
          </Button>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">{t("children.picker_hint")}</p>
    </div>
  );
}
