import { toast } from "sonner";

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

// Native share sheet when available, clipboard fallback otherwise.
// User-cancelled shares (AbortError) are silently ignored.
export async function shareOrCopy(
  payload: SharePayload,
  copiedMessage = "Link copied",
): Promise<void> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(payload.url);
    toast.success(copiedMessage);
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(payload.url);
      toast.success(copiedMessage);
    } catch {
      toast.error("Couldn't share this profile");
    }
  }
}
