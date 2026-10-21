import { toast } from "sonner";

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

// navigator.clipboard only exists in secure contexts and can still reject
// (permission denied, headless browsers) — fall back to the legacy
// document.execCommand("copy") path through a temporary textarea.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

// Native share sheet when available, clipboard fallback otherwise (issue
// #417: the fallback copies title + URL — never a WhatsApp deep link or a
// pre-filled request intent; that path stays on the Request CTA).
// User-cancelled shares (AbortError) are silently ignored.
export async function shareOrCopy(
  payload: SharePayload,
  copiedMessage = "Link copied",
  errorMessage = "Couldn't share this profile",
): Promise<void> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share(payload);
      return;
    }
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") return;
  }
  const copied = await copyText(`${payload.title}\n${payload.url}`.trim());
  if (copied) {
    toast.success(copiedMessage);
  } else {
    toast.error(errorMessage);
  }
}
