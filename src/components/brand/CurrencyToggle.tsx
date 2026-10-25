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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDisplayCurrency } from "@/features/currency/display-currency-context";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CurrencyToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { currency, setCurrency } = useDisplayCurrency();

  return (
    <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
      <SelectTrigger
        aria-label={t("currency.switcher_label")}
        className={cnToggleTrigger(className)}
      >
        <span className="flex items-center gap-2">
          <Banknote className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function cnToggleTrigger(className?: string) {
  return cn(
    "h-10 min-h-10 w-auto gap-2 rounded-full border-0 bg-transparent px-3 text-[15px] font-medium text-[color:var(--ink)] hover:border-transparent hover:bg-[color:var(--foreground)]/[0.06]",
    className,
  );
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
