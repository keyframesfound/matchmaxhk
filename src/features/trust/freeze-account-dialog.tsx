import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * #782 staff Freeze & Suspend: a confirmation dialog that names the
 * consequence and requires a staff note (DESIGN.md: never window.prompt).
 */
export function FreezeAccountDialog({
  pending,
  onConfirm,
}: {
  pending: boolean;
  onConfirm: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const ready = note.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 border-destructive/50 px-3 text-xs font-bold text-destructive"
          disabled={pending}
        >
          {pending ? "Freezing…" : "Freeze & Suspend"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Freeze and suspend this account?</DialogTitle>
          <DialogDescription>
            The account is suspended at once: its tutor card is unpublished, live listings are
            hidden and it cannot accept cases or upload. You can release it later from Trust &amp;
            Safety.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="freeze-note">Staff note (required)</Label>
          <Textarea
            id="freeze-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened and why it needs an immediate freeze"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" onClick={() => setOpen(false)}>
            Keep account active
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!ready || pending}
            onClick={() => {
              onConfirm(note.trim());
              setOpen(false);
              setNote("");
            }}
          >
            Freeze &amp; Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
