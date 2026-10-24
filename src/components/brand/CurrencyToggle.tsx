// Issue #114, display-currency switcher. Two shapes of the same control:
// CurrencyToggle is the compact select for the mobile menu row (mirrors
// LanguageToggle), CurrencyMenuSub is the desktop account-dropdown submenu.
// Azure stays on money CTAs only (Scarcity Rule), the switcher itself is a
// neutral ghost control.
import { useTranslation } from "react-i18next";
import { Banknote } from "lucide-react";

import {
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useDisplayCurrency } from "@/features/currency/display-currency-context";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/money";

export function CurrencyToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { currency, setCurrency } = useDisplayCurrency();

  return (
    <label className={cnToggleLabel(className)} aria-label={t("currency.switcher_label")}>
      <Banknote className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
        className="cursor-pointer appearance-none bg-transparent text-[15px] font-medium text-[color:var(--ink)] outline-none"
      >
        {SUPPORTED_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}

function cnToggleLabel(className?: string) {
  return [
    "flex h-10 items-center gap-2 rounded-full px-3 font-medium text-[color:var(--ink)]",
    "transition-colors hover:bg-[color:var(--foreground)]/[0.06]",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function CurrencyMenuSub() {
  const { t } = useTranslation();
  const { currency, setCurrency } = useDisplayCurrency();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="text-[15px] font-medium text-[color:var(--ink)]">
        <span className="flex items-center gap-2.5">
          <Banknote className="size-5" strokeWidth={2.5} aria-hidden="true" />
          {t("currency.switcher_label")}
        </span>
        <span className="ml-auto text-xs font-medium text-[color:var(--ink)]/55">{currency}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
          <DropdownMenuRadioGroup
            value={currency}
            onValueChange={(value) => setCurrency(value as CurrencyCode)}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <DropdownMenuRadioItem key={code} value={code}>
                {code}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
