// Cloudflare Turnstile widget API, loaded explicitly by forms that need bot
// protection (tutor application intake). Declared globally so any consumer
// types `window.turnstile` the same way.
interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: (errorCode?: string) => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export {};
