import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Play,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SocialLinks, type SocialUrls } from "@/components/business/social-links";

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
  introVideoUrl: string | null;
  socials: SocialUrls;
  courseCount: number;
  memberSince: string;
};

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
        <div className="relative z-10 -mt-11">
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
          <SocialLinks className="mt-2.5" urls={data.socials} />
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
        {data.introVideoUrl ? (
          <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
            <img
              src={data.introVideoUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white">
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              </span>
            </span>
          </div>
        ) : null}
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

export function ProfilePreview({ data }: { data: ProfilePreviewData }) {
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
