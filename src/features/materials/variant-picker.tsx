import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVariantPicker } from "@/features/materials/store-context.functions";

export type VariantValue = { variantOfId: string | null; label: string };

/** #556: another format of one of the seller's notes, with its own files and price. */
export function VariantPicker({
  materialId,
  value,
  onChange,
}: {
  materialId: string | null;
  value: VariantValue;
  onChange: (next: VariantValue) => void;
}) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["material-variant-picker", materialId],
    queryFn: () => getVariantPicker({ data: { materialId } }),
    retry: false,
  });
  const stored = data?.variantOfId ?? null;
  const storedLabel = data?.label ?? "";
  useEffect(() => {
    if (stored) onChange({ variantOfId: stored, label: storedLabel });
    // Only hydrate from the stored value; later picks belong to the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, storedLabel]);
  if ((data?.options ?? []).length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="note-variant-of">{t("materials_store.variant_label")}</Label>
      <select
        id="note-variant-of"
        value={value.variantOfId ?? ""}
        onChange={(event) => onChange({ ...value, variantOfId: event.target.value || null })}
        className="h-10 w-full rounded-md border border-input bg-[color:var(--surface)] px-3 text-sm"
      >
        <option value="">{t("materials_store.variant_none")}</option>
        {(data?.options ?? []).map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
      {value.variantOfId ? (
        <Input
          maxLength={30}
          value={value.label}
          placeholder={t("materials_store.variant_name")}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
      ) : null}
    </div>
  );
}
