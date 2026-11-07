import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCollection, getCollectionPicker } from "@/features/materials/collections.functions";

/** #556: an optional folder for the seller's store. It never affects price. */
export function CollectionPicker({
  materialId,
  value,
  onChange,
}: {
  materialId: string | null;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const queryKey = ["material-collections", materialId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => getCollectionPicker({ data: { materialId } }),
    retry: false,
  });
  const selected = data?.selected ?? null;
  useEffect(() => {
    if (selected) onChange(selected);
    // Only hydrate from the stored value; later picks belong to the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const create = useMutation({
    mutationFn: () => createCollection({ data: { name } }),
    onSuccess: async (collection) => {
      setName("");
      onChange(collection.id);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-1.5">
      <Label htmlFor="note-collection">{t("materials_store.collection_label")}</Label>
      <select
        id="note-collection"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-10 w-full rounded-md border border-input bg-[color:var(--surface)] px-3 text-sm"
      >
        <option value="">{t("materials_store.collection_none")}</option>
        {(data?.collections ?? []).map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Input
          value={name}
          maxLength={60}
          placeholder={t("materials_store.collection_new")}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          {t("materials_store.collection_add")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("materials_store.collection_hint")}</p>
    </div>
  );
}
