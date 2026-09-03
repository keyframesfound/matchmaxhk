import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Smartphone,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type PreviewDevice = "desktop" | "mobile";

export type ProfilePreviewData = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  district: string;
  logoUrl: string | null;
  coverUrl: string | null;
  websiteUrl: string;
  contactEmail: string;
  whatsappNumber: string;
  courseCount: number;
  memberSince: string;
};

export function DeviceToggle({
  device,
  onChange,
}: {
  device: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-muted/60 p-0.5">
      {(
        [
          { value: "desktop", icon: Monitor, label: "Desktop" },
          { value: "mobile", icon: Smartphone, label: "Mobile" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={device === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-semibold transition-colors",
            device === option.value
              ? "bg-card text-[color:var(--ink)] shadow-sm"
              : "text-muted-foreground hover:text-[color:var(--ink)]",
          )}
        >
          <option.icon className="h-3.5 w-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function buildWhatsAppUrl(number: string): string {
  const digits = number.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
}

function PreviewButton({
  variant,
  icon,
  children,
}: {
  variant: "primary" | "outline" | "ghost";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 cursor-default select-none items-center rounded-md px-3.5 text-sm font-bold",
        variant === "primary" && "bg-[color:var(--surface-invert)] text-white",
        variant === "outline" && "border border-border bg-card text-[color:var(--ink)]",
        variant === "ghost" && "text-[color:var(--ink)]",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function PreviewBody({ data }: { data: ProfilePreviewData }) {
  const initials = data.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  const whatsappUrl = buildWhatsAppUrl(data.whatsappNumber);
  const hasContactButtons = !!(whatsappUrl || data.contactEmail || data.websiteUrl);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header card */}
      <div className="relative h-36 w-full">
        {data.coverUrl ? (
          <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#1FA8B6] via-[#2bbfcc] to-[#77E8EE]" />
        )}
      </div>
      <div className="px-5 pb-6">
        <div className="-mt-11">
          {data.logoUrl ? (
            <img
              src={data.logoUrl}
              alt=""
              className="h-20 w-20 rounded-full border-4 border-card object-cover shadow-md"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-[#1FA8B6] text-xl font-bold text-white shadow-md">
              {initials || "MM"}
            </span>
          )}
        </div>

        <div className="mt-3">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-black tracking-tight text-[color:var(--ink)]">
            {data.name || <span className="text-muted-foreground/60">Your business name</span>}
            <BadgeCheck
              className="h-5 w-5 shrink-0 text-[#1FA8B6]"
              aria-label="Verified business"
            />
          </h1>
          {data.tagline ? (
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">{data.tagline}</p>
          ) : (
            <p className="mt-1.5 text-sm italic text-muted-foreground/60">
              Add a tagline to introduce your business
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            {data.district ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {data.district}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {data.courseCount} {data.courseCount === 1 ? "course" : "courses"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Member since {data.memberSince}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {whatsappUrl ? (
            <PreviewButton variant="primary" icon={<MessageCircle className="mr-2 h-4 w-4" />}>
              WhatsApp
            </PreviewButton>
          ) : null}
          {data.contactEmail ? (
            <PreviewButton variant="outline" icon={<Mail className="mr-2 h-4 w-4" />}>
              Email
            </PreviewButton>
          ) : null}
          {data.websiteUrl ? (
            <PreviewButton variant="ghost" icon={<Globe className="mr-2 h-4 w-4" />}>
              Website
            </PreviewButton>
          ) : null}
          {!hasContactButtons && (
            <p className="text-xs italic text-muted-foreground/60">
              WhatsApp, Email and Website buttons will appear here once you add contact details.
            </p>
          )}
        </div>
      </div>

      {/* About */}
      <div className="border-t border-border px-5 py-5">
        <h2 className="text-base font-black tracking-tight text-[color:var(--ink)]">About</h2>
        {data.description ? (
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {data.description
              .split(/\n{2,}/)
              .slice(0, 3)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>
        ) : (
          <p className="mt-2 text-sm italic text-muted-foreground/60">
            Tell customers about your business — this shows on your public page.
          </p>
        )}
      </div>
    </div>
  );
}

export function ProfilePreview({
  data,
  device,
}: {
  data: ProfilePreviewData;
  device: PreviewDevice;
}) {
  if (device === "mobile") {
    return (
      <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-[2.25rem] border-8 border-zinc-900 bg-card shadow-xl dark:border-zinc-700">
        <div className="flex h-6 items-center justify-center bg-zinc-900 dark:bg-zinc-700">
          <span className="h-1.5 w-16 rounded-full bg-white/30" />
        </div>
        <div className="p-3">
          <PreviewBody data={data} />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/60 shadow-sm">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
          matchmax.hk/business/{data.slug}
        </span>
      </div>
      <div className="p-4">
        <PreviewBody data={data} />
      </div>
    </div>
  );
}
