# New session - 2026-09-19T12:02:38.204Z

**Session ID:** ses_f4673f403ffeQ9vZ9JFDYKIYGq
**Created:** 9/19/2026, 8:02:38 PM
**Updated:** 9/19/2026, 9:47:07 PM

---

## User

On desktop the top nav bar and the search bar is separated by a divider, so make the top nav area and the bottom search area in the same group and  put the div line below the search bar instead and for the entire top area use grey like airbnb#FEFEFE

---

## Assistant (Plan · GLM-5.3-Flash · 6.3s)

**Tool: grep**

**Input:**
```json
{
  "include": "*.tsx",
  "path": "src",
  "pattern": "search"
}
```

**Output:**
```
Found 100 matches (more matches available)
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.users.tsx:
  Line 58:   const [search, setSearch] = useState("");

  Line 114:     const q = search.trim().toLowerCase();

  Line 145:   }, [rows, search, roleFilter, sortBy]);

  Line 212:   const hasActiveFilters = search.trim() !== "" || roleFilter !== "all" || sortBy !== "newest";

  Line 289:                     value={search}

  Line 293:                   {search && (


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.index.tsx:
  Line 11: import { CoursesSearch } from "@/components/search/courses-search";

  Line 17: const searchSchema = z.object({

  Line 26:   ), // transient: opens the mobile search overlay when hopping tabs

  Line 28: type SearchState = z.infer<typeof searchSchema>;

  Line 34:   validateSearch: (s) => searchSchema.parse(s),

  Line 53:   const search = Route.useSearch();

  Line 55:   const [draft, setDraft] = useState<SearchState>(search);

  Line 58:     setDraft(search);

  Line 59:   }, [search]);

  Line 73:     queryKey: ["courses", "published", search],

  Line 74:     queryFn: () => fetchPublishedCourses(search),

  Line 93:     navigate({ search: {} as SearchState });

  Line 97:   const hasActiveFilters = Object.values(search).some(Boolean);

  Line 104:     navigate({ search: { ...draft, ...override } });

  Line 128:               defaultOverlayOpen={search.open === true}

  Line 167:                     ? "Try broadening your search or clear the filters to browse all published courses."


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx:
  Line 10: import { TutorsSearch } from "@/components/search/tutors-search";

  Line 164:       search={{ category }}

  Line 188:           <Link to="/tutors" search={{ category }}>

  Line 372:     navigate({ to: "/tutors", search: params });


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/auth.tsx:
  Line 56:     search: Record<string, unknown>,

  Line 59:       typeof search.redirect === "string" &&

  Line 60:       search.redirect.startsWith("/") &&

  Line 61:       !search.redirect.startsWith("//")

  Line 62:         ? search.redirect

  Line 65:       typeof search.save === "string" && SAVE_PATTERN.test(search.save) ? search.save : undefined;

  Line 67:       ...(search.mode === "sign_up" ? { mode: "sign_up" as const } : {}),

  Line 224:     void navigate({ to: "/auth", search: (prev) => ({ ...prev, mode: next }), replace: true });


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.business.settings.tsx:
  Line 5:     throw redirect({ to: "/business", search: { tab: "profile" } });


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.join-requests.tsx:
  Line 51:   validateSearch: (search: Record<string, unknown>) => ({

  Line 53:       typeof search.application === "string" && search.application.trim()

  Line 54:         ? search.application.trim()

  Line 125:   const search = Route.useSearch();

  Line 127:   const [searchText, setSearchText] = useState("");

  Line 128:   const [detailId, setDetailId] = useState<string | null>(search.application ?? null);

  Line 142:     if (search.application) setDetailId(search.application);

  Line 143:   }, [search.application]);

  Line 180:     navigate({ to: "/admin/join-requests", search: { application: undefined } });

  Line 185:     navigate({ to: "/admin/join-requests", search: { application: id } });

  Line 198:     const q = searchText.trim().toLowerCase();

  Line 208:   }, [applications, tab, searchText]);

  Line 235:             search: { create: true, applicationId: row.id },

  Line 346:             value={searchText}

  Line 380:               title={searchText ? "No matching applications" : "You're all caught up"}

  Line 382:                 searchText

  Line 383:                   ? "Try adjusting your search."


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.settings.tsx:
  Line 11: import { SearchableSelect } from "@/components/ui/searchable-select";

  Line 238:                   searchPlaceholder="Search tutors…"

  Line 294:                       searchPlaceholder="Search subjects…"

  Line 384:                     searchPlaceholder="Search subjects…"


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tos.tsx:
  Line 510:           "interfere with or manipulate Platform records, verification processes, search results or matching processes;",

  Line 532:           "improperly manipulate search results, matching processes, verification records or other Platform information.",


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/__root.tsx:
  Line 139:             target: "https://matchmax.hk/tutors?q={search_term_string}",

  Line 140:             "query-input": "required name=search_term_string",


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.business.join.tsx:
  Line 13: import { SearchableSelect } from "@/components/ui/searchable-select";

  Line 40:   const search = Route.useSearch();

  Line 74:       navigate({ to: "/business", search: { tab: undefined } });

  Line 90:               {search.plan === "enterprise" ? "Enterprise plan selected" : "Business account"}

  Line 149:                   searchPlaceholder="Search district..."


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.tutors.tsx:
  Line 20: import { SearchableSelect } from "@/components/ui/searchable-select";

  Line 60:   validateSearch: (search: Record<string, unknown>) => ({

  Line 61:     create: search.create === "1" ? true : undefined,

  Line 63:       typeof search.applicationId === "string" && search.applicationId.trim()

  Line 64:         ? search.applicationId.trim()

  Line 82:   const [search, setSearch] = useState("");

  Line 114:         search: { create: undefined, applicationId: undefined },

  Line 146:     search.trim() !== "" ||

  Line 163:     const q = search.trim().toLowerCase();

  Line 217:     search,

  Line 444:                     value={search}

  Line 488:                   searchPlaceholder="Search subject..."

  Line 499:                   searchPlaceholder="Search district..."

  Line 624:                         ) : !search ? (

  Line 806:               will remove them from search, bookings, and public pages.

  Line 828:               remove this tutor from search, bookings, and public pages.


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutor-requests.index.tsx:
  Line 23: import { CasesSearch, type CasesSearchState } from "@/components/search/cases-search";

  Line 35:     search: Record<string, unknown>,

  Line 39:     if (search.post === "1" || search.post === true || search.post === "true") result.post = true;

  Line 40:     if (typeof search.q === "string" && search.q.trim()) result.q = search.q;

  Line 41:     if (typeof search.category === "string" && search.category.trim())

  Line 42:       result.category = search.category;

  Line 43:     if (typeof search.district === "string" && search.district.trim())

  Line 44:       result.district = search.district;

  Line 45:     if (search.open === "1" || search.open === "true" || search.open === true) result.open = true;

  Line 176:   const search = Route.useSearch();

  Line 178:   const initialPost = search.post;

  Line 180:     q: search.q,

  Line 181:     category: search.category,

  Line 182:     district: search.district,

  Line 189:     setDraft({ q: search.q, category: search.category, district: search.district });

  Line 190:   }, [search]);

  Line 199:       search: {

  Line 210:     navigate({ search: { post: initialPost } });

  Line 229:     const query = (search.q ?? "").trim().toLowerCase();


(Results truncated. Consider using a more specific path or pattern.)
```

---

## Assistant (Plan · GLM-5.3-Flash · 4.1s)

**Tool: glob**

**Input:**
```json
{
  "pattern": "src/components/**/*.tsx"
}
```

**Output:**
```
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/base/toggle/toggle.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-pill-bar.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/courses-search.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/cases-search.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-controls.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-trigger.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/tutors-search.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/filters-dialog.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-overlay.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/social-links.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/course-calendar.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/back-to-top.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/youtube-player.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/empty-state.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/profile-preview.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/business/business-layout.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/BackToTopButton.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PublicPage.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/page-back-button.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/console-shell.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PageSkeleton.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/mobile-bottom-nav.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/WhatsAppFloatButton.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PageContainer.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/AnnouncementBanner.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteFooter.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PageIntro.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/brand/Logo.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/brand/LanguageToggle.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/carousel.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/form.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/context-menu.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/skeleton.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/input.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/textarea.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/select.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/dropdown-menu.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/blur-highlight-text.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/collapsible.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/checkbox.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/toggle.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/button.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/separator.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/table.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/StarRating.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/sidebar.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/badge.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/dialog.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/password-strength.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/tag-input.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/mtr-station-select.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/menubar.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/avatar.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/toggle-group.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/searchable-select.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/command.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/radio-group.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/breadcrumb.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/calendar.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/switch.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/hero-08.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/console-table.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/chart.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/input-otp.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/console-panel.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/progress.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/popover.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/slider.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/card.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/tabs.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/pagination.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/rich-text-editor.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/alert-dialog.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/accordion-05.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/aspect-ratio.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/label.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/resizable.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/scroll-area.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/empty-state.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/markdown-text.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/sheet.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/hover-card.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/accordion.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/navigation-menu.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/sonner.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/tooltip.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/drawer.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/alert.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/ui/hero-08-utils/cta.tsx
```

---

## Assistant (Plan · GLM-5.3-Flash · 2.1s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx</path>
<type>file</type>
<content>
1: import { Link, useRouterState } from "@tanstack/react-router";
2: import {
3:   Bookmark,
4:   BookOpen,
5:   Building2,
6:   ChevronsUpDown,
7:   LogOut,
8:   Moon,
9:   Settings,
10:   ShieldCheck,
11:   Sun,
12:   UserRound,
13: } from "lucide-react";
14: import { useTranslation } from "react-i18next";
15: 
16: import { LanguageToggle } from "@/components/brand/LanguageToggle";
17: import { Logo } from "@/components/brand/Logo";
18: import { Button } from "@/components/ui/button";
19: import {
20:   DropdownMenu,
21:   DropdownMenuContent,
22:   DropdownMenuItem,
23:   DropdownMenuLabel,
24:   DropdownMenuSeparator,
25:   DropdownMenuTrigger,
26: } from "@/components/ui/dropdown-menu";
27: import { useAuth } from "@/features/auth/useAuth";
28: import { useMyOrganization } from "@/features/business/useMyOrganization";
29: import { useTheme } from "@/features/theme/ThemeProvider";
30: import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
31: import { cn } from "@/lib/utils";
32: 
33: import { AnnouncementBanner } from "./AnnouncementBanner";
34: import { MobileBottomNav } from "./mobile-bottom-nav";
35: 
36: type NavDestination =
37:   | "/how-it-works"
38:   | "/tutors"
39:   | "/courses"
40:   | "/saved-posts"
41:   | "/join"
42:   | "/pricing"
43:   | "/tutor-requests";
44: 
45: /** Compact top-bar link for desktop — retained for the lg+ navigation row. */
46: function DesktopNavLink({
47:   to,
48:   active,
49:   children,
50: }: {
51:   to: NavDestination;
52:   active: boolean;
53:   children: React.ReactNode;
54: }) {
55:   return (
56:     <Link
57:       to={to}
58:       aria-current={active ? "page" : undefined}
59:       className={cn(
60:         "group relative text-[15px] font-semibold transition-colors duration-200 focus-visible:text-[color:var(--brand-link)]",
61:         active
62:           ? "text-[color:var(--brand-link)]"
63:           : "text-[color:var(--ink)]/85 hover:text-[color:var(--brand-link)]",
64:       )}
65:     >
66:       {children}
67:       <span
68:         className={cn(
69:           "absolute -bottom-2 left-0 h-[2px] rounded-full bg-[color:var(--foreground)] transition-all duration-200",
70:           active ? "w-full" : "w-0 group-hover:w-full",
71:         )}
72:       />
73:     </Link>
74:   );
75: }
76: 
77: export function SiteHeader({
78:   className,
79:   tone = "light",
80: }: {
81:   className?: string;
82:   tone?: "light" | "dark";
83: }) {
84:   const { t } = useTranslation();
85:   const { user, signOut, hasAnyRole } = useAuth();
86:   const { membership } = useMyOrganization();
87:   const hasOrg = !!membership;
88:   const { theme, setTheme } = useTheme();
89:   const isAdmin = hasAnyRole(["admin", "super_admin"]);
90:   const pathname = useRouterState({ select: (state) => state.location.pathname });
91:   const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
92:   const accountName =
93:     user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Account";
94:   const accountInitial = accountName.charAt(0).toUpperCase();
95:   const useDarkTheme = theme !== "dark";
96:   const brandLabelClassName = "text-lg font-bold tracking-tight text-brand-gradient sm:text-xl";
97: 
98:   // Mobile has no top bar at all — navigation lives in the bottom tab bar and
99:   // the quick-nav pills under each search trigger. The fixed bottom nav must
100:   // render outside the hidden header so it stays visible.
101:   return (
102:     <>
103:       <header
104:         className={cn(
105:           "sticky top-0 z-50 hidden w-full border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm lg:block",
106:           tone === "dark" && "site-header--dark",
107:           className,
108:         )}
109:       >
110:         <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-2 px-4 sm:px-8 lg:gap-0 lg:px-10">
111:           <Link to="/" className="flex shrink-0 items-center" aria-label="MatchMax home">
112:             <div className="flex items-center gap-2">
113:               <Logo className="shrink-0" />
114:               <span className={brandLabelClassName}>MatchMax</span>
115:             </div>
116:           </Link>
117: 
118:           <nav className="ml-12 flex items-center gap-9">
119:             <DesktopNavLink to="/how-it-works" active={isActive("/how-it-works")}>
120:               {t("nav.how")}
121:             </DesktopNavLink>
122:             <DesktopNavLink to="/tutors" active={isActive("/tutors")}>
123:               {t("nav.find")}
124:             </DesktopNavLink>
125:             {CENTRE_MARKET_ENABLED && (
126:               <DesktopNavLink to="/courses" active={isActive("/courses")}>
127:                 {t("nav.courses")}
128:               </DesktopNavLink>
129:             )}
130:             <DesktopNavLink to="/saved-posts" active={isActive("/saved-posts")}>
131:               {t("nav.saved_posts")}
132:             </DesktopNavLink>
133:             <DesktopNavLink to="/join" active={isActive("/join")}>
134:               {t("nav.become_tutor")}
135:             </DesktopNavLink>
136:             {CENTRE_MARKET_ENABLED && (
137:               <DesktopNavLink to="/pricing" active={isActive("/pricing")}>
138:                 {t("nav.for_business")}
139:               </DesktopNavLink>
140:             )}
141:             <DesktopNavLink to="/tutor-requests" active={isActive("/tutor-requests")}>
142:               {t("nav.request_tutor")}
143:             </DesktopNavLink>
144:           </nav>
145: 
146:           <div className="ml-auto flex items-center gap-2 sm:gap-4">
147:             <div className="flex items-center">
148:               <LanguageToggle />
149:             </div>
150:             {user ? (
151:               <div>
152:                 <DropdownMenu modal={false}>
153:                   <DropdownMenuTrigger asChild>
154:                     <Button
155:                       variant="ghost"
156:                       className="relative h-auto w-60 justify-start gap-3 rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-2 text-left text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--ink)]"
157:                     >
158:                       <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--foreground)] text-[color:var(--background)] text-sm font-bold">
159:                         {accountInitial}
160:                       </span>
161:                       <span className="min-w-0 flex-1">
162:                         <span className="block truncate text-sm font-semibold leading-5">
163:                           {accountName}
164:                         </span>
165:                         <span className="block truncate text-xs font-normal leading-4 text-[color:var(--ink)]/55">
166:                           {user.email}
167:                         </span>
168:                       </span>
169:                       <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--ink)]/45">
170:                         <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
171:                       </span>
172:                     </Button>
173:                   </DropdownMenuTrigger>
174:                   <DropdownMenuContent
175:                     align="end"
176:                     className="w-60 overflow-hidden rounded-lg border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0"
177:                   >
178:                     <DropdownMenuLabel className="border-b border-[color:var(--ink)]/10 px-4 py-3">
179:                       <div className="text-sm font-semibold text-[color:var(--ink)]">
180:                         {t("nav.account_title")}
181:                       </div>
182:                       <div className="mt-0.5 text-xs font-normal text-[color:var(--ink)]/60">
183:                         {t("nav.account_subtitle")}
184:                       </div>
185:                     </DropdownMenuLabel>
186:                     <div className="p-1.5">
187:                       <DropdownMenuItem
188:                         asChild
189:                         className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
190:                       >
191:                         <Link to="/dashboard" hash="profile">
192:                           <UserRound aria-hidden="true" />
193:                           {t("nav.profile")}
194:                         </Link>
195:                       </DropdownMenuItem>
196:                       <DropdownMenuItem
197:                         asChild
198:                         className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
199:                       >
200:                         <Link to="/dashboard">
201:                           <Settings aria-hidden="true" />
202:                           {t("nav.settings")}
203:                         </Link>
204:                       </DropdownMenuItem>
205:                       <DropdownMenuItem
206:                         asChild
207:                         className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
208:                       >
209:                         <Link to="/saved-posts">
210:                           <Bookmark aria-hidden="true" />
211:                           {t("nav.saved_posts")}
212:                         </Link>
213:                       </DropdownMenuItem>
214:                       {(CENTRE_MARKET_ENABLED || hasOrg) && (
215:                         <DropdownMenuItem
216:                           asChild
217:                           className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
218:                         >
219:                           <Link to={hasOrg ? "/business" : "/business/join"}>
220:                             <Building2 aria-hidden="true" />
221:                             {hasOrg ? t("nav.my_business") : t("nav.for_business")}
222:                           </Link>
223:                         </DropdownMenuItem>
224:                       )}
225:                       <DropdownMenuItem
226:                         onSelect={() => setTheme(useDarkTheme ? "dark" : "light")}
227:                         className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
228:                       >
229:                         {useDarkTheme ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
230:                         {useDarkTheme ? t("nav.dark_mode") : t("nav.light_mode")}
231:                       </DropdownMenuItem>
232:                       {isAdmin && (
233:                         <>
234:                           <DropdownMenuSeparator className="my-1.5" />
235:                           <DropdownMenuItem
236:                             asChild
237:                             className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
238:                           >
239:                             <Link to="/admin">
240:                               <ShieldCheck aria-hidden="true" />
241:                               {t("nav.admin")}
242:                             </Link>
243:                           </DropdownMenuItem>
244:                         </>
245:                       )}
246:                       <DropdownMenuSeparator className="my-1.5" />
247:                       <DropdownMenuItem
248:                         onSelect={() => void signOut()}
249:                         className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--destructive)]/10 focus:text-[color:var(--destructive)]"
250:                       >
251:                         <LogOut aria-hidden="true" />
252:                         {t("nav.sign_out")}
253:                       </DropdownMenuItem>
254:                     </div>
255:                     <div className="flex items-center justify-between border-t border-[color:var(--ink)]/10 px-4 py-2.5 text-xs text-[color:var(--ink)]/50">
256:                       <span>MatchMax</span>
257:                       <span>{t("nav.account_menu_label")}</span>
258:                     </div>
259:                   </DropdownMenuContent>
260:                 </DropdownMenu>
261:               </div>
262:             ) : (
263:               <>
264:                 <Link
265:                   to="/auth"
266:                   className="text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:text-[color:var(--brand-link)]"
267:                 >
268:                   {t("nav.sign_in")}
269:                 </Link>
270:                 <Link to="/auth" search={{ mode: "sign_up" }}>
271:                   <Button
272:                     variant="solid"
273:                     color="blue"
274:                     className="h-11 rounded-full px-6 text-[15px] font-semibold transition-all duration-200"
275:                   >
276:                     {t("nav.sign_up")}
277:                   </Button>
278:                 </Link>
279:               </>
280:             )}
281:           </div>
282:         </div>
283:         <AnnouncementBanner />
284:       </header>
285:       <MobileBottomNav />
286:     </>
287:   );
288: }

(End of file - total 288 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 28.9s)

_Thinking:_

Now let me look at the search components. The user says on desktop the top nav bar and the search bar are separated by a divider. Let me look at the search pill bar and how it's used on the tutors page.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-pill-bar.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-pill-bar.tsx</path>
<type>file</type>
<content>
1: import { Search } from "lucide-react";
2: import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
3: import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
4: import { useTranslation } from "react-i18next";
5: 
6: import { cn } from "@/lib/utils";
7: import { Button } from "@/components/ui/button";
8: import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
9: import { SearchBigInput, SearchableOptionsPanel, type OptionRow } from "./search-controls";
10: 
11: /** Airbnb-style spring used when the active-pill wash slides between segments. */
12: const HIGHLIGHT_SPRING = { type: "spring", bounce: 0.15, duration: 0.5 } as const;
13: 
14: /** Button box relative to the pill bar (the form is the buttons' offsetParent). */
15: function readButtonRect(button: HTMLButtonElement) {
16:   return {
17:     x: button.offsetLeft,
18:     y: button.offsetTop,
19:     width: button.offsetWidth,
20:     height: button.offsetHeight,
21:   };
22: }
23: 
24: export type PillSegment = {
25:   id: string;
26:   /** Small bold label above the value ("Where", "Who"…). */
27:   label: string;
28:   /** Big panel heading; omitted panels open straight into content. */
29:   title?: string;
30:   /** Value shown in the bar; muted when not filled. */
31:   display: string;
32:   filled?: boolean;
33:   /** Tailwind flex sizing class; defaults to flex-1. */
34:   grow?: string;
35:   panelClassName?: string;
36:   /** Current selection (drives the check mark in options panels). */
37:   currentValue?: string;
38:   /** Simple selectable list panel. */
39:   options?: OptionRow[];
40:   searchPlaceholder?: string;
41:   emptyText?: string;
42:   showAnyOption?: boolean;
43:   onSelect?: (value: string) => void;
44:   /** Custom panel content; overrides options. */
45:   content?: ReactNode;
46: };
47: 
48: type SearchPillBarProps = {
49:   segments: PillSegment[];
50:   submitLabel: string;
51:   submitColor?: "neutral" | "blue";
52:   onSubmit: () => void;
53:   className?: string;
54:   /** Controlled open segment id; when provided the bar becomes fully controlled. */
55:   openSegmentId?: string | null;
56:   onOpenSegmentIdChange?: (id: string | null) => void;
57: };
58: 
59: /**
60:  * Desktop Airbnb-style segmented search pill. Each segment opens a popover
61:  * panel; the circular azure button submits. Flat by design — hairline borders
62:  * and hover washes instead of shadows.
63:  */
64: export function SearchPillBar({
65:   segments,
66:   submitLabel,
67:   submitColor = "neutral",
68:   onSubmit,
69:   className,
70:   openSegmentId,
71:   onOpenSegmentIdChange,
72: }: SearchPillBarProps) {
73:   const { t } = useTranslation();
74:   const [internalOpenId, setInternalOpenId] = useState<string | null>(null);
75:   const openId = openSegmentId !== undefined ? openSegmentId : internalOpenId;
76:   const setOpenId = (id: string | null) => {
77:     setInternalOpenId(id);
78:     onOpenSegmentIdChange?.(id);
79:   };
80:   const prefersReducedMotion = useReducedMotion();
81:   const formRef = useRef<HTMLFormElement>(null);
82:   const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
83:   const highlightX = useMotionValue(0);
84:   const highlightY = useMotionValue(0);
85:   const highlightWidth = useMotionValue(0);
86:   const highlightHeight = useMotionValue(0);
87:   const highlightOpacity = useMotionValue(0);
88:   const hasHighlight = useRef(false);
89: 
90:   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
91:     event.preventDefault();
92:     onSubmit();
93:     setOpenId(null);
94:   };
95: 
96:   /**
97:    * Drives the shared highlight: fades in on first open, spring-slides to the
98:    * newly opened segment on pill-to-pill switches, fades out on close while
99:    * keeping its last position so the next open starts from a clean fade.
100:    */
101:   useEffect(() => {
102:     const button = openId ? buttonRefs.current.get(openId) : undefined;
103:     if (!openId || !button) {
104:       hasHighlight.current = false;
105:       animate(highlightOpacity, 0, { duration: 0.2 });
106:       return;
107:     }
108:     const rect = readButtonRect(button);
109:     const snap = !hasHighlight.current || prefersReducedMotion === true;
110:     hasHighlight.current = true;
111:     if (snap) {
112:       highlightX.set(rect.x);
113:       highlightY.set(rect.y);
114:       highlightWidth.set(rect.width);
115:       highlightHeight.set(rect.height);
116:     } else {
117:       animate(highlightX, rect.x, HIGHLIGHT_SPRING);
118:       animate(highlightY, rect.y, HIGHLIGHT_SPRING);
119:       animate(highlightWidth, rect.width, HIGHLIGHT_SPRING);
120:       animate(highlightHeight, rect.height, HIGHLIGHT_SPRING);
121:     }
122:     animate(highlightOpacity, 1, { duration: 0.2 });
123:   }, [
124:     openId,
125:     prefersReducedMotion,
126:     highlightX,
127:     highlightY,
128:     highlightWidth,
129:     highlightHeight,
130:     highlightOpacity,
131:   ]);
132: 
133:   /** Keep the highlight glued to the open segment across resizes/reflows. */
134:   useEffect(() => {
135:     const form = formRef.current;
136:     const button = openId ? buttonRefs.current.get(openId) : undefined;
137:     if (!form || !button) return;
138:     const sync = () => {
139:       const rect = readButtonRect(button);
140:       highlightX.set(rect.x);
141:       highlightY.set(rect.y);
142:       highlightWidth.set(rect.width);
143:       highlightHeight.set(rect.height);
144:     };
145:     const observer = new ResizeObserver(sync);
146:     observer.observe(form);
147:     observer.observe(button);
148:     return () => observer.disconnect();
149:   }, [openId, highlightX, highlightY, highlightWidth, highlightHeight]);
150: 
151:   return (
152:     <form
153:       ref={formRef}
154:       onSubmit={handleSubmit}
155:       className={cn(
156:         "relative flex items-center gap-1 rounded-full border border-border bg-card p-1.5",
157:         className,
158:       )}
159:     >
160:       <motion.div
161:         aria-hidden="true"
162:         className="pointer-events-none absolute left-0 top-0 rounded-full bg-[color:var(--foreground)]/[0.06]"
163:         style={{
164:           x: highlightX,
165:           y: highlightY,
166:           width: highlightWidth,
167:           height: highlightHeight,
168:           opacity: highlightOpacity,
169:         }}
170:       />
171:       {segments.map((segment, index) => {
172:         const adjacentActive = openId === segment.id || openId === segments[index - 1]?.id;
173:         return (
174:           <Popover
175:             key={segment.id}
176:             open={openId === segment.id}
177:             onOpenChange={(open) => setOpenId(open ? segment.id : null)}
178:           >
179:             <PopoverTrigger asChild>
180:               <button
181:                 ref={(node) => {
182:                   if (node) buttonRefs.current.set(segment.id, node);
183:                   else buttonRefs.current.delete(segment.id);
184:                 }}
185:                 type="button"
186:                 aria-expanded={openId === segment.id}
187:                 className={cn(
188:                   "relative flex min-w-0 flex-col justify-center gap-0.5 rounded-full px-4 py-1.5 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5",
189:                   index > 0 &&
190:                     (adjacentActive ? "border-l border-transparent" : "border-l border-border"),
191:                   segment.grow ?? "flex-1",
192:                 )}
193:               >
194:                 <span className="truncate text-[11px] font-bold tracking-wide text-[color:var(--ink)]">
195:                   {segment.label}
196:                 </span>
197:                 <span
198:                   className={cn(
199:                     "truncate text-sm",
200:                     segment.filled
201:                       ? "font-semibold text-[color:var(--ink)]"
202:                       : "text-muted-foreground",
203:                   )}
204:                 >
205:                   {segment.display}
206:                 </span>
207:               </button>
208:             </PopoverTrigger>
209:             <PopoverContent
210:               align="start"
211:               sideOffset={10}
212:               className={cn(
213:                 "z-[9999] w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4",
214:                 segment.panelClassName,
215:               )}
216:             >
217:               {segment.title ? (
218:                 <p className="mb-3 text-xl font-bold tracking-tight text-[color:var(--ink)]">
219:                   {segment.title}
220:                 </p>
221:               ) : null}
222:               {segment.content ?? (
223:                 <SearchableOptionsPanel
224:                   options={segment.options ?? []}
225:                   currentValue={segment.currentValue}
226:                   onSelect={(value) => {
227:                     segment.onSelect?.(value);
228:                     setOpenId(null);
229:                   }}
230:                   searchPlaceholder={segment.searchPlaceholder}
231:                   emptyText={segment.emptyText}
232:                   showAnyOption={segment.showAnyOption ?? true}
233:                   anyLabel={t("search_ui.any_value")}
234:                 />
235:               )}
236:             </PopoverContent>
237:           </Popover>
238:         );
239:       })}
240:       <Button
241:         type="submit"
242:         variant="solid"
243:         color={submitColor}
244:         shape="pill"
245:         aria-label={submitLabel}
246:         className="ml-1 h-11 w-11 shrink-0 rounded-full p-0"
247:       >
248:         <Search className="h-4 w-4" aria-hidden="true" />
249:       </Button>
250:     </form>
251:   );
252: }
253: 
254: /** Keyword segment panel: big input bound to the live draft query. */
255: export function KeywordPanelContent({
256:   value,
257:   onValueChange,
258:   placeholder,
259:   ariaLabel,
260: }: {
261:   value: string;
262:   onValueChange: (value: string) => void;
263:   placeholder: string;
264:   ariaLabel?: string;
265: }) {
266:   return (
267:     <SearchBigInput
268:       autoFocus
269:       value={value}
270:       onValueChange={onValueChange}
271:       placeholder={placeholder}
272:       ariaLabel={ariaLabel}
273:     />
274:   );
275: }

(End of file - total 275 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 6.8s)

_Thinking:_

Now let me look at where the header and search bar are used together — probably in `tutors.index.tsx` route or `index.tsx`. Let me check the tutors page to see where the search pill bar is placed relative to the header, and where the "divider" between them is.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutors.index.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutors.index.tsx</path>
<type>file</type>
<content>
1: import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
2: import { useEffect, useMemo, useState } from "react";
3: import { useQuery } from "@tanstack/react-query";
4: import { useTranslation } from "react-i18next";
5: import { z } from "zod";
6: import { SearchX } from "lucide-react";
7: import { SiteHeader } from "@/components/layout/SiteHeader";
8: import { SiteFooter } from "@/components/layout/SiteFooter";
9: import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
10: import { Button } from "@/components/ui/button";
11: import { Skeleton } from "@/components/ui/skeleton";
12: import { TutorsSearch } from "@/components/search/tutors-search";
13: import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
14: import { TutorSaveButton } from "@/features/tutors/saved-tutors";
15: import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
16: import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
17: import {
18:   fetchPublishedTutors,
19:   getTutorCardHighlights,
20:   matchesLessonModeFilter,
21:   matchesStationFilter,
22:   type Tutor,
23: } from "@/features/tutors/queries";
24: import { matchesCategoryFilter, matchesSubjectQuery } from "@/features/tutors/subjects";
25: import { supabase } from "@/integrations/supabase/client";
26: 
27: const searchSchema = z.object({
28:   category: z.string().optional(),
29:   subject: z.string().optional(),
30:   station: z.string().optional(), // nearest MTR station to the student
31:   mode: z.string().optional(), // online | in_person | either
32:   gender: z.string().optional(), // male | female | other
33:   status: z.string().optional(), // uni_student | full_part_time_tutor | examiner
34:   min_price: z.coerce.number().int().min(0).optional(),
35:   max_price: z.coerce.number().int().min(0).optional(),
36:   sort: z.string().optional(), // "" | price_asc | price_desc
37:   q: z.string().optional(),
38:   open: z.preprocess(
39:     (value) => (value === "1" || value === "true" || value === true ? true : undefined),
40:     z.boolean().optional(),
41:   ), // transient: opens the mobile search overlay when hopping tabs
42: });
43: type SearchState = z.infer<typeof searchSchema>;
44: 
45: export const Route = createFileRoute("/tutors/")({
46:   validateSearch: (s) => searchSchema.parse(s),
47:   head: () => ({
48:     meta: [
49:       { title: "Find Verified Tutors in Hong Kong | MatchMax" },
50:       {
51:         name: "description",
52:         content:
53:           "Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
54:       },
55:       { name: "robots", content: "index, follow" },
56:       { property: "og:title", content: "Find Verified Tutors in Hong Kong | MatchMax" },
57:       {
58:         property: "og:description",
59:         content:
60:           "Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
61:       },
62:       { property: "og:url", content: "https://matchmax.hk/tutors" },
63:     ],
64:     links: [{ rel: "canonical", href: "https://matchmax.hk/tutors" }],
65:   }),
66:   component: TutorsDirectory,
67: });
68: 
69: function TutorsDirectory() {
70:   const { t } = useTranslation();
71:   const search = Route.useSearch();
72:   const navigate = useNavigate({ from: "/tutors/" });
73:   const [draft, setDraft] = useState<SearchState>(search);
74: 
75:   useEffect(() => {
76:     setDraft(search);
77:   }, [search]);
78: 
79:   const setDraftParam = (patch: Partial<SearchState>) => {
80:     setDraft((prev) => {
81:       const next: SearchState = { ...prev, ...patch };
82:       (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
83:         const v = next[k];
84:         if (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v)))
85:           delete next[k];
86:       });
87:       return next;
88:     });
89:   };
90: 
91:   const { data: tutors = [], isLoading } = useQuery({
92:     queryKey: ["tutors", "published"],
93:     queryFn: fetchPublishedTutors,
94:   });
95: 
96:   const { data: whatsappNumber = "" } = useQuery({
97:     queryKey: ["settings", "whatsapp_number"],
98:     queryFn: async () => {
99:       const { data, error } = await supabase
100:         .from("app_settings")
101:         .select("value")
102:         .eq("key", "whatsapp_number")
103:         .maybeSingle();
104:       if (error) throw error;
105:       const value = data?.value;
106:       return typeof value === "string" ? value : "";
107:     },
108:   });
109: 
110:   const categoryFilter = (draft.category ?? "").toLowerCase();
111: 
112:   const subjectFilter = (draft.subject ?? "").toLowerCase();
113:   const stationFilter = draft.station ?? "";
114:   const modeFilter = draft.mode ?? "";
115:   const genderFilter = draft.gender ?? "";
116:   const statusFilter = draft.status ?? "";
117:   const effectiveStationFilter = modeFilter === "in_person" ? stationFilter : "";
118: 
119:   const filtered = useMemo(() => {
120:     const query = (draft.q ?? "").trim().toLowerCase();
121:     const sort = draft.sort ?? "";
122: 
123:     const list = tutors.filter((tut) => {
124:       if (
125:         categoryFilter &&
126:         !matchesCategoryFilter(categoryFilter, tut.subjects, [
127:           ...tut.target_students,
128:           ...getTutorCardHighlights(tut),
129:         ])
130:       )
131:         return false;
132:       if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
133:         return false;
134:       if (draft.min_price !== undefined && tut.hourly_rate < draft.min_price) return false;
135:       if (draft.max_price !== undefined && tut.hourly_rate > draft.max_price) return false;
136:       if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
137:       if (!matchesStationFilter(effectiveStationFilter, tut.stations)) return false;
138:       if (genderFilter) {
139:         const g = (tut as unknown as { gender?: string | null }).gender ?? "";
140:         if (g !== genderFilter) return false;
141:       }
142:       if (statusFilter && (tut.tutor_status ?? "") !== statusFilter) return false;
143:       if (
144:         query &&
145:         !(
146:           tut.tutor_code.toLowerCase().includes(query) ||
147:           tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||
148:           getTutorCardHighlights(tut).some((highlight) => highlight.toLowerCase().includes(query))
149:         )
150:       )
151:         return false;
152:       return true;
153:     });
154: 
155:     return [...list].sort((a, b) => {
156:       if (sort === "price_asc")
157:         return a.hourly_rate - b.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
158:       if (sort === "price_desc")
159:         return b.hourly_rate - a.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
160:       return (
161:         (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
162:         a.hourly_rate - b.hourly_rate ||
163:         a.tutor_code.localeCompare(b.tutor_code)
164:       );
165:     });
166:   }, [
167:     tutors,
168:     categoryFilter,
169:     subjectFilter,
170:     effectiveStationFilter,
171:     modeFilter,
172:     genderFilter,
173:     statusFilter,
174:     draft.q,
175:     draft.min_price,
176:     draft.max_price,
177:     draft.sort,
178:   ]);
179: 
180:   const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
181:     useTutorCompare(tutors);
182: 
183:   const clearAll = () => {
184:     setDraft({});
185:     navigate({ search: {} as SearchState });
186:   };
187: 
188:   const openTutorDetail = (tutorCode: string) => {
189:     navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
190:   };
191: 
192:   const hotlineUrl = buildTutorWhatsAppUrl(whatsappNumber, "");
193: 
194:   const applySearch = (override?: Partial<SearchState>) => {
195:     const next = { ...draft, ...override };
196:     navigate({
197:       search: {
198:         ...next,
199:         station: next.mode === "in_person" ? next.station : undefined,
200:       },
201:     });
202:   };
203: 
204:   return (
205:     <div className="flex min-h-screen flex-col bg-background">
206:       <SiteHeader />
207:       <main className="flex-1">
208:         <section className="border-b border-border py-10 sm:py-12">
209:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
210:             <h1 className="text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
211:               Find verified tutors
212:             </h1>
213:             <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
214:               Start with a subject or tutor code, then narrow the list to the right fit.
215:             </p>
216:             <TutorsSearch
217:               className="mt-7"
218:               draft={draft}
219:               onDraftChange={setDraftParam}
220:               onApply={applySearch}
221:               onClear={clearAll}
222:               resultCount={filtered.length}
223:               allPrices={tutors.map((tutor) => tutor.hourly_rate)}
224:               defaultOverlayOpen={search.open === true}
225:               whatsappUrl={hotlineUrl || undefined}
226:             />
227:           </div>
228:         </section>
229:         <section className="py-12">
230:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
231:             <div className="mb-6 flex items-baseline justify-between">
232:               {isLoading ? (
233:                 <Skeleton className="h-4 w-28" />
234:               ) : (
235:                 <p className="text-sm text-muted-foreground">
236:                   <span className="font-bold text-foreground">{filtered.length}</span>{" "}
237:                   {filtered.length === 1 ? "tutor" : "tutors"} found
238:                 </p>
239:               )}
240:             </div>
241: 
242:             {isLoading && (
243:               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
244:                 {Array.from({ length: 6 }).map((_, i) => (
245:                   <Skeleton key={i} className="h-[23rem] rounded-[10px] border border-border" />
246:                 ))}
247:               </div>
248:             )}
249: 
250:             {!isLoading && filtered.length === 0 && (
251:               <div className="rounded-sm border border-border bg-card p-8 text-center sm:p-12">
252:                 <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]">
253:                   <SearchX
254:                     className="h-5 w-5 text-[color:var(--muted-foreground)]"
255:                     aria-hidden="true"
256:                   />
257:                 </div>
258:                 <h2 className="mt-4 text-xl font-bold tracking-tight text-[color:var(--ink)] sm:text-2xl">
259:                   {t("directory.empty_title")}
260:                 </h2>
261:                 <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
262:                   {t("directory.empty_desc")}
263:                 </p>
264:                 <div className="mt-6 flex flex-wrap justify-center gap-3">
265:                   <Button variant="outline" onClick={clearAll}>
266:                     {t("directory.empty_clear")}
267:                   </Button>
268:                   {hotlineUrl ? (
269:                     <Button asChild variant="ghost">
270:                       <a href={hotlineUrl} target="_blank" rel="noreferrer">
271:                         <WhatsAppIcon
272:                           className="mr-2 h-4 w-4 text-[color:var(--muted-foreground)]"
273:                           aria-hidden="true"
274:                         />
275:                         {t("directory.empty_whatsapp")}
276:                       </a>
277:                     </Button>
278:                   ) : null}
279:                   <Button asChild variant="solid" color="blue" className="font-bold">
280:                     <Link to="/tutor-requests" search={{ post: true }}>
281:                       {t("directory.empty_case")}
282:                     </Link>
283:                   </Button>
284:                 </div>
285:               </div>
286:             )}
287: 
288:             {!isLoading && filtered.length > 0 && (
289:               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
290:                 {filtered.map((tut: Tutor) => (
291:                   <PublicTutorCard
292:                     key={tut.id}
293:                     tutor={tut}
294:                     priceSuffix={t("featured.per_hour")}
295:                     onOpen={openTutorDetail}
296:                     onCompareToggle={() => toggleCompare(tut)}
297:                     compareSelected={compareIds.includes(tut.id)}
298:                     footerAction={
299:                       <>
300:                         <TutorSaveButton tutorId={tut.id} compact />
301:                         <Button
302:                           asChild
303:                           className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
304:                         >
305:                           <a
306:                             href={buildTutorWhatsAppUrl(whatsappNumber, tut.tutor_code)}
307:                             target="_blank"
308:                             rel="noreferrer"
309:                             onClick={(event) => event.stopPropagation()}
310:                           >
311:                             Request tutor
312:                           </a>
313:                         </Button>
314:                       </>
315:                     }
316:                   />
317:                 ))}
318:               </div>
319:             )}
320:           </div>
321:         </section>
322:       </main>
323:       <SiteFooter />
324:       {compareTutors.length > 0 && !compareOpen ? (
325:         <CompareBar
326:           selectedTutors={compareTutors}
327:           onOpenCompare={() => setCompareOpen(true)}
328:           onClear={clearCompare}
329:         />
330:       ) : null}
331:       <CompareDialog
332:         open={compareOpen}
333:         onOpenChange={setCompareOpen}
334:         tutors={compareTutors}
335:         whatsappNumber={whatsappNumber}
336:       />
337:     </div>
338:   );
339: }

(End of file - total 339 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 34.6s)

_Thinking:_

Now let me understand the current structure:

1. `SiteHeader` — sticky top nav bar with `border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95`. This is the divider between the top nav and the content below (which contains the search bar).
2. Below that: a `<section className="border-b border-border py-10 sm:py-12">` containing the `TutorsSearch` (search pill bar).

The user wants:
- On desktop, the top nav bar and the search bar should be in the same "group" (same visual group/surface)
- The divider line should be BELOW the search bar instead of between them
- The entire top area (nav + search) should use grey like Airbnb #FEFEFE

Wait, #FEFEFE is nearly white... "grey like airbnb#FEFEFE" — Airbnb's header background is actually `#FFFFFF` with the search area being... Hmm. Actually Airbnb's homepage header has the nav on white, and the search bar sits on the same surface. Actually Airbnb's header background is `#FFFFFF`, but the user says #FEFEFE which is essentially white but slightly off. Let me check what `--surface` is in the theme.

Let me check the theme CSS variables to understand `--surface` etc.

Also, the user's request is on the tutors page presumably. But maybe also courses page. Let me check where TutorsSearch and CoursesSearch are used, and check the tutors-search component to see the sticky behavior.

Let me also check `tutors-search.tsx` and `courses-search.tsx`.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/tutors-search.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/tutors-search.tsx</path>
<type>file</type>
<content>
1: import {
2:   BadgeCheck,
3:   BookOpen,
4:   Briefcase,
5:   ClipboardList,
6:   Coins,
7:   GraduationCap,
8:   MapPin,
9:   Monitor,
10:   UserRound,
11:   Users,
12: } from "lucide-react";
13: import { useNavigate } from "@tanstack/react-router";
14: import { useMemo, useState } from "react";
15: import { useTranslation } from "react-i18next";
16: 
17: import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
18: import {
19:   PanelLabel,
20:   SearchBigInput,
21:   Segmented,
22:   SuggestedRow,
23:   type OptionRow,
24: } from "./search-controls";
25: import {
26:   FilterQuickPicks,
27:   FiltersDialog,
28:   FiltersPillButton,
29:   FiltersSection,
30: } from "./filters-dialog";
31: import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
32: import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
33: import { setSearchSlideDirection } from "./slide-direction";
34: import { MobileSearchTrigger } from "./mobile-search-trigger";
35: import { MtrStationPickerContent } from "@/components/ui/mtr-station-select";
36: import { SearchableSelect } from "@/components/ui/searchable-select";
37: import { Slider } from "@/components/ui/slider";
38: import { Input } from "@/components/ui/input";
39: import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
40: import { DEFAULT_SUBJECT_OPTIONS, getSubjectOptionsForCategory } from "@/features/tutors/subjects";
41: import { cn } from "@/lib/utils";
42: 
43: export type TutorsSearchState = {
44:   category?: string;
45:   subject?: string;
46:   station?: string;
47:   mode?: string;
48:   gender?: string;
49:   status?: string;
50:   min_price?: number;
51:   max_price?: number;
52:   sort?: string;
53:   q?: string;
54: };
55: 
56: const PRICE_MIN = 100;
57: const PRICE_MAX = 1200;
58: const PRICE_STEP = 10;
59: const HISTOGRAM_BUCKETS = 28;
60: 
61: const CATEGORY_VALUES = ["IB", "DSE", "IGCSE", "AP", "A-Level"];
62: 
63: const formatPrice = (price: number) =>
64:   price === PRICE_MAX ? `HK$${price.toLocaleString()}+` : `HK$${price.toLocaleString()}`;
65: 
66: type TutorsSearchProps = {
67:   draft: TutorsSearchState;
68:   onDraftChange: (patch: Partial<TutorsSearchState>) => void;
69:   /** Apply the current draft (navigate). `override` merges values set in the same event. */
70:   onApply: (override?: Partial<TutorsSearchState>) => void;
71:   onClear: () => void;
72:   /** Live count for the "Show N tutors" button; omit for a plain "Search tutors" label. */
73:   resultCount?: number;
74:   /** All published tutors' hourly rates — powers the price histogram. */
75:   allPrices?: number[];
76:   /** Open the mobile overlay on mount (used when hopping between search tabs). */
77:   defaultOverlayOpen?: boolean;
78:   whatsappUrl?: string;
79:   className?: string;
80: };
81: 
82: export function TutorsSearch({
83:   draft,
84:   onDraftChange,
85:   onApply,
86:   onClear,
87:   resultCount,
88:   allPrices,
89:   defaultOverlayOpen,
90:   whatsappUrl,
91:   className,
92: }: TutorsSearchProps) {
93:   const { t } = useTranslation();
94:   const navigate = useNavigate();
95:   const [filtersOpen, setFiltersOpen] = useState(false);
96:   const [pillOpenId, setPillOpenId] = useState<string | null>(null);
97:   const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));
98: 
99:   const subjectOptions = getSubjectOptionsForCategory(draft.category);
100:   const suggestedSubjects = subjectOptions.length > 0 ? subjectOptions : DEFAULT_SUBJECT_OPTIONS;
101: 
102:   const handleCategorySelect = (category: string) => {
103:     const nextSubjects = getSubjectOptionsForCategory(category);
104:     onDraftChange({
105:       category: category || undefined,
106:       ...(draft.subject && !nextSubjects.includes(draft.subject) ? { subject: undefined } : {}),
107:     });
108:   };
109: 
110:   const handleModeChange = (next: { mode: string; station?: string }) => {
111:     onDraftChange({
112:       mode: next.mode || undefined,
113:       station: next.mode === "in_person" ? next.station : undefined,
114:     });
115:   };
116: 
117:   const priceValue = useMemo(
118:     () => [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX] as [number, number],
119:     [draft.min_price, draft.max_price],
120:   );
121: 
122:   const priceHistogram = useMemo(() => {
123:     if (!allPrices || allPrices.length === 0) return null;
124:     const span = PRICE_MAX - PRICE_MIN;
125:     const buckets = new Array<number>(HISTOGRAM_BUCKETS).fill(0);
126:     for (const price of allPrices) {
127:       const clamped = Math.min(Math.max(price, PRICE_MIN), PRICE_MAX);
128:       const index = Math.min(
129:         HISTOGRAM_BUCKETS - 1,
130:         Math.floor(((clamped - PRICE_MIN) / span) * HISTOGRAM_BUCKETS),
131:       );
132:       buckets[index] += 1;
133:     }
134:     const peak = Math.max(...buckets, 1);
135:     return buckets.map((count, index) => ({
136:       level: count / peak,
137:       inRange:
138:         (index + 0.5) / HISTOGRAM_BUCKETS >= (priceValue[0] - PRICE_MIN) / span &&
139:         (index + 0.5) / HISTOGRAM_BUCKETS <= (priceValue[1] - PRICE_MIN) / span,
140:     }));
141:     // priceValue is derived from draft; histogram re-tints when the range moves.
142:   }, [allPrices, priceValue]);
143: 
144:   const filterCount = [
145:     draft.gender,
146:     draft.status,
147:     draft.min_price !== undefined ? "price" : "",
148:     draft.max_price !== undefined ? "price" : "",
149:     draft.sort,
150:   ].filter(Boolean).length;
151: 
152:   const categoryLabel = (value: string) => {
153:     if (value === "Primary") return t("search_panel.category_primary_school");
154:     if (value === "Junior Secondary") return t("search_panel.category_junior_secondary");
155:     if (value === "Admissions") return t("search_panel.category_admissions");
156:     return value;
157:   };
158: 
159:   const categoryOptions: OptionRow[] = [
160:     ...CATEGORY_VALUES.map((value) => ({ value, label: value })),
161:     { value: "Primary", label: t("search_panel.category_primary_school") },
162:     { value: "Junior Secondary", label: t("search_panel.category_junior_secondary") },
163:     { value: "Admissions", label: t("search_panel.category_admissions") },
164:   ];
165: 
166:   const statusOptions = [
167:     { value: "", label: t("search_panel.any_status") },
168:     { value: "uni_student", label: t("search_panel.status_uni_student") },
169:     { value: "full_part_time_tutor", label: t("search_panel.status_full_part_time") },
170:     { value: "examiner", label: t("search_panel.status_examiner") },
171:   ];
172: 
173:   const sortOptions = [
174:     { value: "", label: t("search_panel.sort_recommended") },
175:     { value: "price_asc", label: t("search_panel.sort_price_asc") },
176:     { value: "price_desc", label: t("search_panel.sort_price_desc") },
177:   ];
178: 
179:   const genderOptions = [
180:     { value: "", label: t("search_ui.gender_any") },
181:     { value: "female", label: t("search_panel.gender_female") },
182:     { value: "male", label: t("search_panel.gender_male") },
183:   ];
184: 
185:   const modeDisplay = (() => {
186:     if (draft.mode === "in_person") {
187:       return draft.station
188:         ? `${t("search_panel.mode_in_person")} · ${draft.station}`
189:         : t("search_panel.mode_in_person");
190:     }
191:     if (draft.mode === "online") return t("search_panel.mode_online");
192:     return t("search_ui.any_value");
193:   })();
194: 
195:   const applyLabel =
196:     resultCount === undefined
197:       ? t("search_ui.search_tutors")
198:       : t("search_ui.show_tutors", { count: resultCount });
199: 
200:   const quickPicks = [
201:     {
202:       id: "uni",
203:       label: t("search_ui.pick_uni"),
204:       icon: GraduationCap,
205:       active: draft.status === "uni_student",
206:       onToggle: () =>
207:         onDraftChange({ status: draft.status === "uni_student" ? undefined : "uni_student" }),
208:     },
209:     {
210:       id: "examiner",
211:       label: t("search_ui.pick_examiner"),
212:       icon: BadgeCheck,
213:       active: draft.status === "examiner",
214:       onToggle: () =>
215:         onDraftChange({ status: draft.status === "examiner" ? undefined : "examiner" }),
216:     },
217:     {
218:       id: "fullpart",
219:       label: t("search_ui.pick_full_part"),
220:       icon: Briefcase,
221:       active: draft.status === "full_part_time_tutor",
222:       onToggle: () =>
223:         onDraftChange({
224:           status: draft.status === "full_part_time_tutor" ? undefined : "full_part_time_tutor",
225:         }),
226:     },
227:     {
228:       id: "female",
229:       label: t("search_ui.pick_female"),
230:       icon: UserRound,
231:       active: draft.gender === "female",
232:       onToggle: () => onDraftChange({ gender: draft.gender === "female" ? undefined : "female" }),
233:     },
234:     {
235:       id: "male",
236:       label: t("search_ui.pick_male"),
237:       icon: Users,
238:       active: draft.gender === "male",
239:       onToggle: () => onDraftChange({ gender: draft.gender === "male" ? undefined : "male" }),
240:     },
241:     {
242:       id: "budget",
243:       label: t("search_ui.pick_budget"),
244:       icon: Coins,
245:       active: draft.max_price === 300,
246:       onToggle: () => onDraftChange({ max_price: draft.max_price === 300 ? undefined : 300 }),
247:     },
248:     {
249:       id: "online",
250:       label: t("search_ui.pick_online"),
251:       icon: Monitor,
252:       active: draft.mode === "online",
253:       onToggle: () => onDraftChange({ mode: draft.mode === "online" ? undefined : "online" }),
254:     },
255:     {
256:       id: "inperson",
257:       label: t("search_ui.pick_in_person"),
258:       icon: MapPin,
259:       active: draft.mode === "in_person",
260:       onToggle: () => onDraftChange({ mode: draft.mode === "in_person" ? undefined : "in_person" }),
261:     },
262:   ];
263: 
264:   const segments: PillSegment[] = [
265:     {
266:       id: "keyword",
267:       label: t("search_ui.segment_keyword"),
268:       title: t("search_ui.panel_keyword_title"),
269:       display: draft.q?.trim() ? draft.q : t("search_panel.keyword_placeholder"),
270:       filled: Boolean(draft.q?.trim()),
271:       grow: "flex-[1.3]",
272:       content: (
273:         <KeywordPanelContent
274:           value={draft.q ?? ""}
275:           onValueChange={(q) => onDraftChange({ q: q || undefined })}
276:           placeholder={t("search_panel.keyword_placeholder")}
277:           ariaLabel={t("search_panel.keyword_aria")}
278:         />
279:       ),
280:     },
281:     {
282:       id: "category",
283:       label: t("search_ui.segment_curriculum"),
284:       display: draft.category ? categoryLabel(draft.category) : t("search_ui.any_value"),
285:       filled: Boolean(draft.category),
286:       options: categoryOptions,
287:       currentValue: draft.category,
288:       searchPlaceholder: t("search_panel.search_category"),
289:       emptyText: t("search_panel.no_matches"),
290:       onSelect: handleCategorySelect,
291:     },
292:     {
293:       id: "subject",
294:       label: t("search_ui.segment_subject"),
295:       display: draft.subject ?? t("search_ui.any_value"),
296:       filled: Boolean(draft.subject),
297:       options: subjectOptions.map((subject) => ({ value: subject, label: subject })),
298:       currentValue: draft.subject,
299:       searchPlaceholder: t("search_panel.search_subject"),
300:       emptyText: t("search_panel.no_matches"),
301:       onSelect: (value) => onDraftChange({ subject: value || undefined }),
302:     },
303:     {
304:       id: "mode",
305:       label: t("search_ui.segment_mode"),
306:       display: modeDisplay,
307:       filled: Boolean(draft.mode),
308:       panelClassName: "w-[min(22rem,calc(100vw-2rem))]",
309:       content: (
310:         <ModePanelContent
311:           mode={draft.mode ?? ""}
312:           station={draft.station}
313:           onChange={handleModeChange}
314:         />
315:       ),
316:     },
317:   ];
318: 
319:   const overlayTabs: MobileSearchTab[] = [
320:     {
321:       id: "tutors",
322:       label: t("search_ui.tab_tutors"),
323:       icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
324:       active: true,
325:       onSelect: () => {},
326:     },
327:     ...(CENTRE_MARKET_ENABLED
328:       ? [
329:           {
330:             id: "courses",
331:             label: t("search_ui.tab_courses"),
332:             icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
333:             active: false,
334:             onSelect: () => {
335:               setSearchSlideDirection("next");
336:               void navigate({
337:                 to: "/courses",
338:                 search: { q: draft.q, subject: draft.subject, mode: draft.mode, open: true },
339:               });
340:             },
341:           },
342:         ]
343:       : []),
344:     {
345:       id: "cases",
346:       label: t("search_ui.tab_cases"),
347:       icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
348:       active: false,
349:       onSelect: () => {
350:         setSearchSlideDirection("next");
351:         void navigate({ to: "/tutor-requests", search: { q: draft.q, open: true } });
352:       },
353:     },
354:   ];
355: 
356:   return (
357:     <div className={className}>
358:       <div className="hidden items-stretch gap-2 lg:flex">
359:         <SearchPillBar
360:           segments={segments}
361:           submitLabel={t("search_panel.search")}
362:           submitColor="blue"
363:           onSubmit={() => onApply()}
364:           className="min-w-0 flex-1"
365:           openSegmentId={pillOpenId}
366:           onOpenSegmentIdChange={setPillOpenId}
367:         />
368:         <FiltersPillButton
369:           label={t("search_ui.filters")}
370:           count={filterCount || undefined}
371:           onClick={() => {
372:             setPillOpenId(null);
373:             setFiltersOpen(true);
374:           }}
375:         />
376:       </div>
377: 
378:       <FiltersDialog
379:         open={filtersOpen}
380:         onOpenChange={setFiltersOpen}
381:         clearLabel={t("search_ui.clear_all")}
382:         applyLabel={applyLabel}
383:         onClear={onClear}
384:         onApply={() => onApply()}
385:         footerExtra={
386:           whatsappUrl ? (
387:             <a
388:               href={whatsappUrl}
389:               target="_blank"
390:               rel="noreferrer"
391:               className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[color:var(--brand-whatsapp-hover)]"
392:             >
393:               <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
394:               {t("directory.empty_whatsapp")}
395:             </a>
396:           ) : undefined
397:         }
398:       >
399:         <FiltersSection id="recommended" title={t("search_ui.quick_title")}>
400:           <FilterQuickPicks options={quickPicks} />
401:         </FiltersSection>
402:         <FiltersSection
403:           id="price"
404:           title={t("search_panel.price_range")}
405:           hint={t("search_ui.price_hint")}
406:         >
407:           <PriceFields
408:             priceValue={priceValue}
409:             histogram={priceHistogram}
410:             onDraftChange={onDraftChange}
411:           />
412:         </FiltersSection>
413:         <FiltersSection id="gender" title={t("search_ui.gender_title")}>
414:           <Segmented
415:             aria-label={t("search_panel.any_gender")}
416:             value={draft.gender ?? ""}
417:             onChange={(gender) => onDraftChange({ gender: gender || undefined })}
418:             options={genderOptions}
419:             className="max-w-xs"
420:           />
421:         </FiltersSection>
422:         <FiltersSection id="status" title={t("search_ui.status_title")}>
423:           <SearchableSelect
424:             value={draft.status ?? ""}
425:             onChange={(value) => onDraftChange({ status: value || undefined })}
426:             options={statusOptions}
427:             placeholder={t("search_panel.any_status")}
428:             className="h-11 rounded-xl"
429:           />
430:         </FiltersSection>
431:         <FiltersSection id="sort" title={t("search_ui.sort_title")}>
432:           <SearchableSelect
433:             value={draft.sort ?? ""}
434:             onChange={(value) => onDraftChange({ sort: value || undefined })}
435:             options={sortOptions}
436:             placeholder={t("search_panel.sort_recommended")}
437:             searchPlaceholder={t("search_panel.search_sorting")}
438:             className="h-11 rounded-xl"
439:           />
440:         </FiltersSection>
441:       </FiltersDialog>
442: 
443:       <MobileSearchTrigger
444:         label={t("search_ui.start_search")}
445:         onClick={() => setOverlayOpen(true)}
446:       />
447: 
448:       <MobileSearchOverlay
449:         open={overlayOpen}
450:         onOpenChange={setOverlayOpen}
451:         tabs={overlayTabs}
452:         clearLabel={t("search_ui.clear_all")}
453:         submitLabel={applyLabel}
454:         onClear={onClear}
455:         onSubmit={() => {
456:           onApply();
457:           setOverlayOpen(false);
458:         }}
459:       >
460:         <div className="space-y-6">
461:           <div>
462:             <p className="mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]">
463:               {t("search_ui.panel_keyword_title")}
464:             </p>
465:             <SearchBigInput
466:               value={draft.q ?? ""}
467:               onValueChange={(q) => onDraftChange({ q: q || undefined })}
468:               onEnter={() => onApply()}
469:               placeholder={t("search_panel.keyword_placeholder")}
470:               ariaLabel={t("search_panel.keyword_aria")}
471:             />
472:           </div>
473: 
474:           <div className="space-y-1.5">
475:             <PanelLabel>{t("search_ui.segment_curriculum")}</PanelLabel>
476:             <SearchableSelect
477:               value={draft.category ?? ""}
478:               onChange={handleCategorySelect}
479:               options={[{ value: "", label: t("search_panel.any_category") }, ...categoryOptions]}
480:               placeholder={t("search_panel.any_category")}
481:               searchPlaceholder={t("search_panel.search_category")}
482:               className="h-12 rounded-2xl"
483:             />
484:           </div>
485: 
486:           <div className="space-y-1">
487:             <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
488:             <div className="-mx-2">
489:               {suggestedSubjects.slice(0, 5).map((subject) => (
490:                 <SuggestedRow
491:                   key={subject}
492:                   title={subject}
493:                   hint={t("search_ui.suggested_hint")}
494:                   onClick={() => {
495:                     onApply({ q: subject });
496:                     setOverlayOpen(false);
497:                   }}
498:                 />
499:               ))}
500:             </div>
501:           </div>
502: 
503:           <div className="space-y-2">
504:             <PanelLabel>{t("search_ui.segment_mode")}</PanelLabel>
505:             <ModePanelContent
506:               mode={draft.mode ?? ""}
507:               station={draft.station}
508:               onChange={handleModeChange}
509:             />
510:           </div>
511: 
512:           <div className="space-y-2">
513:             <PanelLabel>{t("search_ui.gender_title")}</PanelLabel>
514:             <Segmented
515:               aria-label={t("search_panel.any_gender")}
516:               value={draft.gender ?? ""}
517:               onChange={(gender) => onDraftChange({ gender: gender || undefined })}
518:               options={genderOptions}
519:             />
520:           </div>
521: 
522:           <div className="space-y-2">
523:             <PanelLabel>{t("search_ui.status_title")}</PanelLabel>
524:             <SearchableSelect
525:               value={draft.status ?? ""}
526:               onChange={(value) => onDraftChange({ status: value || undefined })}
527:               options={statusOptions}
528:               placeholder={t("search_panel.any_status")}
529:               className="h-12 rounded-2xl"
530:             />
531:           </div>
532: 
533:           <div className="space-y-2.5">
534:             <PanelLabel className="tabular-nums">
535:               {t("search_panel.price_from")} {formatPrice(priceValue[0])}{" "}
536:               {t("search_panel.price_to")} {formatPrice(priceValue[1])}
537:             </PanelLabel>
538:             <PriceFields priceValue={priceValue} onDraftChange={onDraftChange} />
539:           </div>
540: 
541:           <div className="space-y-2">
542:             <PanelLabel>{t("search_ui.sort_title")}</PanelLabel>
543:             <SearchableSelect
544:               value={draft.sort ?? ""}
545:               onChange={(value) => onDraftChange({ sort: value || undefined })}
546:               options={sortOptions}
547:               placeholder={t("search_panel.sort_recommended")}
548:               searchPlaceholder={t("search_panel.search_sorting")}
549:               className="h-12 rounded-2xl"
550:             />
551:           </div>
552:         </div>
553:       </MobileSearchOverlay>
554:     </div>
555:   );
556: }
557: 
558: /** Airbnb-style price range: histogram (optional) + slider + min/max pills. */
559: function PriceFields({
560:   priceValue,
561:   onDraftChange,
562:   histogram,
563: }: {
564:   priceValue: [number, number];
565:   onDraftChange: (patch: Partial<TutorsSearchState>) => void;
566:   histogram?: Array<{ level: number; inRange: boolean }> | null;
567: }) {
568:   const { t } = useTranslation();
569:   const span = PRICE_MAX - PRICE_MIN;
570:   return (
571:     <div className="space-y-3">
572:       {histogram ? (
573:         <div className="flex h-10 items-end gap-px" aria-hidden="true">
574:           {histogram.map((bucket, index) => (
575:             <span
576:               key={index}
577:               className={cn(
578:                 "w-full min-w-px",
579:                 bucket.inRange
580:                   ? "bg-[color:var(--brand-royal)]"
581:                   : "bg-[color:var(--foreground)]/[0.18]",
582:               )}
583:               style={{ height: `${Math.max(10, Math.round(bucket.level * 100))}%` }}
584:             />
585:           ))}
586:         </div>
587:       ) : null}
588:       <Slider
589:         value={priceValue}
590:         onValueChange={([lo, hi]) =>
591:           onDraftChange({
592:             min_price: lo > PRICE_MIN ? lo : undefined,
593:             max_price: hi < PRICE_MAX ? hi : undefined,
594:           })
595:         }
596:         min={PRICE_MIN}
597:         max={PRICE_MAX}
598:         step={PRICE_STEP}
599:         minStepsBetweenThumbs={1}
600:         showTooltip
601:         tooltipContent={formatPrice}
602:         aria-label={t("search_panel.price_range")}
603:       />
604:       <div className="flex items-end justify-between gap-3">
605:         <div className="w-28 space-y-1.5">
606:           <span className="text-xs font-semibold text-[color:var(--ink)]/70">
607:             {t("search_ui.price_min")}
608:           </span>
609:           <Input
610:             type="number"
611:             inputMode="numeric"
612:             min={PRICE_MIN}
613:             max={priceValue[1] - PRICE_STEP}
614:             step={PRICE_STEP}
615:             value={priceValue[0]}
616:             onChange={(event) => {
617:               const raw = Number(event.target.value);
618:               if (!Number.isFinite(raw)) return;
619:               const clamped = Math.min(Math.max(raw, PRICE_MIN), priceValue[1] - PRICE_STEP);
620:               onDraftChange({ min_price: clamped > PRICE_MIN ? clamped : undefined });
621:             }}
622:             aria-label={t("search_ui.price_min")}
623:             className="h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-semibold tabular-nums"
624:           />
625:         </div>
626:         <div className="w-28 space-y-1.5">
627:           <span className="text-xs font-semibold text-[color:var(--ink)]/70">
628:             {t("search_ui.price_max")}
629:           </span>
630:           <Input
631:             type="number"
632:             inputMode="numeric"
633:             min={priceValue[0] + PRICE_STEP}
634:             max={PRICE_MAX}
635:             step={PRICE_STEP}
636:             value={priceValue[1]}
637:             onChange={(event) => {
638:               const raw = Number(event.target.value);
639:               if (!Number.isFinite(raw)) return;
640:               const clamped = Math.min(Math.max(raw, priceValue[0] + PRICE_STEP), PRICE_MAX);
641:               onDraftChange({ max_price: clamped < PRICE_MAX ? clamped : undefined });
642:             }}
643:             aria-label={t("search_ui.price_max")}
644:             className="h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-semibold tabular-nums"
645:           />
646:         </div>
647:       </div>
648:     </div>
649:   );
650: }
651: 
652: function ModePanelContent({
653:   mode,
654:   station,
655:   onChange,
656: }: {
657:   mode: string;
658:   station?: string;
659:   onChange: (next: { mode: string; station?: string }) => void;
660: }) {
661:   const { t } = useTranslation();
662:   return (
663:     <div className="space-y-3">
664:       <Segmented
665:         aria-label={t("search_panel.any_mode")}
666:         value={mode}
667:         onChange={(nextMode) =>
668:           onChange({
669:             mode: nextMode,
670:             station: nextMode === "in_person" ? station : undefined,
671:           })
672:         }
673:         options={[
674:           { value: "", label: t("search_ui.mode_any") },
675:           { value: "online", label: t("search_ui.mode_online") },
676:           { value: "in_person", label: t("search_ui.mode_in_person") },
677:         ]}
678:       />
679:       {mode === "in_person" ? (
680:         <div className="max-h-72 overflow-hidden rounded-2xl border border-border">
681:           <MtrStationPickerContent
682:             value={station}
683:             showAnyOption={false}
684:             onSelect={(nextStation) => onChange({ mode: "in_person", station: nextStation })}
685:             listClassName="max-h-56"
686:           />
687:         </div>
688:       ) : null}
689:     </div>
690:   );
691: }

(End of file - total 691 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 37.8s)

_Thinking:_

Now I understand the structure. Let me also check where else `SiteHeader` is followed by search sections — the courses page and the tutor-requests page, and the homepage `index.tsx`. The user says "On desktop the top nav bar and the search bar is separated by a divider" — that's the `border-b border-[color:var(--ink)]/10` on the header, plus the section below has `border-b border-border`.

Let me check the theme CSS variables to understand what `--surface` is and where I'd add the Airbnb grey #FEFEFE. Let me look at the styles.

**Tool: grep**

**Input:**
```json
{
  "path": "src",
  "pattern": "--surface:"
}
```

**Output:**
```
Found 2 matches
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css:
  Line 168:   --surface: #ffffff;

  Line 207:   --surface: #121212;

```

---

## Assistant (Plan · GLM-5.3-Flash · 7.6s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css",
  "limit": 130,
  "offset": 130
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css</path>
<type>file</type>
<content>
130:   --success-foreground: #ffffff;
131:   --warning: #f7b928;
132:   --warning-foreground: #0f1419;
133:   --border: #e1eaef;
134:   --input: #f7f9fa;
135:   --ring: #1da1f2;
136: 
137:   --chart-1: #1e9df1;
138:   --chart-2: #00b87a;
139:   --chart-3: #f7b928;
140:   --chart-4: #17bf63;
141:   --chart-5: #e0245e;
142: 
143:   --sidebar: #f7f8f8;
144:   --sidebar-foreground: #0f1419;
145:   --sidebar-primary: #1e9df1;
146:   --sidebar-primary-foreground: #ffffff;
147:   --sidebar-accent: #e3ecf6;
148:   --sidebar-accent-foreground: #1e9df1;
149:   --sidebar-border: #e1e8ed;
150:   --sidebar-ring: #1da1f2;
151: 
152:   /* Accent button (money CTAs) — Azure in both themes */
153:   --btn-accent: #1d9bf0;
154:   --btn-accent-fg: #ffffff;
155:   --btn-accent-hover: #1a8cd8;
156: 
157:   /* Neutral solid button — ink in light; goes translucent slate in dark */
158:   --btn-neutral: #0f1419;
159:   --btn-neutral-fg: #ffffff;
160:   --btn-neutral-hover: #272c30;
161: 
162:   /* WhatsApp brand exception */
163:   --brand-whatsapp: #25d366;
164:   --brand-whatsapp-hover: #1ebe57;
165: 
166:   /* Themed app surfaces */
167:   --ink: #0f1419;
168:   --surface: #ffffff;
169:   --surface-subtle: #f7f9fa;
170:   --surface-hover: #eff3f4;
171:   --surface-invert: #0f1419;
172:   --surface-invert-hover: #272c30;
173:   --surface-invert-fg: #ffffff;
174:   --brand-link: #1d9bf0;
175: 
176:   /* Stepper */
177:   --stepper-row-bg: linear-gradient(
178:     135deg,
179:     color-mix(in oklab, var(--brand-teal) 8%, var(--color-card)),
180:     var(--color-card)
181:   );
182:   --stepper-inactive-bg: #eff3f4;
183:   --stepper-inactive-fg: #536471;
184:   --stepper-active-bg: #1d9bf0;
185:   --stepper-active-fg: #ffffff;
186:   --stepper-complete-bg: #17bf63;
187:   --stepper-complete-fg: #ffffff;
188:   --stepper-dot: #ffffff;
189:   --stepper-connector: #1d9bf0;
190: 
191:   /* Gradients */
192:   --gradient-brand: linear-gradient(135deg, #0f1419 0%, #1d9bf0 55%, #8ecdf8 100%);
193:   --gradient-brand-x: linear-gradient(90deg, #0f1419 0%, #1d9bf0 55%, #8ecdf8 100%);
194:   --gradient-brand-soft: linear-gradient(135deg, #f7fafc 0%, #e8f1f9 100%);
195: }
196: 
197: /*
198:  * Dark theme — "Twitter Azure" dim mode (dark-mode-guide compliant).
199:  * Elevation ladder instead of pure black: canvas #121212 · cards #1E1E1E ·
200:  * popovers #232327 · hovers #26282C · borders #2E3033 · secondary text #9BA1A6.
201:  * Statuses are lightened/desaturated for dark (success #4ADE80, warning #FCD34D,
202:  * destructive #F87171) with dark-ink text on fills.
203:  * The azure accent (#1D9BF0) stays the action colour in both themes.
204:  */
205: .dark {
206:   --ink: #e7e9ea;
207:   --surface: #121212;
208:   --surface-subtle: #1a1c1e;
209:   --surface-raised: #232327;
210:   --surface-hover: #26282c;
211:   --surface-invert: #f0f3f4;
212:   --surface-invert-hover: #d9dde0;
213:   --surface-invert-fg: #0f1419;
214:   --brand-link: #1d9bf0;
215:   --subtle-foreground: #9ba1a6;
216:   --disabled-foreground: #8a8e93;
217:   --success: #4ade80;
218:   --success-foreground: #052e16;
219:   --warning: #fcd34d;
220:   --warning-foreground: #291b04;
221: 
222:   /* Stepper */
223:   --stepper-row-bg: linear-gradient(
224:     135deg,
225:     color-mix(in oklab, var(--brand-teal) 8%, var(--color-card)),
226:     var(--color-card)
227:   );
228:   --stepper-inactive-bg: #26282c;
229:   --stepper-inactive-fg: #9ba1a6;
230:   --stepper-active-bg: #1d9bf0;
231:   --stepper-active-fg: #ffffff;
232:   --stepper-complete-bg: #4ade80;
233:   --stepper-complete-fg: #052e16;
234:   --stepper-dot: #121212;
235:   --stepper-connector: #1d9bf0;
236:   --gradient-brand: linear-gradient(135deg, #121212 0%, #0a1e30 55%, #123a5e 100%);
237:   --gradient-brand-x: linear-gradient(90deg, #121212 0%, #0a1e30 55%, #123a5e 100%);
238:   --gradient-brand-soft: linear-gradient(135deg, #121212 0%, #1e1e1e 100%);
239: 
240:   --background: #121212;
241:   --foreground: #e7e9ea;
242:   --card: #1e1e1e;
243:   --card-foreground: #e7e9ea;
244:   --popover: #232327;
245:   --popover-foreground: #e7e9ea;
246:   --primary: #1c9cf0;
247:   --primary-foreground: #ffffff;
248:   --secondary: #f0f3f4;
249:   --secondary-foreground: #0f1419;
250:   --muted: #1e1e1e;
251:   --muted-foreground: #9ba1a6;
252:   --accent: #1e2d37;
253:   --accent-foreground: #1c9cf0;
254:   --destructive: #f87171;
255:   --destructive-foreground: #2b0a0c;
256:   --border: #2e3033;
257:   --input: #22303c;
258:   --ring: #1da1f2;
259:   --chart-1: #1e9df1;

(Showing lines 130-259 of 677. Use offset=260 to continue.)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 131.6s)

_Thinking:_

Now I understand the theme. `--surface` is `#ffffff` in light mode.

The user's request:
1. On desktop, the top nav bar and search bar are separated by a divider (the `border-b` on the SiteHeader). They want the top nav area AND the bottom search area to be in the SAME group (i.e., same visual block/surface, no divider between them).
2. Put the divider line BELOW the search bar instead.
3. The entire top area should use grey like Airbnb `#FEFEFE`.

Wait — #FEFEFE is essentially white (not really grey). Airbnb's header is actually `#FFFFFF` and the search area background is `#FFFFFF`, and the divider is `#DDDDDD`. Hmm, but the user explicitly says "use grey like airbnb#FEFEFE". So they want `#FEFEFE` as the background for the whole top area (header + search section).

Actually wait — maybe they mean Airbnb uses #FEFEFE for its header background. Let me think about what Airbnb actually uses. Airbnb's header background is white `#FFFFFF`. But their site background is `#FFFFFF` too... Actually, I recall Airbnb uses `#F7F7F7` for some background sections. But the user explicitly gives the hex: `#FEFEFE`. So use `#FEFEFE`.

Which pages are affected? The user says "the top nav bar and the search bar". Pages with a search bar below the header:
- `/tutors` (tutors.index.tsx) — TutorsSearch in a section with `border-b border-border py-10 sm:py-12`
- `/courses` (courses.index.tsx) — CoursesSearch
- `/tutor-requests` (tutor-requests.index.tsx) — CasesSearch
- `/` (index.tsx) — homepage has TutorsSearch too

Let me check these pages to see the structure. Let me check courses.index.tsx, tutor-requests.index.tsx, and index.tsx hero sections.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.index.tsx",
  "limit": 80,
  "offset": 100
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.index.tsx</path>
<type>file</type>
<content>
100:     ...(subjects ?? []).map((subject) => ({ value: subject, label: subject })),
101:   ];
102: 
103:   const handleSearch = (override?: Partial<SearchState>) => {
104:     navigate({ search: { ...draft, ...override } });
105:   };
106: 
107:   return (
108:     <div className="flex min-h-screen flex-col bg-background">
109:       <SiteHeader />
110:       <main className="flex-1">
111:         <section className="border-b border-border py-10 sm:py-12">
112:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
113:             <p className="text-sm font-semibold text-[color:var(--brand-link)]">Course directory</p>
114:             <h1 className="mt-2 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
115:               Find the right course
116:             </h1>
117:             <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
118:               Compare structured courses from verified education centres across Hong Kong.
119:             </p>
120: 
121:             <CoursesSearch
122:               className="mt-8"
123:               draft={draft}
124:               onDraftChange={setDraftParam}
125:               onApply={handleSearch}
126:               onClear={clearAll}
127:               subjectOptions={subjects ?? []}
128:               defaultOverlayOpen={search.open === true}
129:             />
130:           </div>
131:         </section>
132: 
133:         <section className="py-12">
134:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
135:             <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
136:               {isLoading ? (
137:                 <Skeleton className="h-4 w-28" />
138:               ) : (
139:                 <p className="text-sm text-muted-foreground">
140:                   <span className="font-bold text-foreground">{results.length}</span>{" "}
141:                   {results.length === 1 ? "course" : "courses"} found
142:                 </p>
143:               )}
144:               {hasActiveFilters ? (
145:                 <Button variant="ghost" size="sm" onClick={clearAll}>
146:                   Clear filters
147:                 </Button>
148:               ) : null}
149:             </div>
150: 
151:             {isLoading && (
152:               <div className="flex flex-col gap-4">
153:                 {Array.from({ length: 5 }).map((_, i) => (
154:                   <Skeleton key={i} className="h-40 rounded-lg border border-border" />
155:                 ))}
156:               </div>
157:             )}
158: 
159:             {!isLoading && results.length === 0 && (
160:               <EmptyState
161:                 icon={Search}
162:                 title={
163:                   hasActiveFilters ? "No courses match these filters" : "No courses available yet"
164:                 }
165:                 description={
166:                   hasActiveFilters
167:                     ? "Try broadening your search or clear the filters to browse all published courses."
168:                     : "New courses from verified education centres will appear here."
169:                 }
170:                 action={
171:                   hasActiveFilters ? (
172:                     <Button variant="outline" onClick={clearAll}>
173:                       Clear filters
174:                     </Button>
175:                   ) : undefined
176:                 }
177:                 secondaryAction={
178:                   <Button asChild variant="ghost" prefix={<Building2 />}>
179:                     <Link to="/pricing">List your courses</Link>

(Showing lines 100-179 of 198. Use offset=180 to continue.)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 30.4s)

_Thinking:_

Same pattern on courses page: `<section className="border-b border-border py-10 sm:py-12">` below the SiteHeader.

Now let me check the homepage (index.tsx) and tutor-requests page structures to see if they also have a search area directly below the header.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx",
  "limit": 120,
  "offset": 140
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx</path>
<type>file</type>
<content>
140:           <>
141:             <TutorSaveButton tutorId={tutor.id} compact />
142:             <Button
143:               asChild
144:               className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs"
145:             >
146:               <a
147:                 href={buildTutorWhatsAppUrl(whatsappNumber, tutor.tutor_code)}
148:                 target="_blank"
149:                 rel="noreferrer"
150:                 onClick={(event) => event.stopPropagation()}
151:               >
152:                 Request tutor
153:               </a>
154:             </Button>
155:           </>
156:         }
157:       />
158:     </div>
159:   );
160: 
161:   const seeAllTile = (className: string) => (
162:     <Link
163:       to="/tutors"
164:       search={{ category }}
165:       className={cn(
166:         "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-subtle)]/40 text-center transition-colors hover:bg-[color:var(--surface-subtle)]",
167:         className,
168:       )}
169:     >
170:       <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
171:         <ArrowRight className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
172:       </span>
173:       <span className="text-sm font-bold text-[color:var(--ink)]">{t("featured.see_all")}</span>
174:     </Link>
175:   );
176: 
177:   return (
178:     <section className="mx-auto max-w-7xl">
179:       <div className="mb-4 flex items-center gap-2 sm:gap-3">
180:         <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
181:           {label} tutors
182:         </h2>
183:         <Button
184:           asChild
185:           variant="ghost"
186:           className="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold text-[color:var(--brand-link)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] sm:h-9 sm:px-3 sm:text-sm"
187:         >
188:           <Link to="/tutors" search={{ category }}>
189:             {t("featured.view_all")}
190:             <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
191:           </Link>
192:         </Button>
193:         {pages.length > 1 ? (
194:           <div className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
195:             <button
196:               type="button"
197:               aria-label={t("featured.prev")}
198:               disabled={currentPage === 0}
199:               onClick={() => goToPage(currentPage - 1)}
200:               className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
201:             >
202:               <ChevronLeft className="h-4 w-4" aria-hidden="true" />
203:             </button>
204:             <button
205:               type="button"
206:               aria-label={t("featured.next")}
207:               disabled={currentPage === pages.length - 1}
208:               onClick={() => goToPage(currentPage + 1)}
209:               className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
210:             >
211:               <ChevronRight className="h-4 w-4" aria-hidden="true" />
212:             </button>
213:           </div>
214:         ) : null}
215:       </div>
216: 
217:       {loading ? (
218:         <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:px-0 lg:grid-cols-3">
219:           {Array.from({ length: TUTORS_PER_PAGE }).map((_, index) => (
220:             <Skeleton
221:               key={index}
222:               className="h-[23rem] w-[min(80vw,380px)] shrink-0 rounded-[var(--radius-panel)] border border-border md:w-auto"
223:             />
224:           ))}
225:         </div>
226:       ) : tutors.length > 0 ? (
227:         <>
228:           {/* Mobile: one swipeable row — first page of tutors, then the see-all tile */}
229:           <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scroll-px-4 md:hidden">
230:             {tutors
231:               .slice(0, TUTORS_PER_PAGE)
232:               .map((tutor) => renderTutorCard(tutor, "w-[min(80vw,380px)] shrink-0 snap-start"))}
233:             {tutors.length > TUTORS_PER_PAGE
234:               ? seeAllTile("min-h-[20rem] w-[min(80vw,380px)] shrink-0 snap-start")
235:               : null}
236:           </div>
237: 
238:           {/* md+: paged sliding track */}
239:           <div className="hidden overflow-hidden pt-1 md:block">
240:             <div
241:               className="flex items-stretch transition-transform duration-300 ease-out motion-reduce:transition-none"
242:               style={{ transform: `translateX(-${currentPage * 100}%)` }}
243:             >
244:               {pages.map((pageTutors, pageIndex) => {
245:                 const isCurrentPage = pageIndex === currentPage;
246:                 const withSeeAllTile = pages.length > 1 && pageIndex === pages.length - 1;
247:                 return (
248:                   <div
249:                     key={pageIndex}
250:                     inert={!isCurrentPage}
251:                     aria-hidden={!isCurrentPage}
252:                     className="grid w-full shrink-0 grid-cols-2 gap-6 lg:grid-cols-3"
253:                   >
254:                     {pageTutors.map((tutor) => renderTutorCard(tutor))}
255:                     {withSeeAllTile ? seeAllTile("min-h-[23rem]") : null}
256:                   </div>
257:                 );
258:               })}
259:             </div>

(Showing lines 140-259 of 468. Use offset=260 to continue.)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 8.9s)

_Thinking:_

The homepage has a different structure (hero + featured sections). Let me look at the beginning of index.tsx to see the hero/search layout.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx",
  "limit": 110,
  "offset": 30
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx</path>
<type>file</type>
<content>
30:   subject?: string;
31:   mode?: string;
32:   station?: string;
33:   gender?: string;
34:   q?: string;
35: };
36: 
37: const CURRICULUM_CATEGORIES = [
38:   { label: "IBDP", value: "IB" },
39:   { label: "DSE", value: "DSE" },
40:   { label: "IGCSE", value: "IGCSE" },
41:   { label: "A Levels", value: "A-Level" },
42:   { label: "Examiner/pro teachers", value: "International" },
43: ];
44: 
45: const TUTORS_PER_PAGE = 3;
46: const MAX_HOME_TUTORS = 6;
47: 
48: export const Route = createFileRoute("/")({
49:   head: () => ({
50:     meta: [
51:       { title: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
52:       {
53:         name: "description",
54:         content:
55:           "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly.",
56:       },
57:       { name: "robots", content: "index, follow" },
58:       {
59:         property: "og:title",
60:         content: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax",
61:       },
62:       {
63:         property: "og:description",
64:         content:
65:           "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly.",
66:       },
67:       { property: "og:url", content: "https://matchmax.hk/" },
68:       { property: "og:type", content: "website" },
69:       { property: "og:site_name", content: "MatchMax" },
70:       { property: "og:locale", content: "en_HK" },
71:       { property: "og:image", content: OG_IMAGE },
72:       { property: "og:image:width", content: "1200" },
73:       { property: "og:image:height", content: "630" },
74:       { name: "twitter:card", content: "summary_large_image" },
75:       { name: "twitter:title", content: "IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
76:       {
77:         name: "twitter:description",
78:         content:
79:           "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
80:       },
81:       { name: "twitter:image", content: OG_IMAGE },
82:     ],
83:     links: [
84:       { rel: "canonical", href: "https://matchmax.hk/" },
85:       { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
86:       { rel: "shortcut icon", href: "/favicon.ico" },
87:       { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
88:       { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
89:       { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
90:       { rel: "manifest", href: "/site.webmanifest" },
91:     ],
92:   }),
93:   component: Landing,
94: });
95: 
96: function CurriculumTutorSection({
97:   label,
98:   category,
99:   tutors,
100:   loading,
101:   priceSuffix,
102:   whatsappNumber,
103:   onOpen,
104:   compareSelectedIds,
105:   onCompareToggle,
106: }: {
107:   label: string;
108:   category: string;
109:   tutors: Tutor[];
110:   loading: boolean;
111:   priceSuffix: string;
112:   whatsappNumber: string;
113:   onOpen: (tutorCode: string) => void;
114:   compareSelectedIds: string[];
115:   onCompareToggle: (tutor: Tutor) => void;
116: }) {
117:   const { t } = useTranslation();
118:   const [page, setPage] = useState(0);
119: 
120:   const pages: Tutor[][] = [];
121:   let visibleTutors = tutors;
122:   if (tutors.length > TUTORS_PER_PAGE && tutors.length % TUTORS_PER_PAGE === 0) {
123:     visibleTutors = tutors.slice(0, tutors.length - 1);
124:   }
125:   for (let i = 0; i < visibleTutors.length; i += TUTORS_PER_PAGE) {
126:     pages.push(visibleTutors.slice(i, i + TUTORS_PER_PAGE));
127:   }
128:   const currentPage = Math.min(page, pages.length - 1);
129:   const goToPage = (next: number) => setPage(Math.max(0, Math.min(pages.length - 1, next)));
130: 
131:   const renderTutorCard = (tutor: Tutor, className?: string) => (
132:     <div key={tutor.id} className={cn("min-w-0", className)}>
133:       <PublicTutorCard
134:         tutor={tutor}
135:         priceSuffix={priceSuffix}
136:         onOpen={onOpen}
137:         compareSelected={compareSelectedIds.includes(tutor.id)}
138:         onCompareToggle={() => onCompareToggle(tutor)}
139:         footerAction={

(Showing lines 30-139 of 468. Use offset=140 to continue.)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 24.4s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx",
  "offset": 260
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/index.tsx</path>
<type>file</type>
<content>
260:           </div>
261:         </>
262:       ) : null}
263:     </section>
264:   );
265: }
266: 
267: function Landing() {
268:   const { t } = useTranslation();
269:   const navigate = useNavigate();
270:   const heroVideoRef = useRef<HTMLVideoElement>(null);
271:   const [homeSearch, setHomeSearch] = useState<HomeTutorSearchState>({});
272: 
273:   useEffect(() => {
274:     const video = heroVideoRef.current;
275:     if (!video) return;
276: 
277:     const tryPlay = () => {
278:       video.muted = true;
279:       video.defaultMuted = true;
280:       void video.play().catch(() => {
281:         // Safari may defer autoplay until the next readiness event.
282:       });
283:     };
284: 
285:     video.addEventListener("loadedmetadata", tryPlay);
286:     video.addEventListener("canplay", tryPlay);
287:     tryPlay();
288: 
289:     return () => {
290:       video.removeEventListener("loadedmetadata", tryPlay);
291:       video.removeEventListener("canplay", tryPlay);
292:     };
293:   }, []);
294: 
295:   const setHomeSearchParam = (patch: Partial<HomeTutorSearchState>) => {
296:     setHomeSearch((prev) => {
297:       const next = { ...prev, ...patch };
298:       (Object.keys(next) as (keyof HomeTutorSearchState)[]).forEach((k) => {
299:         if (!next[k]) delete next[k];
300:       });
301:       return next;
302:     });
303:   };
304: 
305:   // Queries
306:   const { data: featuredTutors = [] } = useQuery({
307:     queryKey: ["landing", "featured_tutors"],
308:     queryFn: () => fetchTopWeeklyTutors(3),
309:   });
310: 
311:   const { data: publishedTutors = [], isLoading: publishedTutorsLoading } = useQuery({
312:     queryKey: ["landing", "published_tutors"],
313:     queryFn: fetchPublishedTutors,
314:   });
315: 
316:   const { data: whatsappNumber = "" } = useQuery({
317:     queryKey: ["settings", "whatsapp_number"],
318:     queryFn: async () => {
319:       const { data, error } = await supabase
320:         .from("app_settings")
321:         .select("value")
322:         .eq("key", "whatsapp_number")
323:         .maybeSingle();
324:       if (error) throw error;
325:       return typeof data?.value === "string" ? data.value : "";
326:     },
327:   });
328: 
329:   const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
330:     useTutorCompare(publishedTutors);
331: 
332:   const tutorsForCategory = (category: string) =>
333:     publishedTutors
334:       .filter((tutor) =>
335:         matchesCategoryFilter(category, tutor.subjects, [
336:           ...tutor.target_students,
337:           ...getTutorCardHighlights(tutor),
338:         ]),
339:       )
340:       .slice(0, MAX_HOME_TUTORS);
341: 
342:   const openTutorDetail = (tutorCode: string) => {
343:     navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
344:   };
345: 
346:   const tutorSearchParams = useMemo(() => {
347:     const params: HomeTutorSearchState = {
348:       category: homeSearch.category,
349:       subject: homeSearch.subject,
350:       mode: homeSearch.mode,
351:       gender: homeSearch.gender,
352:       q: homeSearch.q,
353:     };
354:     if (homeSearch.mode === "in_person") {
355:       params.station = homeSearch.station;
356:     }
357:     return params;
358:   }, [homeSearch]);
359: 
360:   const applyHomeSearch = (override?: Partial<HomeTutorSearchState>) => {
361:     const next = { ...homeSearch, ...override };
362:     const params: HomeTutorSearchState = {
363:       category: next.category,
364:       subject: next.subject,
365:       mode: next.mode,
366:       gender: next.gender,
367:       q: next.q,
368:     };
369:     if (next.mode === "in_person") {
370:       params.station = next.station;
371:     }
372:     navigate({ to: "/tutors", search: params });
373:   };
374: 
375:   // JSON-LD
376:   const structuredData = {
377:     "@context": "https://schema.org",
378:     "@type": "EducationalOrganization",
379:     name: "MatchMax",
380:     url: "https://matchmax.hk/",
381:     description:
382:       "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
383:     areaServed: {
384:       "@type": "City",
385:       name: "Hong Kong",
386:     },
387:   };
388: 
389:   const tutorListStructuredData =
390:     featuredTutors.length > 0
391:       ? {
392:           "@context": "https://schema.org",
393:           "@type": "ItemList",
394:           itemListElement: featuredTutors.map((tut, i) => ({
395:             "@type": "ListItem",
396:             position: i + 1,
397:             item: {
398:               "@type": "Person",
399:               name: tut.tutor_code,
400:               url: `https://matchmax.hk/tutors/${tut.tutor_code}`,
401:             },
402:           })),
403:         }
404:       : null;
405: 
406:   return (
407:     <div className="flex min-h-screen flex-col bg-background">
408:       <script
409:         type="application/ld+json"
410:         dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
411:       />
412:       {tutorListStructuredData && (
413:         <script
414:           type="application/ld+json"
415:           dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorListStructuredData) }}
416:         />
417:       )}
418: 
419:       <SiteHeader />
420: 
421:       <section className="relative pt-6 pb-14 md:pt-10 md:pb-16">
422:         <div className="mx-auto max-w-[1440px] px-4 md:px-6">
423:           <div className="relative z-20 p-2.5 sm:p-5 lg:rounded-sm lg:border lg:bg-card">
424:             <TutorsSearch
425:               draft={homeSearch}
426:               onDraftChange={setHomeSearchParam}
427:               onApply={applyHomeSearch}
428:               onClear={() => setHomeSearch({})}
429:             />
430:           </div>
431: 
432:           <div className="mt-8 space-y-10 md:mt-10 md:space-y-12">
433:             {CURRICULUM_CATEGORIES.map(({ label, value }) => (
434:               <CurriculumTutorSection
435:                 key={value}
436:                 label={label}
437:                 category={value}
438:                 tutors={tutorsForCategory(value)}
439:                 loading={publishedTutorsLoading}
440:                 priceSuffix={t("featured.per_hour")}
441:                 whatsappNumber={whatsappNumber}
442:                 onOpen={openTutorDetail}
443:                 compareSelectedIds={compareIds}
444:                 onCompareToggle={toggleCompare}
445:               />
446:             ))}
447:           </div>
448:         </div>
449:       </section>
450: 
451:       <SiteFooter />
452: 
453:       {compareTutors.length > 0 && !compareOpen ? (
454:         <CompareBar
455:           selectedTutors={compareTutors}
456:           onOpenCompare={() => setCompareOpen(true)}
457:           onClear={clearCompare}
458:         />
459:       ) : null}
460:       <CompareDialog
461:         open={compareOpen}
462:         onOpenChange={setCompareOpen}
463:         tutors={compareTutors}
464:         whatsappNumber={whatsappNumber}
465:       />
466:     </div>
467:   );
468: }

(End of file - total 468 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 56.7s)

_Thinking:_

The homepage has the search floating over the hero (no divider below the header). The user is most likely referring to the directory pages: `/tutors`, `/courses`, `/tutor-requests` — where the header has `border-b` and then a section with the search follows.

Let me check tutor-requests.index.tsx structure.

**Tool: grep**

**Input:**
```json
{
  "path": "src/routes/tutor-requests.index.tsx",
  "pattern": "border-b|SiteHeader|section"
}
```

**Output:**
```
Found 100 matches (more matches available)
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.saved-posts.tsx:
  Line 7: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 79:       <SiteHeader />

  Line 180:                 <ul className="mt-6 flex flex-col overflow-hidden rounded-xl border border-border divide-y divide-border bg-[color:var(--surface)]">

  Line 262:                               className="h-14 w-20 shrink-0 rounded-md border border-border object-cover"

  Line 266:                             <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/reset-password.tsx:
  Line 6: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 124:       <SiteHeader />

  Line 127:           <div className="w-full rounded-3xl border border-border bg-card p-6 sm:p-8">


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.join-requests.tsx:
  Line 97:       <div className="flex flex-col gap-4 border-b border-[color:var(--ink)]/10 pb-6 sm:flex-row sm:items-center sm:justify-between">

  Line 301:       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[color:var(--ink)]/10">

  Line 480:   const sections: { title: string; rows: { label: string; value: string }[] }[] = [

  Line 488:       sections[0].rows.push(row);

  Line 490:       sections[1].rows.push(row);

  Line 492:       sections[2].rows.push(row);

  Line 494:       sections[3].rows.push(row);

  Line 497:   return sections.filter((section) => section.rows.length > 0);

  Line 502:     <div className="grid gap-0.5 border-b border-[color:var(--ink)]/[0.06] py-2.5 last:border-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">

  Line 531:   const sections = useMemo(() => groupRows(rows), [rows]);

  Line 537:       <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-[color:var(--ink)]/10">

  Line 647:             <div className="rounded-xl border border-dashed border-border bg-[color:var(--surface-subtle)]/40 p-4 text-xs text-muted-foreground">

  Line 694:       {sections.map((section) => (

  Line 695:         <ConsolePanel key={section.title} padding="lg">

  Line 696:           <h2 className="text-base font-bold text-[color:var(--ink)]">{section.title}</h2>

  Line 698:             {section.rows.map((infoRow) => (


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.users.tsx:
  Line 225:           <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border/60">

  Line 268:             <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">

  Line 284:               <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-3">


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.cases.tsx:
  Line 241:               <div className="flex flex-col gap-4 border-b border-[color:var(--ink)]/10 pb-6 sm:flex-row sm:items-center sm:justify-between">


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.admin.tsx:
  Line 18: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 99:       <SiteHeader />


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/_authenticated.business.join.tsx:
  Line 8: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 84:       <SiteHeader />

  Line 105:             className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6 sm:p-8"


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.index.tsx:
  Line 6: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 109:       <SiteHeader />

  Line 111:         <section className="border-b border-border py-10 sm:py-12">

  Line 131:         </section>

  Line 133:         <section className="py-12">

  Line 154:                   <Skeleton key={i} className="h-40 rounded-lg border border-border" />

  Line 193:         </section>


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.$courseId.tsx:
  Line 17: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 101:     <div className="rounded-lg border border-border bg-card p-5">

  Line 107:             className="size-16 shrink-0 rounded-full border border-border object-cover"

  Line 110:           <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]">

  Line 139:       <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border">

  Line 190:     <section className="mt-10 border-t border-border pt-8">

  Line 207:               className="group w-56 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:-translate-y-0.5"

  Line 237:     </section>

  Line 270:       <SiteHeader />

  Line 272:         <section className="border-b border-border py-10">

  Line 291:               <div className="mt-6 rounded-sm border border-dashed border-border bg-card p-12 text-center">

  Line 327:         </section>

  Line 330:           <section className="py-10">

  Line 337:                     className="mb-8 aspect-[16/9] w-full rounded-lg border border-border object-cover"

  Line 353:                   <div className="rounded-lg border border-border bg-card p-4">

  Line 363:                     <div className="rounded-lg border border-border bg-card p-4">

  Line 374:                     <div className="rounded-lg border border-border bg-card p-4">

  Line 385:                     <div className="rounded-lg border border-border bg-card p-4">

  Line 409:                   <div className="rounded-lg border border-border bg-card p-6">

  Line 438:                         <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">

  Line 447:           </section>


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutor-requests.index.tsx:
  Line 90: // Legacy primary curricula group under the merged "Primary School" section.

  Line 98: function caseSectionLabel(section: string): string {

  Line 99:   if (section === "IB") return "IBDP";

  Line 100:   if (section === "Admissions") return "Admissions & Standardized Tests";

  Line 101:   return section;

  Line 155:       <div className="overflow-hidden rounded-xl border border-border">

  Line 287:       const section = caseSectionKey(item.examSystem);

  Line 288:       const list = byExamSystem.get(section) ?? [];

  Line 290:       byExamSystem.set(section, list);

  Line 292:     const known = CASE_SECTION_ORDER.filter((section) => byExamSystem.has(section));

  Line 294:       .filter((section) => !known.includes(section))

  Line 296:     return [...known, ...extra].map((section) => ({

  Line 297:       section,

  Line 298:       items: byExamSystem.get(section)!,

  Line 307:       <section className="border-b border-border">

  Line 340:       </section>

  Line 344:         <DialogContent className="max-h-[92dvh] w-full max-w-full gap-0 overflow-y-auto p-0 inset-x-0 top-auto bottom-0 translate-x-0 translate-y-0 rounded-none rounded-t-3xl border-x-0 border-b-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:rounded-3xl sm:border-x sm:border-b sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0">

  Line 402:       <section className="py-10 sm:py-12">

  Line 478:                   <div key={group.section} className="flex flex-col gap-3">

  Line 481:                         {caseSectionLabel(group.section)}

  Line 487:                     <ul className="flex flex-col overflow-hidden rounded-xl border border-border divide-y divide-border">

  Line 503:       </section>


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutors.$tutorCode.tsx:
  Line 19: import { SiteHeader } from "@/components/layout/SiteHeader";

  Line 68:     <section className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6">

  Line 78:     </section>

  Line 187:       <SiteHeader />

  Line 189:         <section className="border-b border-border bg-muted/30 py-8 sm:py-10">

  Line 205:         </section>

  Line 206:         <section className="py-8 sm:py-10">

  Line 208:             <div className="overflow-hidden rounded-lg border border-border">

  Line 209:               {[0, 1, 2].map((section) => (

  Line 211:                   key={section}

  Line 212:                   className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6"

  Line 232:                     className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-4"

  Line 249:         </section>

  Line 297:         <SiteHeader />

  Line 323:       <SiteHeader />

  Line 465:       <SiteHeader />

  Line 467:         <section className="border-b border-border bg-muted/30 py-8 sm:py-10">


(Results truncated. Consider using a more specific path or pattern.)
```

---

## Assistant (Plan · GLM-5.3-Flash · 24.4s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutor-requests.index.tsx",
  "limit": 110,
  "offset": 300
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutor-requests.index.tsx</path>
<type>file</type>
<content>
300:   }, [filteredCases]);
301: 
302:   const hasActiveFilters = Boolean(search.q || search.category || search.district);
303: 
304:   return (
305:     <PublicPage mainClassName="bg-[color:var(--surface-subtle)]">
306:       {/* Page header with the post CTA */}
307:       <section className="border-b border-border">
308:         <PageContainer width="default" className="py-10 sm:py-12">
309:           <Badge variant="outline" className="mb-4">
310:             Tutor requests
311:           </Badge>
312:           <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
313:             Requesting a tutor that meets your requirements?
314:           </h1>
315:           <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
316:             Fill in this form and tutors who&rsquo;re qualified and interested can apply for your
317:             case!
318:           </p>
319:           <div className="mt-6">
320:             <Button
321:               onClick={toggleForm}
322:               variant="solid"
323:               color="neutral"
324:               shape="pill"
325:               className="h-11 px-6 font-bold"
326:             >
327:               {formOpen ? "Hide form" : "Post your request"}
328:             </Button>
329:           </div>
330:           <CasesSearch
331:             className="mt-7"
332:             draft={draft}
333:             onDraftChange={setDraftParam}
334:             onApply={applySearch}
335:             onClear={clearSearch}
336:             subjectOptions={boardSubjects}
337:             defaultOverlayOpen={search.open === true}
338:           />
339:         </PageContainer>
340:       </section>
341: 
342:       {/* Klarna-style notice: bottom sheet on mobile, centered modal on desktop */}
343:       <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
344:         <DialogContent className="max-h-[92dvh] w-full max-w-full gap-0 overflow-y-auto p-0 inset-x-0 top-auto bottom-0 translate-x-0 translate-y-0 rounded-none rounded-t-3xl border-x-0 border-b-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:rounded-3xl sm:border-x sm:border-b sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0">
345:           <div className="flex flex-col items-stretch p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-8">
346:             <BadgeCheck
347:               className="h-12 w-12 text-[color:var(--ink)]"
348:               strokeWidth={1.75}
349:               aria-hidden="true"
350:             />
351:             <DialogTitle className="mt-6 text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-[28px]">
352:               Requesting a tutor that meets your requirements?
353:             </DialogTitle>
354:             <DialogDescription className="mt-2 text-base leading-relaxed">
355:               Fill in this form and tutors who&rsquo;re qualified and interested can apply for your
356:               case!
357:             </DialogDescription>
358:             <div className="mt-8 flex flex-col gap-2">
359:               <Button
360:                 onClick={() => {
361:                   setNoticeOpen(false);
362:                   openForm();
363:                 }}
364:                 variant="solid"
365:                 color="neutral"
366:                 shape="pill"
367:                 className="h-13 w-full text-base font-bold"
368:               >
369:                 Post your request
370:               </Button>
371:               <Button
372:                 onClick={dismissNoticePermanently}
373:                 variant="ghost"
374:                 className="h-10 w-full text-sm text-muted-foreground"
375:               >
376:                 Don&rsquo;t show again
377:               </Button>
378:             </div>
379:           </div>
380:         </DialogContent>
381:       </Dialog>
382: 
383:       {/* Collapsible request form */}
384:       {formOpen ? (
385:         <div ref={formSectionRef} className="scroll-mt-24">
386:           <PageContainer width="default" className="py-10 sm:py-12">
387:             <div className="mb-6">
388:               <h2 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
389:                 Post your request
390:               </h2>
391:               <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
392:                 Tell us what you need and our team will review it — approved requests appear on this
393:                 board so qualified tutors can apply directly.
394:               </p>
395:             </div>
396:             <CaseRequestForm idPrefix="tr" />
397:           </PageContainer>
398:         </div>
399:       ) : null}
400: 
401:       {/* Board */}
402:       <section className="py-10 sm:py-12">
403:         <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
404:           <div className="mb-10">
405:             <Badge variant="outline" className="mb-4">
406:               Tutor requests
407:             </Badge>
408:             <h2 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
409:               Open requests

(Showing lines 300-409 of 514. Use offset=410 to continue.)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 189.0s)

_Thinking:_

Now I have a good picture. The affected pages are:

1. `/tutors` (tutors.index.tsx) — `SiteHeader` (border-b) followed by `<section className="border-b border-border py-10 sm:py-12">` containing TutorsSearch.
2. `/courses` (courses.index.tsx) — same pattern with CoursesSearch.
3. `/tutor-requests` (tutor-requests.index.tsx) — `PublicPage` wrapper with `<section className="border-b border-border">` containing CasesSearch. Also has PageContainer. The PublicPage mainClassName is `bg-[color:var(--surface-subtle)]` here.

The user's request: "On desktop the top nav bar and the search bar is separated by a divider, so make the top nav area and the bottom search area in the same group and put the div line below the search bar instead and for the entire top area use grey like airbnb#FEFEFE"

So the change:
- Remove the `border-b` from the SiteHeader (or only where followed by search section? The SiteHeader is used everywhere — many pages. Removing border-b globally would affect all pages).

Hmm, this is the key tradeoff. Options:

**Option A**: Make the header border conditional — e.g., add a prop `bordered={false}` or `transparentSearchGroup` to SiteHeader, and on the directory pages, pass it. The header and the search section both get `bg-[#FEFEFE]` (light mode; dark mode equivalent), no divider between, and the search section keeps its `border-b` as the divider below the search area.

**Option B**: Change SiteHeader globally to have no border-b and always be #FEFEFE... but that affects every page (dashboard, auth, etc.). The user said "the top nav area and the bottom search area" — implies pages with a search bar. But actually maybe they want it globally? The header bg is `bg-[color:var(--surface)]/95` = white. Airbnb's header is actually white with grey border `#EBEBEB`. The user says "grey like airbnb#FEFEFE" — #FEFEFE is basically white. Hmm.

Wait, actually let me reconsider: maybe they mean Airbnb's search-page header where the sticky header + search bar area share the same background and a single divider below. Yes — on Airbnb's browse pages, the sticky header contains nav + search pill, all on the same white surface, with a bottom border/divider separating the whole header group from the results below.

So the design goal: nav row + search row = one sticky group, background #FEFEFE, divider below the search area.

Now — is the search section sticky on these pages? No, currently the header is sticky (`sticky top-0 z-50`), and the search section scrolls away. Making them "in the same group" visually just means: no divider between header bottom and search section top, same background color, and the divider moves to below the search section.

Key questions to clarify with the user:
1. Scope: only the directory pages with the search bar (tutors, courses, tutor-requests)? Or all pages? The homepage has a floating search over hero — different.
2. Should the search section also become sticky together with the header (Airbnb-style: nav + search stick together)? Or keep as-is (only header sticky, search scrolls)? The user said "make the top nav area and the bottom search area in the same group" — this might just mean visually grouped. But "group" could imply they want them sticky together. I should ask.
3. The grey #FEFEFE: applies to light mode; what about dark mode? Probably keep dark as-is or use a corresponding dark tone.
4. On the tutors page, the search section includes the h1 heading "Find verified tutors" + description + search pill. Does "the entire top area" mean header + heading + search all in #FEFEFE group? Or just the search bar row? "make the top nav area and the bottom search area in the same group" — the nav area and search area. The heading is between them. Hmm. On Airbnb, the search pill is right in the header. Here, the h1 + description sit between header and search pill.

Let me reconsider the tutors page layout:
- SiteHeader (sticky, border-b, white bg)
- section (border-b, bg-background = white) with h1 "Find verified tutors", description, TutorsSearch (pill bar)
- section (py-12) results

So "top nav area" = header; "bottom search area" = the section with the search pill. They're separated by the header's border-b. Making them one group: remove header's border-b on these pages, same bg (#FEFEFE), and keep/add border-b below the search section (it already has `border-b border-border`).

So actually the minimal change per page: 
- Header: remove `border-b border-[color:var(--ink)]/10` (when grouped), set bg to #FEFEFE.
- Search section: bg #FEFEFE, keep border-b below.

But the header is a shared component. Options:
- Add a prop to SiteHeader like `unifiedSearchHeader` or `className`-based override. SiteHeader accepts `className` and `tone`. I could add a boolean prop e.g. `mergedSearch?: boolean` that removes the border-b and applies the grey bg.
- Or simpler: always remove the border-b from the header and give all pages... no, that changes all pages.

Wait, but the search section bg: currently `bg-background` (body). The pill bar itself is `bg-card`. If the whole top area becomes #FEFEFE, the pill (`bg-card` = white) will still contrast subtly against #FEFEFE — good, like Airbnb where the pill is white on a white-ish header, delineated by border.

Actually on Airbnb, the search bar pill is white with a border, sitting on the white header. And the header has a grey bottom divider (#EBEBEB or #DDDDDD).

Also note: the user says "for the entire top area use grey like airbnb#FEFEFE". #FEFEFE is nearly-white. OK just use #FEFEFE.

Dark mode: The site has a `.dark` theme. Using a hardcoded #FEFEFE in light mode is fine; in dark mode we should keep the dark surfaces. I could add a CSS variable like `--header-grey: #fefefe` in `:root` and a dark equivalent (e.g., keep `--surface` or a slightly elevated dark tone like `#16181a`). Or use Tailwind arbitrary with dark: variant: `bg-[#FEFEFE] dark:bg-[color:var(--surface)]`. Better to add a token in styles.css for maintainability: `--surface-header: #fefefe` (light) and dark: something.

Now which pages? The user statement: "On desktop the top nav bar and the search bar is separated by a divider" — singular scenario. Most likely the tutors directory (main search page) and possibly courses + tutor-requests which have the same layout. I should ask the user about scope, and whether the search area should be sticky with the header.

Also note the homepage: search floats over the hero video area with `lg:bg-card` card. If the header goes grey there too... The homepage header would also need the same treatment if global. Hmm.

Let me also check PublicPage to understand the wrapper (used by tutor-requests) and check where else `border-b` dividers appear relative to header. Also check the `AnnouncementBanner` — it's inside the header; the banner might have its own styling.

Let me quickly check PublicPage and AnnouncementBanner.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PublicPage.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PublicPage.tsx</path>
<type>file</type>
<content>
1: import type { ReactNode } from "react";
2: 
3: import { cn } from "@/lib/utils";
4: 
5: import { SiteFooter } from "./SiteFooter";
6: import { SiteHeader } from "./SiteHeader";
7: 
8: type PublicPageProps = {
9:   children: ReactNode;
10:   className?: string;
11:   mainClassName?: string;
12: };
13: 
14: export function PublicPage({ children, className, mainClassName }: PublicPageProps) {
15:   return (
16:     <div
17:       className={cn(
18:         "flex min-h-screen min-w-0 flex-col overflow-x-clip bg-background text-foreground",
19:         className,
20:       )}
21:     >
22:       <SiteHeader />
23:       <main className={cn("min-w-0 flex-1", mainClassName)}>{children}</main>
24:       <SiteFooter />
25:     </div>
26:   );
27: }

(End of file - total 27 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 29.4s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/AnnouncementBanner.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/AnnouncementBanner.tsx</path>
<type>file</type>
<content>
1: import { Link } from "@tanstack/react-router";
2: import { X } from "lucide-react";
3: import { useEffect, useState } from "react";
4: 
5: const STORAGE_KEY = "mm_banner_dismissed_session_v1";
6: 
7: export function AnnouncementBanner() {
8:   const [isDismissed, setIsDismissed] = useState(true);
9: 
10:   useEffect(() => {
11:     setIsDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "true");
12:   }, []);
13: 
14:   if (isDismissed) return null;
15: 
16:   const handleDismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
17:     event.preventDefault();
18:     event.stopPropagation();
19:     window.sessionStorage.setItem(STORAGE_KEY, "true");
20:     setIsDismissed(true);
21:   };
22: 
23:   return (
24:     <div
25:       role="region"
26:       aria-label="Announcement"
27:       className="relative flex w-full items-center justify-center bg-[#0D1B2A] px-4 py-2 text-white sm:px-6 sm:py-2.5"
28:     >
29:       <Link
30:         to="/how-it-works"
31:         className="pr-8 text-center text-[12px] font-medium leading-snug text-white underline underline-offset-2 sm:pr-10 sm:text-sm"
32:       >
33:         Free for parents. Fair for tutors. Keep more with a low 1.5-lesson commission.
34:       </Link>
35:       <button
36:         type="button"
37:         onClick={handleDismiss}
38:         aria-label="Dismiss banner"
39:         className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
40:       >
41:         <X className="h-4 w-4" aria-hidden="true" />
42:       </button>
43:     </div>
44:   );
45: }

(End of file - total 45 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 335.4s)

_Thinking:_

Now I have the full picture. Let me clarify a couple of things with the user before writing the plan:

1. **Scope** — which pages: only directory pages with a search bar (`/tutors`, `/courses`, `/tutor-requests`), or also the homepage (search floats over hero), or ALL pages with the header (dashboard, auth, etc.)?

2. **Sticky behavior** — should the nav + search group be sticky together (Airbnb behavior: the whole group including search pill stays pinned on scroll), or keep current (only nav bar sticky, search scrolls away)?

3. The h1/heading area on /tutors, /courses, /tutor-requests sits between the nav and the search pill. Should the heading text also be inside the grey group (i.e., the whole hero section = grey), or just header + search row?

Actually the user said "make the top nav area and the bottom search area in the same group" — the search section on /tutors includes the h1 + pill. The simplest interpretation: the header and the hero/search section (which contains the search) become one visual group with bg #FEFEFE and one divider below it. That's straightforward.

Let me ask the user about scope and stickiness. Also dark-mode handling maybe — I'll just propose light mode #FEFEFE, dark mode keeps dark tokens. I'll fold that into the plan without asking.

Actually, wait. Let me re-read the user's message: "On desktop the top nav bar and the search bar is separated by a divider, so make the top nav area and the bottom search area in the same group and put the div line below the search bar instead and for the entire top area use grey like airbnb#FEFEFE"

"put the div line below the search bar instead" — so the divider below the search area. Note the search sections already have `border-b border-border` — the divider below already exists on /tutors and /courses. The real change: remove the header's border-b and unify bg.

The "search bar" is the pill. The h1 heading is above the pill but in the same section. Hmm — "below the search bar" strictly means right under the pill, not under the section. But the section already has border-b at its bottom. If we're strict: remove header border-b, keep section border-b. That IS "below the search bar" (at the bottom of the same group).

Sticky question: The header is sticky. If the search section is not sticky, when you scroll, the sticky header shows with NO border-b (since we removed it), which would look odd — content scrolling behind the header with no divider, and the header would be white while... actually if header bg = #FEFEFE opaque, scrolled content under it has no separation line. That's a visual problem. Options:
- (a) Make the whole group sticky (header + search section) — like Airbnb. This changes the sticky container: wrap both in one sticky element. The search section is tall (h1 + pill + padding) — too tall to stick comfortably (~250px). Airbnb's search page sticks nav+search (~150px total) because the pill is IN the nav row.
- (b) Keep header sticky alone with border-b shown only when scrolled (scroll-aware border) — more complex.
- (c) Keep the border-b on the header but hide it only... no.

Hmm, actually simplest robust approach: make header+search a single sticky group. But the group includes h1 "Find verified tutors" text which is tall. On Airbnb the whole header (nav + pill) is ~ 160px tall and sticks. With h1 included it's ~ 260-300px tall — too tall for sticky.

Alternative: restructure? No — keep it simple.

Practical approach: The header stays sticky. Since it no longer has its own border, when scrolled it needs SOME separation. Options:
- Give the header a border-b that only appears when scrolled (IntersectionObserver / scroll listener). Airbnb actually does this: their header border only appears when you scroll past the search area.
- OR move the search pill INTO the sticky header on desktop for the directory pages... that's a bigger refactor (search state lives in the route component).

Hmm, but wait — is that what the user wants? They just asked for visual grouping and divider placement. Maybe they don't care about scrolled-state. But a sticky borderless header over scrolling content looks broken (content visibly slides under a borderless bar — actually it would look like content is cut off by a slightly-off-white bar... #FEFEFE vs #FFFFFF, nearly invisible seam).

Let me think about what happens concretely on /tutors with a naive change:
- Header: sticky, bg #FEFEFE, no border-b.
- Below: section bg #FEFEFE with h1 + pill, border-b at bottom.
- Scroll: header stays, h1+pill scroll away. Header (no border) over results — results text would collide visually with header content without a separation line. Bad.

So we NEED either:
(a) sticky group (too tall), or
(b) scroll-aware border on header, or
(c) don't make header sticky anymore on these pages... it's sticky for a reason though (nav access).
(d) Keep it simple: header without border + scroll-triggered border via a small scroll listener in SiteHeader.

Airbnb does (d): when scrolled, a subtle bottom shadow... well Airbnb uses shadow but this repo forbids shadows; border is the flat equivalent.

I think the plan:
1. Add a CSS token `--header-bg: #fefefe` (light) — name it something like `--surface-header`. Dark mode: keep current dark surface (e.g. `#121212` or slightly elevated `#161618`). I'll define in styles.css both modes.
2. SiteHeader: add prop e.g. `mergedSearch?: boolean` (or `borderless?: boolean`). When set:
   - Remove `border-b` (or keep but transparent).
   - bg uses `var(--surface-header)` instead of `var(--surface)`.
   - Add scroll-aware bottom border: when window.scrollY > threshold (e.g., > 8px) show `border-b border-[color:var(--ink)]/10`. Actually — wait, if the header is sticky and the search section scrolls under it... Let me reconsider: maybe simpler to ask the user whether the search area should be sticky too.

Actually — hold on. Let me reconsider the layout. Maybe a cleaner interpretation matching Airbnb: make the ENTIRE top group sticky including the search pill row, but exclude the h1 text. I.e., restructure the /tutors page: sticky header group = nav row + search pill row; the h1/heading scrolls normally below. That's exactly Airbnb's browse page. But that requires moving TutorsSearch into the header (or a shared sticky wrapper) — the pill bar is stateful (draft, onApply) tied to the route. Could pass children into SiteHeader? That's a notable refactor.

Given plan mode, I should ask the user:
1. Scope: /tutors + /courses + /tutor-requests only, or all pages?
2. Sticky: when you scroll down, should the search bar stay pinned with the nav (full Airbnb behavior), or scroll away with only the nav pinned (current)?
3. Does the grey #FEFEFE cover just the pill-bar strip or the whole hero section including the "Find verified tutors" heading?

Let me ask these via the question tool. Also dark mode note — I'll mention in plan: dark mode keeps current dark surface (or a matching dark token), since #FEFEFE is a light-mode value.

Let me formulate the questions.

I've mapped out the current structure. Before finalizing the plan, a few decisions need your input:

**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "header": "Scope",
      "options": [
        {
          "description": "The three pages with the directory search bar under the header. Other pages keep the current bordered header.",
          "label": "Search pages only (Recommended)"
        },
        {
          "description": "Home hero, search pages, dashboards, auth, etc. — every page gets the grey #FEFEFE header look.",
          "label": "All pages"
        }
      ],
      "question": "Which pages should get this grouped grey header + search treatment? (The directory pages /tutors, /courses, /tutor-requests all have the search bar right below the nav; the homepage has a floating search over the hero; dashboards/auth have neither.)"
    },
    {
      "header": "Scroll behavior",
      "options": [
        {
          "description": "Header shows its divider only after you scroll past the search area (how Airbnb does it). Small scroll listener in SiteHeader.",
          "label": "Border appears on scroll (Recommended)"
        },
        {
          "description": "Keep an always-on border under the nav row; the group effect only shows at the top of the page.",
          "label": "Keep border always"
        },
        {
          "description": "Nav + search pill stay pinned together at the top while scrolling (bigger refactor: search pill moves into the sticky group).",
          "label": "Pin search with nav"
        }
      ],
      "question": "The nav bar is sticky but the search bar scrolls away today. Once the divider between them is removed, a bare sticky header would have no separation from content when scrolled. How should that be handled?"
    },
    {
      "header": "Grey coverage",
      "options": [
        {
          "description": "Nav bar + hero section (heading + search pill) all share #FEFEFE, with one divider below the search area.",
          "label": "Whole top block (Recommended)"
        },
        {
          "description": "Only the nav bar row and the pill-bar strip get #FEFEFE; heading keeps white — but this creates a visible seam inside the section.",
          "label": "Nav + pill strip only"
        }
      ],
      "question": "On /tutors the search section currently includes the \"Find verified tutors\" heading plus the pill bar. What does the #FEFEFE grey cover?"
    }
  ]
}
```

**Output:**
```
User has answered your questions: "Which pages should get this grouped grey header + search treatment? (The directory pages /tutors, /courses, /tutor-requests all have the search bar right below the nav; the homepage has a floating search over the hero; dashboards/auth have neither.)"="Search pages only (Recommended)", "The nav bar is sticky but the search bar scrolls away today. Once the divider between them is removed, a bare sticky header would have no separation from content when scrolled. How should that be handled?"="make the search bar sticky as well and make an animation to retract the search bar i will show you later i send an image", "On /tutors the search section currently includes the "Find verified tutors" heading plus the pill bar. What does the #FEFEFE grey cover?"="Whole top block (Recommended)". You can now continue with the user's answers in mind.
```

---

## Assistant (Plan · GLM-5.3-Flash · 281.5s)

_Thinking:_

The user answered:
1. Scope: Search pages only (/tutors, /courses, /tutor-requests).
2. Scroll behavior: "make the search bar sticky as well and make an animation to retract the search bar i will show you later i send an image" — so the search bar should stick with the nav, and have a retract/collapse animation. They'll send an image later showing what they want. So for now, plan should include: sticky group (nav + search) with a collapse/retract animation (like Airbnb: when scrolling down, the search bar collapses/hides; when scrolling up, it re-expands — or on scroll down the pill shrinks). Since they'll send an image later, I'll note that the exact animation will be finalized from the image, but design the structure so the search pill lives in the sticky group and can animate (height collapse / hide).
3. Grey coverage: Whole top block.

Now let me think about the implementation plan in detail.

## Current architecture

- `SiteHeader` (src/components/layout/SiteHeader.tsx): sticky top-0 z-50, hidden on <lg (mobile has no top bar), contains nav row (h-64px) + AnnouncementBanner. `border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm`.
- Directory pages: after `<SiteHeader />`, a hero `<section className="border-b border-border py-10 sm:py-12">` containing heading + `<TutorsSearch>` (which renders desktop `SearchPillBar` + FiltersPillButton in a `hidden lg:flex` row, plus mobile trigger/overlay).
- The search pill row: `SearchPillBar` form (rounded-full border bg-card p-1.5) + `FiltersPillButton`.
- The tutors page content below: results section.

## Target design (desktop, lg+)

1. **Grouped top block**: nav row + hero (heading + search pill) share one background `#FEFEFE` (light mode; dark mode keeps dark tokens — need a token). No divider between nav and hero; single divider below the whole block (the hero section's existing `border-b border-border` stays; remove header's `border-b`).

2. **Sticky group with retract animation**: The search pill bar should become sticky along with the nav. And when scrolling (presumably down), the search bar retracts with an animation (collapses height / hides), and presumably re-expands when scrolling up (Airbnb-like) — pending the user's image.

Implementation approach:

Option A — CSS `position: sticky` on the pill row within the page flow:
- Put the pill bar row (desktop) inside the hero, and make IT sticky at `top: 64px` (below the sticky header). The hero stays in flow; when scrolling, the pill row sticks below the nav. Then a retract animation: on scroll down past a threshold, collapse the sticky pill row (e.g., translate-y/height → 0 or slide up out of view), on scroll up expand again.
- Problem: sticky element must be a direct child of a block without overflow constraints; the pill row is inside PageContainer with px padding. Sticky works within its parent's height — once the parent (hero section) is scrolled past, the sticky element disappears from view (sticks only while parent is in view). That means the pill would only stick while the hero is on screen — not what we want; we want it pinned below nav for the whole results scroll.
- Fix: make the sticky element span more content — e.g., wrap the sticky in a container that spans the whole main content, or make the sticky element the top of the results section... Actually simplest: move the desktop pill row OUT of the hero into its own sticky wrapper that spans the rest of the page (e.g., a wrapper div that contains pill row + results section; sticky child = pill row). But visually the pill must appear inside the hero group at top. If the pill row is the first child of a wrapper that also contains the results, and the hero (heading) is above it... then the pill would be below the heading in flow — that matches: heading in hero, then sticky pill row, then results.

But wait — the grouped grey background: nav + heading + pill all #FEFEFE with divider below. If pill is sticky and scrolls... at top of page: nav (grey, no border) + heading (grey) + pill (grey) + divider (border-b) + results. When scrolled: nav sticky at top; pill sticks at top: 64px below nav; heading scrolled away. Then the divider below the pill — the border-b should travel with the pill? If pill is sticky, its bottom border (on the sticky wrapper) would stick with it. Good: sticky wrapper has border-b + bg #FEFEFE.

But careful: at top-of-page state, nav + heading + pill + divider all grey. When scrolled: nav (grey) + pill (grey, stuck below nav) + divider. The heading region is gone. That's consistent.

Hmm, but the hero's own `border-b border-border` currently separates hero from results. If the pill row (with its own border-b) sticks, the hero border-b would remain in flow (at the bottom of the hero, below the pill... wait no, if the pill row is moved out of the hero, then hero = heading only, and the border-b under the pill row belongs to the pill wrapper).

Layout restructure for /tutors (lg+):
```
<SiteHeader merged />            // sticky top-0, bg #FEFEFE, no border-b (or scroll-aware)
<main>
  <section hero bg #FEFEFE>      // heading + description, py-10
  <div sticky pill wrapper>      // sticky top-16(64px), bg #FEFEFE, border-b border-border, z-40
    <TutorsSearch desktop row>   // pill bar + filters button
  </div>
  <section results>
```
But the hero and pill need to look contiguous: hero py-10 with heading; pill wrapper directly below with the pill; divider below pill. Actually currently the pill is inside the hero with mt-7 and hero py-10 sm:py-12 — bottom padding below pill ~48px. If pill row moves to its own sticky wrapper, the hero's bottom padding sits between heading and pill. Visually fine: heading block (grey) then pill (grey) then border.

But mobile (<lg): TutorsSearch renders MobileSearchTrigger (not sticky, part of hero flow) — keep mobile as-is entirely: mobile has no top nav bar, so this whole change is desktop-only (the user said "On desktop"). So the restructure must be careful to keep mobile layout identical. The `TutorsSearch` component renders BOTH desktop pill row and mobile trigger/overlay in one component. If we need the desktop row sticky but mobile trigger in flow, we may need to split rendering: e.g., TutorsSearch keeps mobile parts; the desktop row becomes a separately-sticky element. Options:
- Add a `sticky` variant/prop to TutorsSearch that wraps the desktop row in the sticky container. But the sticky container must wrap the REST of the page for stickiness to persist beyond the hero... 

Hmm wait. Actually, let me reconsider: does the pill need to stay stuck for the entire page scroll? The user said "make the search bar sticky as well and make an animation to retract the search bar". Retract = collapse when scrolling down. If it retracts (disappears) on scroll-down and re-expands on scroll-up, then long-lived stickiness matters less but still needed while it's visible in retracted state? If it fully retracts, there's nothing pinned. Re-expanding mid-scroll requires it to still be sticky at that point.

CSS sticky constraint: the sticky element only sticks while its containing block is in view. To have it stick across the whole page, its parent must span the whole remaining page. So structure:

```
<main>
  <section hero>heading (bg #FEFEFE, pb-...)</section>
  <div class="lg:sticky lg:top-16 z-40 bg-#FEFEFE border-b"> ← can't span whole page if sticky here...
```

Better structure: put the sticky pill INSIDE a wrapper that spans the rest:
```
<main>
  <section hero>heading</section>
  <div>                        // spans pill + results
    <div class="sticky top-16">pill row</div>   // sticky works across this whole wrapper
    <section>results</section>
  </div>
</main>
```
This works for CSS sticky persistence. But the TutorsSearch component bundles desktop + mobile; the mobile trigger must stay in the hero. So we'd need to split TutorsSearch into `TutorsSearchBar` (desktop pill row) and mobile parts, OR pass a prop. Alternatively, restructure at the page level: keep `<TutorsSearch>` where it is but with a new prop like `desktopSticky` that renders the desktop row into a sticky positioned wrapper... but again the wrapper-parent problem.

Alternative simpler approach — **transform-based sticky group**: Make the ENTIRE top group (header + hero with heading + pill) one sticky element? Too tall (~300px), user wants retract animation anyway.

**Approach B — fixed positioning with JS (Airbnb-style)**: The pill row is `position: fixed` (or sticky) at `top: 64px` (below the sticky header) with z-40, full width, bg #FEFEFE, border-b. On scroll down past threshold: animate collapse (max-height/height → 0 + fade, or translateY(-100%)) so it retracts out of view; on scroll up: re-expand. Fixed positioning avoids the sticky-parent problem entirely. On mobile it renders nothing different (mobile trigger stays in flow). Retract animation via a small hook (useScrollDirection / motion values) — the repo already uses `motion/react` (framer-motion) in search-pill-bar.

Actually — cleaner: keep the pill row in flow at the top (inside hero area), and use JS to toggle classes: when scrolled past hero bottom, the pill row gets `fixed top-16 left-0 right-0` + slide-down animation... The classic pattern is: measure sentinel; when sentinel passes, add fixed + animated entry. Airbnb does exactly this.

But simplest robust with good animation: `sticky` inside a full-page wrapper. Let me think about what's least invasive given the components:

The TutorsSearch component currently renders:
```
<div className={className}>
  <div className="hidden items-stretch gap-2 lg:flex">pill bar + filters</div>
  <FiltersDialog>...
  <MobileSearchTrigger>...
  <MobileSearchOverlay>...
</div>
```

Plan: 
1. Extract the desktop row (`hidden lg:flex` with SearchPillBar + FiltersPillButton) into its own export, e.g. `TutorsSearchBar`, or add a render prop. Actually simpler: keep TutorsSearch API but give it an optional `stickyDesktop` prop that wraps the desktop row in the sticky container with the retract animation. But the sticky container must wrap the results section... no wait — sticky inside TutorsSearch's root div (which is inside the hero section) only sticks while the hero is in view. Hmm, the hero section's height includes py-10 + heading + pill; once you scroll past, pill unsticks. That fails.

So the DOM restructure at the page level is needed: the sticky pill must be a child of a wrapper spanning hero-bottom → results. E.g.:

```
<SiteHeader merged />
<section hero (bg grey, border-b? no)>heading + pb</section>
<div>  // wrapper spans rest of page
  <TutorsSearchDesktopSticky ... />  // sticky top-[64px], bg grey, border-b, retract animation
  <section results />
</div>
```

But mobile: MobileSearchTrigger must remain inside the hero (in flow). Currently the trigger is part of TutorsSearch. So we split TutorsSearch:
- `TutorsSearchMobile` (trigger + overlay + FiltersDialog? no—dialog is desktop too... actually FiltersDialog opens from both desktop FiltersPillButton and mobile overlay's filter? Let me check: FiltersDialog is opened by FiltersPillButton (desktop) — on mobile the overlay has its own inline filter controls. So FiltersDialog belongs to desktop row).

Hmm, actually wait. Let me check MobileSearchTrigger — does it render `hidden lg:hidden`? Let me check. Also SearchPillBar desktop row is `hidden lg:flex`. Let me look at mobile-search-trigger quickly.

Actually, regardless — the split: `TutorsSearch` keeps everything except the desktop row; new `TutorsSearchBar` (desktop-only, `hidden lg:flex` inside) is rendered by the page inside the sticky wrapper. Or TutorsSearch gets two slots. This is getting complex; maybe better:

**Alternative approach — make the whole header+hero group sticky via a single sticky wrapper.** i.e., on directory pages:

```
<div className="lg:sticky lg:top-0 lg:z-40">
  <SiteHeader merged />   // header becomes non-sticky inside the group? 
  <section hero (grey, heading + pill)>  // pill row here
</div>
<section results />
```
Sticky wrapper = nav (64px) + hero. Hero is tall (~250px). Total sticky height ~314px — too much chrome pinned. The user wants retract animation precisely to solve this: on scroll down, the pill (and maybe heading) retracts so the pinned area shrinks to nav+pill (~150px) or just nav. Hmm.

"make the search bar sticky as well and make an animation to retract the search bar" — reading literally: search bar sticky with nav; when scrolling, it retracts (collapses away) with animation. Likely: scroll down → search bar collapses out of view (nav alone pinned); scroll up → search bar slides back in. That's exactly Airbnb's behavior (their search pill collapses/expands based on scroll direction on some surfaces; on Airbnb the header itself slides). 

So target states:
- At top: nav (grey, no divider) + hero heading (grey) + pill (grey) + divider below pill... wait but if pill is sticky within the group and retracts on scroll-down, when re-expanded on scroll-up it shows pinned under nav.

DOM for that: 
```
<div class="sticky top-0 z-40 bg-grey">       // spans hero+pill+... no
```
Sticky persistence again. OK let me just go with:

```
<SiteHeader merged />            // stays sticky top-0 z-50 as today (bg grey, no border)
<section hero>heading</section>  // grey, in flow
<div>                            // spans rest of page
  <div className="sticky top-16 z-40 bg-grey border-b" + retract-classes>
    <DesktopPillRow />
  </div>
  <section results />
</div>
```

Wait — but there's a subtlety: when the pill row is sticky at top-16 and page scrolled such that pill is pinned: nav (64px) + pill bar below it, both grey — looks like one group. Divider = the sticky wrapper's border-b. When scrolled further and pill "retracts", animate its height/transform to 0 → nav alone with... no divider. Then border should also retract — put the border on the retracting element so it goes with it.

Retract trigger: scroll direction. Scroll down (past some offset) → collapsed; scroll up → expanded. Use a small hook with motion/react `animate` or CSS transitions on `transform: translateY(-100%)` + the wrapper's height collapsing... For sticky elements, animating `height` from auto → 0 causes layout shift of content below (content jumps up) — that's actually desired? If pill retracts, results shift up — hmm, that might be janky. Airbnb avoids layout shift: their pill collapse uses transform/opacity without removing layout space? Actually on Airbnb when you scroll down on search pages, the whole header stays and the pill stays... Let me not overthink; the user will send an image. Plan should propose: scroll-direction-driven expand/collapse using `transform: translateY` + opacity (no layout shift — element stays in layout, just visually slides under the nav/behind... actually translateY(-100%) of a sticky element moves it up behind... the header is z-50, pill z-40, so pill slides up underneath the nav? The nav is opaque grey so the pill would be hidden behind it. But the pill's sticky top-16 — translating it -100% puts it at top:-pillHeight, behind the header (z-50 > z-40). That works visually! The space it occupied remains (sticky keeps layout), content doesn't jump. And the border-b travels with it (on the pill wrapper). 

But hmm — the pill wrapper's border-b + bg grey: when pill translated up behind nav, the border-b also moves up behind nav → nav appears borderless again over results. Content scrolls under nav. Is that OK? When user scrolls down they presumably want more content visibility — fine, and scroll up brings the search back.

Alternatively animate height collapse. I'll propose transform-based (no layout shift) and note we'll finalize against the image the user sends.

Now — scope across pages: /tutors, /courses, /tutor-requests all use this pattern. /tutor-requests uses PublicPage + PageContainer and its search section includes badge + h1 + post CTA button + CasesSearch. Same restructure applies.

Also courses page: hero has eyebrow + h1 + desc + CoursesSearch.

To avoid triplicating sticky logic, create a reusable component, e.g. `StickySearchGroup` or a hook `useRetractOnScroll` + wrapper component `StickySearchBar` in `src/components/search/`:

- `src/components/search/sticky-search-bar.tsx`: exports `StickySearchBar` — wraps children (desktop search row) in the sticky container: `sticky top-16 z-40 border-b border-border bg-[var(--surface-header)]`, contains retract logic (scroll direction hook + motion), renders children inside PageContainer-like padding? The pill row needs the same horizontal padding/width as content (max-w-7xl px-4 sm:px-6 for tutors/courses; tutor-requests uses PageContainer default width max-w-3xl... hmm, tutor-requests container is `max-w-3xl` — the CasesSearch is inside PageContainer width="default"). The sticky bar must replicate the container widths per page. So StickySearchBar takes a `containerClassName` prop or children handle their own container. Better: StickySearchBar provides the sticky frame (bg, border, retract) and the page passes `<div className="mx-auto max-w-7xl px-4 sm:px-6">…row…</div>` as children.

2. **SiteHeader changes**: add prop e.g. `merged?: boolean` or `variant="search-group"`:
   - when set: remove `border-b`, bg → `#FEFEFE` token (light) / dark equivalent, keep backdrop-blur? With opaque #FEFEFE maybe drop /95 alpha; keep simple: `bg-[color:var(--surface-header)]` with full opacity. Actually currently `/95 backdrop-blur-sm`. For the grey group, opaque is fine (Airbnb header is opaque). Keep `backdrop-blur` removal simple.
   - Also `tone` prop exists (`site-header--dark` class) — check what that does in styles.css. Let me grep. (There's a `.site-header--dark` class presumably.)
   
3. **Token**: add to styles.css `:root { --surface-header: #fefefe; }` and in `.dark { --surface-header: ... }` — dark value: maybe `#16181a` or reuse `--surface` (#121212)? The hero bg on directory pages also needs this token (light #FEFEFE). In dark mode, hero bg currently `bg-background` (#121212) and pill bg-card. If we apply `bg-[color:var(--surface-header)]` to hero + sticky bar, in dark it'd equal #121212 = same as background → no visual regression. Simple: dark: `--surface-header: #121212` (same as --surface) or slightly lighter `#161618` to distinguish? Since currently hero is bg-background (#121212) and header --surface #121212 — identical already in dark. So map dark `--surface-header: #121212`. 

Wait — actually for the hero on tutors page: currently section has no bg (inherits bg-background white). To make it #FEFEFE: add `bg-[color:var(--surface-header)]`. In dark, that = #121212 = bg-background → no change. 

Hmm, but one more consideration: #FEFEFE vs #FFFFFF body — the pill bar is `bg-card` (#FFFFFF) with border — subtle contrast against #FEFEFE, good.

But what about the dividers' color? Airbnb uses #DDDDDD/#EBEBEB. Current: header border-b `border-[color:var(--ink)]/10`; hero `border-border` (#e1eaef). Keep existing border tokens (flat design rules). Fine.

4. **AnnouncementBanner**: sits inside header below nav row. It's `bg-[#0D1B2A]` dark navy — stays as is (it's a banner, fine within grey header).

5. **Retract animation details**:
   - Hook `useScrollDirection` (threshold ~40px scroll-down to collapse, scroll-up any → expand, ignore near top — at top always expanded).
   - Apply `motion/react` or plain CSS transition on the sticky wrapper: `transition-transform duration-300` + `translate-y-[-100%]` when collapsed... but translateY on a sticky element: transform moves it visually but it still occupies space and still creates containing block issues? transform on sticky is fine (sticky + transform both work; transform creates containing block for fixed children — popover panels inside pill use Radix Popover with portal, so fine).
   - Wait, one catch: Radix Popover content is portaled to body — unaffected. The highlight motion div is inside — fine.
   - z-index: header z-50; sticky bar must be below header (z-40) so retracting slides behind nav. But when expanded and pinned below nav — no overlap anyway.
   - At top of page (scrollY < small threshold): force expanded and... also at top the sticky element is at its natural position (below hero heading), not pinned. Sticky only engages when scrolled past. Fine.
   - Reduced motion: respect `useReducedMotion` → snap (repo already uses this pattern in SearchPillBar).

   Also hide the "border-b" while collapsed (travels with element — automatically).

   Edge: when collapsed and user scrolls up, expand — but if user is mid-page and expands, pill pops back pinned below nav covering content — that's the Airbnb behavior, OK.

6. **The heading area** stays in flow (scrolls away). Grey bg on hero. The hero's own `border-b` must be REMOVED (divider now below sticky pill bar). On tutors/courses: hero section currently `border-b border-border py-10 sm:py-12` → becomes no border, and bottom padding adjusted (pb smaller, since pill sits below hero in sticky bar... wait no!).

Hmm wait, layout at top-of-page: nav / heading / pill / divider / results. If pill is in the sticky wrapper that spans results, the hero is JUST heading (pb small). The pill row visual: at top of page it sits right below heading — need spacing (mt / padding) so it doesn't hug the heading. Sticky bar wrapper: `py-4` or so. Then divider below it.

But careful — when pinned mid-scroll: nav / pill / divider / results. Fine.

7. **Page-level edits**:

   a. `tutors.index.tsx`:
   - `<SiteHeader merged />` (new prop).
   - Hero section: remove `border-b`, bg grey token, keep heading + desc, keep bottom padding.
   - After hero: `<div>` wrapper containing `<StickySearchBar>` (desktop: renders TutorsSearchBar with same props: draft, onDraftChange, onApply, onClear, resultCount, allPrices, whatsappUrl, pill open state...) — hmm, the pill bar props live in TutorsSearch. So I need to export the desktop row from tutors-search.tsx as a new component `TutorsSearchBar` accepting those props, and TutorsSearch keeps mobile parts + dialog.
   
   Wait, FiltersDialog — currently rendered inside TutorsSearch, opened by desktop FiltersPillButton. If I split, FiltersDialog state (`filtersOpen`) is shared with... only the desktop FiltersPillButton. On mobile, overlay has its own controls; does mobile overlay reference filtersOpen? No. So move FiltersDialog into the desktop bar component. Let me double check TutorsSearch: `filtersOpen` used by FiltersPillButton onClick and FiltersDialog open — desktop-only. Yes.
   
   Actually — simpler split that avoids prop-drilling duplication: keep `TutorsSearch` as one component but give it a `variant`/prop that renders desktop row inside the sticky wrapper? The problem remains: sticky wrapper must span results, so it must be OUTSIDE (sibling after hero, before results). So the page must render two components: mobile parts inside hero (mobile trigger), desktop parts inside sticky bar. So split:
   - `TutorsSearchMobile` (trigger + overlay) — stays in hero (mobile only).
   - `TutorsSearchBar` (desktop pill row + FiltersDialog) — goes in sticky bar.
   Both share draft/apply props — page passes to each. To keep pages tidy, maybe keep a single exported `TutorsSearch` with subcomponents? Let me not over-engineer: export `TutorsSearchBar` and `TutorsSearchMobile` (rename internal), keep `TutorsSearch` as-is for the homepage (homepage search is NOT sticky/merged — it floats over hero; untouched).
   
   Hmm wait — homepage uses TutorsSearch too. If I split TutorsSearch into Bar + Mobile, homepage must render both: `<TutorsSearch>` could be re-defined to render both (for homepage), while directory pages use the two subcomponents. Or homepage keeps using a combined component. To minimize homepage churn: keep `TutorsSearch` (combined) for homepage; directory pages import `TutorsSearchBar` + `TutorsSearchMobile`. Implementation: define internal components and have `TutorsSearch` compose them. 

   b. `courses.index.tsx`: same treatment with `CoursesSearch` (split similarly).
   c. `tutor-requests.index.tsx`: same with `CasesSearch`. Note its hero includes CTA button + badge; wrapper `<div>` after hero; container is PageContainer width="default" (max-w-3xl?) — the sticky bar children container should match: PageContainer width="default". Check PageContainer for widths. Also PublicPage mainClassName bg surface-subtle on this page — the grey #FEFEFE would sit on top of subtle grey bg; hero bg token handles it. Below-divider bg stays surface-subtle. Hmm — #FEFEFE block on #F7F9FA page bg... The divider separates them. OK.

   Wait — actually on tutor-requests, `mainClassName="bg-[color:var(--surface-subtle)]"`. The top group #FEFEFE then divider then #F7F9FA results. Slightly odd but consistent with "top area grey". Fine.

8. **Mobile untouched**: all new sticky/group behavior is `lg:` (hidden below lg). The user said "On desktop". Mobile keeps current hero with border-b (hero currently has border-b on all breakpoints — on mobile it must KEEP its border-b! So the sticky bar (desktop-only, hidden lg) shouldn't remove mobile's divider. Options: keep hero border-b but only remove at lg (`lg:border-b-0`), and give the sticky bar `hidden lg:block` with border-b. Mobile divider = hero's border-b (below trigger, unchanged). 

Hold on — mobile hero currently: badge/h1/CTA + CasesSearch(mobile trigger) with hero border-b at bottom. If we add the sticky bar as a `hidden lg:block` sibling AFTER the hero, and hero keeps `border-b lg:border-b-0`... wait if hero keeps border-b on mobile — but the hero element now might be restructured (pill moved out only at lg?). Hmm — the pill row itself is `hidden lg:flex` inside TutorsSearch; the mobile trigger `lg:hidden` (check). So within the hero, TutorsSearch renders: desktop row (lg-only) + mobile trigger (lg:hidden). 

If directory pages render `TutorsSearchMobile` in hero (contains trigger + overlay, lg:hidden) and `TutorsSearchBar` in sticky wrapper (hidden lg:block + sticky), then:
- Mobile: hero = heading + trigger, border-b stays (hero keeps border-b but with `lg:border-b-0`... actually if sticky bar is `hidden lg:block`, at lg the hero border-b would still show — need `lg:border-b-0` on hero). And the divider below search on mobile = hero's border-b (existing behavior preserved). 

9. **SiteHeader prop plumbing**: `SiteHeader` used in many files; add optional prop `variant?: "default" | "merged"` or boolean `mergedSearchGroup?: boolean`. Only directory pages pass it. Style when merged:
```
"sticky top-0 z-50 hidden w-full lg:block bg-[color:var(--surface-header)]"  // no border-b, maybe keep backdrop-blur? opaque
```
Currently `/95 backdrop-blur-sm` — for opaque #FEFEFE group, use full opacity (Airbnb header is opaque). I'll propose opaque.

Dark mode: `--surface-header` dark = `#121212`? Hmm — in dark, header currently `--surface` #121212 at 95% + blur. Full opacity #121212 fine.

Actually, maybe name token `--surface-header: #fefefe` (light) / dark keep `#16181a`?? Let me keep it simple: dark = #121212 (matches --surface / background; no visual change in dark).

10. **The retract animation** — the user says they'll send an image later. So plan: implement scroll-direction retract (down → collapse behind nav; up → expand) with spring/transition, respecting reduced motion; mark it as adjustable once they share the image. Also consider: maybe they want the search bar to retract only partially or shrink into a small search button? Airbnb on mobile app does that; on web, scrolling down hides... I'll note it's pending their image; structure supports variants (collapse fully vs. shrink to compact pill).

Let me also double check `PageContainer` and `.site-header--dark` and `mobile-search-trigger` to get details right for the plan.

Let me check a few remaining pieces before finalizing the plan.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PageContainer.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/PageContainer.tsx</path>
<type>file</type>
<content>
1: import type { ComponentPropsWithoutRef } from "react";
2: 
3: import { cn } from "@/lib/utils";
4: 
5: type PageContainerProps = ComponentPropsWithoutRef<"div"> & {
6:   width?: "narrow" | "default" | "wide";
7: };
8: 
9: const widthClasses = {
10:   narrow: "max-w-3xl",
11:   default: "max-w-4xl",
12:   wide: "max-w-5xl",
13: };
14: 
15: export function PageContainer({ className, width = "default", ...props }: PageContainerProps) {
16:   return (
17:     <div
18:       className={cn("mx-auto w-full min-w-0 px-4 sm:px-6", widthClasses[width], className)}
19:       {...props}
20:     />
21:   );
22: }

(End of file - total 22 lines)
</content>
```

**Tool: grep**

**Input:**
```json
{
  "path": "src",
  "pattern": "site-header--dark"
}
```

**Output:**
```
Found 3 matches
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx:
  Line 106:           tone === "dark" && "site-header--dark",


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css:
  Line 635:   .site-header--dark {

  Line 644:   .site-header--dark .text-brand-gradient {

```

---

## User

[Image 1] 

---

## Assistant (Plan · GLM-5.3-Flash · 107.6s)

_Thinking:_

The user sent the Airbnb header image. This is the Airbnb compact header: logo left, search pill in the CENTER of the nav row, and "Become a host" + avatar + menu on the right. This is the collapsed/retracted state — where the search pill becomes part of the nav bar row.

So the animation they want: when scrolling down, the big search bar (with heading etc.) retracts and the search pill collapses into the nav row center (Airbnb-style compact search in the header). When at top, the search bar is below the nav in the hero area, and the nav shows no search pill in the center.

That's the classic Airbnb behavior:
- Top of page: nav row = logo + nav links + account stuff. Below it, the hero section with the big search pill.
- Scrolled: the big search pill collapses (retracts), and a compact search pill appears in the center of the sticky nav row (withAnywhere | Anytime | Add guests style segments).

So "retract the search bar" = the search bar shrinks into the nav bar (compact pill in the middle of the top nav). The image shows exactly that compact state.

Now the plan needs updating:

1. SiteHeader gets a prop for directory pages (merged/group mode): no border-b, grey #FEFEFE bg.
2. The nav row in merged mode shows a compact centered search pill when scrolled (retracted state), and hides it at top (when the full search bar is visible below).
3. The full search bar (pill row) in the hero: on scroll down, it retracts (slides up / collapses) and the compact pill in the nav appears with animation.

Hmm wait — but the nav row on /tutors currently has: logo, nav links (ml-12), account stuff (ml-auto). Airbnb compact: logo left, search CENTER, actions right. Inserting a centered compact search pill between nav links... The current header has 7 nav links + logo + account menu — quite crowded. Airbnb's compact search pill (Anywhere | Anytime | Add guests + search button) is ~ 360px wide, centered absolutely in the nav row.

So implementation for the header in merged mode:
- Compact pill: absolutely centered in the nav row (`absolute left-1/2 -translate-x-1/2`), rendered when scrolled past threshold; animates in (scale/fade/slide-down from the hero pill position ideally, but simple fade/slide is fine).
- The hero's big pill bar: on scroll down past threshold, retracts with animation (translate-y / max-height collapse / fade) — since it's in flow, collapsing height causes content jump; Airbnb handles this by making the whole header fixed and shrinking. Options:
  a. The big pill stays in flow but when "retracted" state, it's `position: fixed` at top under nav and collapses to height 0 (results shift up — acceptable? Airbnb actually keeps results stable because the whole header including search is fixed; when search collapses, header shrinks and content moves up smoothly as part of the scroll animation).
  
Let me think about the actual Airbnb web behavior on /s/~browse/ pages: the header is fixed, contains nav row; below nav is the search bar row (big pill). On scroll down: the big pill collapses (the search row height animates to 0) — content below shifts up — and simultaneously the compact pill fades in within the nav row center. On scroll up: reverse. Actually on Airbnb's search results page the pill is IN the header row already. On the home page, scrolling down transitions home header → search-results-style header with compact pill.

For our directory pages, simplest robust approach:

**Structure**: 
```
<SiteHeader merged ...>   // sticky top-0 z-50, grey, no border
   nav row (logo, links, actions)
   [compact search pill — absolutely centered, visible when scrolled]
</SiteHeader>
<section hero grey>heading + desc</section>
<div>  // spans rest
   <StickySearchBar sticky top-16 z-40 grey border-b>  // big pill row
   <section results>
</div>
```
Scroll behavior (direction-based):
- scrollY < threshold (say past the big pill's natural position): expanded state. Big pill in its sticky spot (below heading at top; once scrolled past heading, it pins below nav at top-16). Compact pill hidden.
- scrolling DOWN past threshold: big pill animates out (translateY(-100%) slides it behind the opaque nav — since z-40 < z-50 nav is opaque grey, it hides cleanly; its border-b travels with it). Compact pill in nav animates in (fade + slight scale/slide). No layout shift (sticky element keeps its space).
- scrolling UP: reverse.

The compact pill in the nav — clicking it should scroll to top / reopen the big search (Airbnb: clicking compact pill expands it). Simplest: onClick → smooth scroll to top (which naturally expands the big pill) — or focus/expand. Airbnb scrolls up. I'll propose: click → scroll to top.

What goes inside the compact pill? Airbnb: "Anywhere | Anytime | Add guests 🔍". Ours (tutors): keyword/curriculum/subject/mode summary + search icon. Simplest v1: a compact pill showing the current search summary (e.g., active filters count or placeholder text like "Search tutors") + magnifier icon, opening the full search (scroll to top). Or reuse SearchPillBar in compact mode?? Too complex. Proposal: compact pill = rounded-full border bg-card with truncate text summarizing current draft (category/subject/q/mode) or placeholder "Search tutors", plus blue circular search icon button. Click → scroll to top + focus keyword input? Keep simple: scroll to top.

Hmm — but wait, maybe the user wants the compact pill to show the three segments like Airbnb. That'd require lifting search draft state into the header — significant. For the plan, propose v1 = summary pill with scroll-to-top, and note we can extend to interactive segments later. Actually — let me reconsider: The draft state lives in the route component. The header is rendered by the route component, so we COULD pass props... but compact interactive pill inside SiteHeader would need the segments config per page (tutors vs courses vs cases). That's heavy. V1: non-interactive summary + icon; click scrolls to top. I'll ask? No — too many questions already; I'll present it in the plan as a decision with default. Actually the user said "i will show you later i send an image" — and they sent the Airbnb image. The image shows the interactive compact pill in the nav center. Hmm. The safest: make the compact pill reflect the current search state (segments display text, non-interactive), and on click scroll to top. I'll present that in the plan; they can adjust.

Wait, actually, maybe I should reconsider making the compact pill interactive using the same SearchPillBar component in a compact variant — rendering the actual segments. But SearchPillBar's popover panels are big; in the nav center they'd still work (popovers below). Width: 4 segments + button — on 1440 max-w with 7 nav links + logo + account, the centered pill ~360-420px. Nav links have ml-12 and gap-9; they'd collide with an absolutely centered pill. Airbnb home header does exactly this: logo left, pill center, right actions; NO nav links on home. On our /tutors header there ARE nav links. Airbnb search results header: logo left, pill center-left, nav links right ("Homes", "Experiences"), then icons.

Honestly, the cleanest matching the image: compact pill centered, nav links stay left, account right — on wide screens (lg+) there's room (1440px). At lg (1024px) it'll be tight: logo(~150) + 7 links(~700?) — the nav links row alone is wide. Hmm. The pill is absolutely positioned so it would overlap links at lg. Options: hide some links at lg... The current header already shows all 7 links at lg. Adding a centered pill will overlap. Maybe make compact pill only visible at xl+? Or overlap is unacceptable → need responsive handling: at lg–xl, maybe the compact pill replaces... 

Let me estimate widths: "How it works" "Find tutors" "Courses" "Saved" "Become a tutor" "For business" "Request a tutor" at 15px semibold ≈ 110+100+80+60+130+110+130 + gaps(9*24=~216) ≈ 936px + logo ~180 + account ~ up to 240(w-60 button)+language toggle. Total ≈ 1400+ — it barely fits 1440 already without a center pill! Adding a centered compact pill (~380px) would definitely overlap.

Hmm. So on our site, the compact centered pill can't coexist with the 7 nav links. What does the user expect? Their image is Airbnb's header where the pill is centered between logo and right actions. For matchmax, maybe in compact state the pill takes center and nav links hide? Or the pill replaces nav links?? I should ask the user — this is a real tradeoff. Options:
1. Compact state hides the center-ish nav links (show only logo + pill + actions) — nav links reappear when expanded (scroll up to top). E.g., links `hidden 2xl:flex`? Hmm.
2. Compact pill smaller: just icon-only circle (magnifier) that expands on click — avoids overlap.
3. Keep links, overlap handled by hiding links below 2xl and showing pill at 2xl+.

Airbnb on narrow: search pill shrinks (icon-only "🔍" pill) as viewport narrows. So option: compact pill width shrinks with breakpoints (full segments → icon-only at lg/xl).

Also — what about the RETRACTED big bar: when scrolled down, big pill slides behind nav. And the compact pill appears. I think asking one more round of questions is warranted for: (a) compact pill content (summary-only click-scroll-top vs interactive segments vs icon-only), (b) handling nav-links collision at lg-xl (hide links in compact state vs icon-only pill). Let me also reconsider threshold/animation — fine to decide myself (reduced-motion respected).

Actually, let me minimize questions: 2 focused questions. Then finalize plan.

Let me also verify the MobileSearchTrigger renders `lg:hidden` and check `search-controls.tsx` FiltersPillButton for reuse, plus check the `.site-header--dark` styles quickly to ensure my header changes don't break tone="dark" pages (dark tone used on... let me grep tone="dark" usage).

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-trigger.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-trigger.tsx</path>
<type>file</type>
<content>
1: import { Search } from "lucide-react";
2: import { Link, useRouterState } from "@tanstack/react-router";
3: import { useTranslation } from "react-i18next";
4: 
5: import { cn } from "@/lib/utils";
6: 
7: /**
8:  * Mobile Airbnb-style search entry: a bordered, card-backed "Start your
9:  * search" bar above the quick-nav pills row (Case / How it works / Become
10:  * tutor) that doubles as the mobile top navigation.
11:  */
12: export function MobileSearchTrigger({
13:   label,
14:   onClick,
15:   className,
16: }: {
17:   label: string;
18:   onClick: () => void;
19:   className?: string;
20: }) {
21:   const { t } = useTranslation();
22:   const pathname = useRouterState({ select: (state) => state.location.pathname });
23:   const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
24: 
25:   const navPills = [
26:     { key: "case", label: t("nav_mobile.case"), to: "/tutor-requests" as const },
27:     { key: "how", label: t("nav.how"), to: "/how-it-works" as const },
28:     { key: "join", label: t("nav.become_tutor"), to: "/join" as const },
29:   ];
30: 
31:   return (
32:     <div className={cn("lg:hidden", className)}>
33:       <button
34:         type="button"
35:         onClick={onClick}
36:         className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
37:       >
38:         <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
39:         <span className="truncate">{label}</span>
40:       </button>
41:       <nav
42:         aria-label={t("nav_mobile.quick_links")}
43:         className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
44:       >
45:         {navPills.map((pill) => {
46:           const active = isActive(pill.to);
47:           return (
48:             <Link
49:               key={pill.key}
50:               to={pill.to}
51:               aria-current={active ? "page" : undefined}
52:               className={cn(
53:                 "shrink-0 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
54:                 active
55:                   ? "border-[1.5px] border-[color:var(--foreground)] bg-card font-bold text-[color:var(--ink)]"
56:                   : "border-border bg-card font-medium text-[color:var(--ink)]/75 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
57:               )}
58:             >
59:               {pill.label}
60:             </Link>
61:           );
62:         })}
63:       </nav>
64:     </div>
65:   );
66: }

(End of file - total 66 lines)
</content>
```

**Tool: grep**

**Input:**
```json
{
  "path": "src",
  "pattern": "tone=\"dark\"|tone={\"dark\"}"
}
```

**Error:**
```
rg: regex parse error:
    (?:tone="dark"|tone={"dark"})
                         ^
error: repetition quantifier expects a valid decimal
```

---

## Assistant (Plan · GLM-5.3-Flash · 3.9s)

**Tool: grep**

**Input:**
```json
{
  "path": "src",
  "pattern": "tone=.dark"
}
```

**Output:**
```
No files found
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css",
  "limit": 50,
  "offset": 628
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css</path>
<type>file</type>
<content>
628:       animation-play-state: paused;
629:       transform: translateX(0);
630:     }
631:   }
632: }
633: 
634: @layer components {
635:   .site-header--dark {
636:     --ink: #e7e9ea;
637:     --foreground: #e7e9ea;
638:     --background: #050505;
639:     --surface-subtle: rgba(255, 255, 255, 0.08);
640:     border-bottom-color: rgba(255, 255, 255, 0.1);
641:     background-color: rgba(5, 5, 5, 0.6) !important;
642:   }
643: 
644:   .site-header--dark .text-brand-gradient {
645:     background-image: linear-gradient(135deg, #8ecdf8 0%, #1d9bf0 100%);
646:   }
647: }
648: 
649: /*
650:  * Dropdown sheets: popper-based dropdowns (searchable selects, lesson mode,
651:  * tag suggestions) always open downwards. On mobile (< lg) the Radix popper
652:  * wrapper is repositioned into a full-width sheet pinned right below the
653:  * sticky nav (64px header + 1px border = 65px), so the search input at the
654:  * top of the dropdown sits directly under the nav bar. `!important` beats
655:  * the inline transform/position styles Radix applies to the wrapper.
656:  */
657: @media (width < 64rem) {
658:   [data-radix-popper-content-wrapper]:has(> .mm-dropdown-sheet) {
659:     position: fixed !important;
660:     top: 65px !important;
661:     left: 0 !important;
662:     right: 0 !important;
663:     width: auto !important;
664:     min-width: 0 !important;
665:     transform: none !important;
666:   }
667: 
668:   [data-radix-popper-content-wrapper] > .mm-dropdown-sheet {
669:     width: 100% !important;
670:     min-width: 0 !important;
671:     max-width: none !important;
672:     border-top-width: 0 !important;
673:     border-right-width: 0 !important;
674:     border-left-width: 0 !important;
675:     border-radius: 0 0 12px 12px !important;
676:   }
677: }

(End of file - total 677 lines)
</content>
```

---

## Assistant (Plan · GLM-5.3-Flash · 137.2s)

_Thinking:_

Good. `tone="dark"` is never used (dead prop, fine). The mobile trigger is `lg:hidden`.

Now, the Airbnb image confirms: the retracted state = compact search pill centered in the nav row between logo and right-side actions.

Key collision issue: our nav has 7 links + logo + account block. The compact pill centered would overlap the links at most widths. I need to ask the user how to handle this. Options:

1. **Compact state replaces nav links with the pill** — Airbnb home does this: logo | compact pill (center) | actions. Nav links only visible at top-of-page (expanded state). This matches the Airbnb image exactly (their header has no nav links). Clean, but loses persistent nav access when scrolled... though mobile bottom nav... this is desktop. Hmm, on Airbnb desktop search pages, there ARE nav links ("Homes", "Experiences") to the RIGHT of the pill. So a hybrid: compact pill center + keep account right; move nav links where?

2. **Compact pill shrinks responsively**: full segment pill at 2xl+, icon-only round pill at lg-xl (no overlap since it's small ~64px). Nav links stay. Airbnb does shrink their pill on narrow viewports (it becomes just the search icon pill). This keeps nav + access to search.

Let me estimate the current nav row width again to see if a compact pill fits at various widths:
- Logo block ~170px (logo icon + "MatchMax" text-xl).
- Nav links: ml-12 (48px) + gap-9 (36px between). Labels: "How it works" (~100px), "Find tutors" (~95), "Courses" (~75), "Saved" (~55), "Become a tutor" (~125), "For business" (~105), "Request a tutor" (~125) ≈ 680px + 216px gaps + 48px ≈ 944px.
- Right side: LanguageToggle (~72px?) + account button w-60 (240px) when signed in, or sign-in link + sign-up button (~230px).
- Total ≈ 170 + 944 + 72 + 240 ≈ 1424px ≈ fits 1440 with px-10 padding (1440-80=1360 content... actually max-w-[1440px] px-10 → content 1360). Hmm 1424 > 1360 — it might already be tight/overflowing? There are gap utilities; sm:gap-4... The `ml-auto flex items-center gap-2 sm:gap-4`. Possibly it already wraps/overflows slightly at 1360? Not my concern now.

Adding a centered compact pill (~360px with segments) → total ~1780 — way over 1360. Even icon-only (~64px) → ~1490 > 1360. So at default lg–2xl widths, something must give. At 2xl (1536px): content = 1440 max-w - 80 = 1360 still (max-w caps at 1440). So even 2xl doesn't help.

=> The only way to fit the Airbnb-style centered compact pill is to make room: hide nav links in compact (scrolled) state. So option 1 is basically required unless the pill is icon-only AND we still need ~130px for icon pill (1490 > 1360, still over!). Even icon-only overflows unless links shrink.

Hmm wait, maybe my estimates are too generous. Let me measure precisely later during implementation (can run the dev server). But roughly: the header is already near-full. So:

**Recommendation**: In compact (scrolled) state, the nav links fade/collapse out and the compact pill occupies the center (like the Airbnb image: logo | pill | actions). At top (expanded), the big pill is in the hero below the nav and the nav shows all links. On scroll-up mid-page, the compact state persists... hmm, but then when scrolled state persists, nav links are hidden until you return to top. Airbnb's actual behavior: on search results pages the header ALWAYS has the compact pill (their results header) and nav links are on the right. On matchmax, keeping links visible is valuable.

Alternative hybrid: compact pill replaces the links but add the links INTO the compact bar? No — overcomplicating.

Wait — actually, let me reconsider. Maybe instead of centering the compact pill, place it to the RIGHT of the nav links (between links and account)? Not what the image shows, but avoids overlap: logo + links left (~1114), pill right (~360) + account (312) = 1786 — still over.

Or: compact pill REPLACES the nav links area but keeps 2-3 priority links? Overcomplicating.

Let me just ask the user. Also confirm compact pill content: Airbnb-style segmented summary (Anywhere|Anytime|Add guests ↔ Keyword|Curriculum|Subject|Mode) that's non-interactive (click → scroll to top & open) vs fully interactive popovers in the header. Interactive = much more code (move pill bar into header state-wise — actually the SAME SearchPillBar component could be rendered in the header with the same draft props passed from the route... The route renders SiteHeader, so it can pass search props... but SiteHeader is generic. Could render compact interactive pill via props drilling: pass a `compactSearch?: ReactNode` slot to SiteHeader. Actually that's elegant: SiteHeader gets an optional `centerSlot` (ReactNode) shown in compact state. The route passes `<CompactSearchBar draft=... onApply=... />` — a compact variant of SearchPillBar (maybe reuse SearchPillBar with compact prop: smaller padding, truncated text, same popovers). Since route owns draft state, wiring works. Rendered ONLY in compact state (scrolled) — it's a separate instance from the big bar; open popovers state separate; fine.

But interactivity in compact: SearchPillBar popovers need `sideOffset` etc. — it'd open downward from header. That's exactly Airbnb (their compact pill opens a big panel below when clicked). Honestly, reusing SearchPillBar with `compact` styling gives us the image's UI almost exactly.

OK — but overlap: with interactive full segments (~360px+) center, links must hide in compact state. So:

**Proposal**: In scrolled/compact state: nav links hidden (fade out), compact SearchPillBar (smaller, truncated segments) centered, logo + actions unchanged. At top: links visible, no compact pill, big pill in hero. Clicking compact pill when collapsed... it's interactive anyway.

Hmm, wait — one more consideration: when user scrolls down and links hide, then scrolls up but NOT to top (mid-page): compact state persists (pill centered). To get links back, scroll to top. Airbnb-ish: on Airbnb, scrolling up on search page shows... their header pill stays always (it IS their results header). For us, acceptable: mid-page scroll-up = compact pill state. Scroll to top = full state.

Simpler alternative that some sites do: compact state ONLY retracts the big bar and shows compact pill; links always visible except at lg where... no, overlap.

Alright, ask the user 2 questions:
1. Nav links in compact/scrolled state: hide them so the centered compact pill fits (like the image), or keep links and use a small icon-only search button instead of a pill?
2. Compact pill behavior: interactive same popovers as the big bar (recommended), or summary-only that scrolls to top when clicked?

Then finalize the plan. Actually also double-check: the user's earlier answer said "make the search bar sticky as well and make an animation to retract the search bar i will show you later i send an image" — image now received = compact pill in nav. Good.

Also — what about the big bar's retraction animation itself: slide up behind nav + fade, spring ~300ms; compact pill fades/scales in. Reduced-motion: snap. Fine, no question needed.

One more thing to verify: FiltersPillButton is next to the big bar (outside the form). In compact state, filters button can stay only in the big bar (scroll away with it) — fine, big bar retains filters. OK.

Also the hero heading area: grey #FEFEFE with the sticky big bar below it. When scrolled past, big bar pins at top-16. The hero's bottom padding provides gap. The sticky bar needs border-b (divider below search) — yes as planned. At top of page: divider below big bar = sticky bar's border-b. But wait — the big bar at top-of-page is at its NATURAL position (below heading), and the sticky wrapper is inside a `<div>` that also contains results. The border-b on sticky wrapper shows at natural position too.

But hmm — subtle: the sticky wrapper spans results; its height = pill height; when pinned, divider travels. Good.

One more edge: on /tutor-requests the top group includes a CTA button "Post your request" and badge; hero includes those; fine, all grey.

Also /tutors hero currently `py-10 sm:py-12` then `<TutorsSearch className="mt-7">`. New structure: hero keeps heading + py-10 sm:py-12 (maybe pb reduced to sm:pb-10?), then sticky bar with py-4? Let me define: hero `pt-10 sm:pt-12 pb-6 sm:pb-8`, sticky bar `py-4` — total spacing similar to before (~48px below heading→pill, 16px pill→divider... previously pill→border was ~48px). Adjust: hero pb-6/8 (24-32px) + bar py-4 (16px top) ≈ 40-48px. Good.

Dark mode for the grey: `--surface-header: #fefefe` light; dark: `#121212`. And the hero + sticky bar use the same token. In dark, no change from today (bg-background). Good.

Also AnnouncementBanner inside header — dark navy #0D1B2A, unaffected.

Now, the compact SearchPillBar variant: needs `compact` prop? I'd create the compact rendering inside the new `StickySearchBar`/`CompactSearchBar` component reusing `SearchPillBar` with a `compact` prop that reduces px/py and hides the big segment text? Airbnb compact shows label-only ("Anywhere | Anytime | Add guests") single-line. Our segments have small label + value (two lines). Compact: single line with value text (or label when unfilled: e.g. "Any subject · Any mode"?). Simplest: compact pill = single-row: show each segment's `display` value separated by dividers, truncate, + search button. Popovers open below as usual. I'll spec: pass `compact` to SearchPillBar: `rounded-full border bg-card px-3 py-2 text-sm` segments with single-line truncated display, hide the tiny label, keep popovers + submit. Actually the popovers' panels are already fixed width (w-[min(24rem,...)]) — fine below nav.

FiltersPillButton in compact: skip (big bar keeps filters). OK.

Animation details:
- `useScrolledPast(threshold)` + `useScrollDirection` hook: `collapsed = scrollY > trigger && direction === down` where trigger = big bar's natural position + ~80px (measure via ref) — simpler: collapse when scrollY > ~120px and scrolling down; expand when scrolling up; at top (scrollY < 80) always expanded.
- Big bar: wrapper class `transition-transform duration-300 ease-out motion-reduce:transition-none` + `data-collapsed` → `-translate-y-full opacity-0` (slides behind opaque nav; nav z-50 > bar z-40). Keep layout space (no jump).
- Compact pill in nav: `motion/react` AnimatePresence fade+scale-in (like the highlight spring style), or CSS transition. Reduced motion: instant.
- pointer-events-none when collapsed on big bar so hidden popovers don't intercept... actually it's translated behind nav — still could capture clicks in its area? Translated -100% puts it above its box (behind nav) — its occupied layout box remains where it was, but visual is behind nav... pointer events follow visual position (transform affects hit-testing), so clicks at its layout box would hit nothing (element moved visually). But clicks BEHIND nav area would hit the nav (z-50, opaque). Fine. Add `pointer-events-none` when collapsed for safety.

Wait, one problem: the big bar is `sticky top-16`. When collapsed (translated -100%), it visually sits behind the nav — nav is 64px tall; bar is ~64px tall too (py-4 + pill 60px + border ≈ 92px?). Bar total height ~ 56+32=88px. Sliding -100% (its own height ~88px) from top-64px → top at -24px: fully behind nav (nav 64px)? -24+88 = 64 → bottom edge exactly at nav bottom. Add slight extra translate or opacity fade to be safe: `-translate-y-full` + opacity-0 handles it.

Hmm, actually — also when collapsed and bar's sticky position: if the page is scrolled such that bar's natural position is way above viewport, sticky keeps it at top-16 → translated behind nav → invisible. Good. If scrolled slightly (bar still near natural position below heading), collapse triggers only after scrollY > threshold (~120px = past heading?). Let me set collapse trigger: scrollY > bar's offsetTop+height (i.e., once bar would be pinned) — simpler: scrollY > 160. Eh, implementation detail; use measured trigger = bar element's top when at scrollY=0 (document position) → collapsed allowed only when scrollY > that. Fine.

z-index: nav dropdown menus (account dropdown) z high; bar z-40 below nav z-50. Popover panels from the pinned big bar: Radix portal z-[9999] — fine.

OK. Also — `mobile-search-overlay` etc. unaffected (lg-only changes).

Also need to keep `TutorsSearch` used by homepage unchanged. Plan: 
- `tutors-search.tsx`: split into `TutorsSearchBar` (desktop row + FiltersDialog) and `TutorsSearchMobile` (trigger + overlay); keep `TutorsSearch` composing both for homepage.
- Same for `courses-search.tsx` and `cases-search.tsx` (check their structure — likely similar; CasesSearch/CoursesSearch each have desktop pill row + mobile overlay).

Let me quickly peek at courses-search.tsx and cases-search.tsx structure to confirm the same pattern (they're smaller). Also check FiltersPillButton in filters-dialog.tsx. Actually for the plan, a quick grep of the top-level return structure suffices. Let me read courses-search.tsx return and cases-search.tsx return quickly.

The image confirms the Airbnb pattern: when scrolled, the search bar retracts into a compact pill centered in the nav row. Let me verify the remaining search components share the same structure.

**Tool: grep**

**Input:**
```json
{
  "path": "src/components/search",
  "pattern": "hidden items-stretch gap-2 lg:flex|lg:hidden|return \\("
}
```

**Output:**
```
Found 32 matches
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/filters-dialog.tsx:
  Line 30:   return (

  Line 106:     return () => {

  Line 134:   return (

  Line 237:   return (

  Line 270:   return (

  Line 279:         return (


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-trigger.tsx:
  Line 31:   return (

  Line 32:     <div className={cn("lg:hidden", className)}>

  Line 47:           return (


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-overlay.tsx:
  Line 64:     return () => {

  Line 94:   return (

  Line 99:         "fixed inset-0 z-[70] flex flex-col bg-[color:var(--surface-subtle)] lg:hidden",


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/tutors-search.tsx:
  Line 356:   return (

  Line 358:       <div className="hidden items-stretch gap-2 lg:flex">

  Line 570:   return (

  Line 662:   return (


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/cases-search.tsx:
  Line 156:   return (

  Line 158:       <div className="hidden items-stretch gap-2 lg:flex">


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-pill-bar.tsx:
  Line 148:     return () => observer.disconnect();

  Line 151:   return (

  Line 181:         return (

  Line 275:   return (


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/courses-search.tsx:
  Line 192:   return (

  Line 194:       <div className="hidden items-stretch gap-2 lg:flex">


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-controls.tsx:
  Line 28:   return (

  Line 39:         return (

  Line 92:   return (

  Line 137:     return (

  Line 143:   return (

  Line 147:         return (

  Line 193:   return (

  Line 254:   return (

```

**Tool: grep**

**Input:**
```json
{
  "path": "src/components/search/filters-dialog.tsx",
  "pattern": "export function|FiltersPillButton"
}
```

**Output:**
```
Found 21 matches
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-pill-bar.tsx:
  Line 64: export function SearchPillBar({

  Line 264: export function KeywordPanelContent({


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/courses-search.tsx:
  Line 16:   FiltersPillButton,

  Line 46: export function CoursesSearch({

  Line 204:         <FiltersPillButton


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/cases-search.tsx:
  Line 53: export function CasesSearch({


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/search-controls.tsx:
  Line 15: export function Segmented<T extends string>({

  Line 63: export function SearchBigInput({

  Line 123: export function OptionRowsList({

  Line 182: export function SuggestedRow({

  Line 218: export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {

  Line 223: export function SearchableOptionsPanel({


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-trigger.tsx:
  Line 12: export function MobileSearchTrigger({


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/tutors-search.tsx:
  Line 28:   FiltersPillButton,

  Line 82: export function TutorsSearch({

  Line 368:         <FiltersPillButton


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/filters-dialog.tsx:
  Line 19: export function FiltersPillButton({

  Line 65: export function FiltersDialog({

  Line 217: export function FiltersSection({

  Line 257: export function FilterQuickPicks({


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-overlay.tsx:
  Line 23: export function MobileSearchOverlay({

```

---

## Assistant (Plan · GLM-5.3-Flash · 1232.7s)

_Thinking:_

All three search components (tutors-search.tsx, courses-search.tsx, cases-search.tsx) share the same structure: a desktop pill row (`hidden items-stretch gap-2 lg:flex` with SearchPillBar + FiltersPillButton) + mobile overlay/trigger.

Now the critical collision question: the compact centered pill in the nav (per the Airbnb image) vs the 7 nav links. My width analysis shows they can't coexist below ~1800px. I need to ask the user how to handle it. Options:

1. **Hide nav links in compact state** (matches the Airbnb image exactly): scrolled → logo | centered compact pill | account actions. Links return at top of page.
2. **Keep links, icon-only compact button**: scrolled → links stay, small round search icon button appears (maybe left of account actions) that scrolls to top / opens search.
3. Keep links and put compact pill on the right... overflows too.

And compact pill interactivity: full interactive popovers (reuse SearchPillBar compact variant) vs summary-only (click scrolls to top).

Let me ask these two questions, then write the final plan. Also double check mobile search overlay `z-[70]` > header z-50 — fine.

Also, before asking — is there an issue with how the compact pill would open popovers downward while it's inside the sticky header? No, Radix portals handle it.

Also think: what threshold collapses the big bar — I'll say: collapse when scrolling down after the big bar has pinned (scrollY beyond its natural top + its height); expand when scrolling up; always expanded near top. Reduced-motion snap. This is implementation detail; no user question needed.

One more thought on where the compact pill lives: SiteHeader needs a slot. Since the route owns draft state, pass `compactSearch?: ReactNode` prop to SiteHeader; route passes the compact pill (which itself is only VISIBLE in collapsed state — visibility driven by a shared scroll context). Simplest wiring: a small context or a custom event? Options:
- `StickySearchProvider` (context with `collapsed: boolean` from a scroll hook) wrapping the page; both SiteHeader (merged variant) and StickySearchBar consume it. SiteHeader renders `compactSearch` node when collapsed && merged variant. Clean.

Simpler alternative without context: StickySearchBar handles both elements? No — compact pill is inside SiteHeader (nav center), big bar outside. Context is cleanest.

Actually even simpler: since SiteHeader is rendered by the same route component, the route could own the scroll state and pass `compactVisible` + node. But then every directory page duplicates the scroll hook. Context provider is cleaner. Plan: `SearchGroupContext` in the new sticky-search-bar module: `useSearchGroup()` returns `{ collapsed }`. `StickySearchGroup` provider component wraps the whole page content (below header? must include SiteHeader to toggle compact pill... provider must wrap SiteHeader too, so route wraps everything: `<StickySearchGroup><SiteHeader merged compactSearch={...}/>...</StickySearchGroup>`).

Hmm, but SiteHeader is `hidden lg:block` on mobile — compact pill only matters on lg. Fine, context works regardless.

Now the questions.

All three search components share the same structure. One conflict from your Airbnb reference: that centered compact pill appears between the logo and the account actions — but the current nav row already fills its width with 7 nav links plus logo and account menu. A centered compact pill would overlap the links at every desktop width. How should that be resolved?

**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "header": "Compact state",
      "options": [
        {
          "description": "Scrolled state = logo | compact search pill (center) | account actions, exactly like your Airbnb image. Nav links return when you scroll back to top.",
          "label": "Hide links when scrolled (Recommended)"
        },
        {
          "description": "Nav links stay visible; the compact state shows only a small round search icon button next to the account menu that scrolls you back to the search bar.",
          "label": "Keep links, icon-only button"
        },
        {
          "description": "Compact pill appears in the center and nav links collapse into a hamburger menu next to the account actions.",
          "label": "Links into hamburger"
        }
      ],
      "question": "When the search bar retracts into the centered compact pill, what happens to the 7 nav links (How it works, Find tutors, …) that currently fill the nav row?"
    },
    {
      "header": "Compact pill",
      "options": [
        {
          "description": "Same segments and popovers as the big bar (keyword / curriculum / subject / mode) in a compact single-line pill, fully usable while scrolled.",
          "label": "Interactive pill (Recommended)"
        },
        {
          "description": "The compact pill just shows a search summary/placeholder text; clicking it scrolls back to the top and expands the big search bar.",
          "label": "Summary only, click = back to top"
        }
      ],
      "question": "What does the compact pill in the nav row do when clicked?"
    }
  ]
}
```

**Output:**
```
User has answered your questions: "When the search bar retracts into the centered compact pill, what happens to the 7 nav links (How it works, Find tutors, …) that currently fill the nav row?"="Hide links when scrolled (Recommended)", "What does the compact pill in the nav row do when clicked?"="expand back again /Users/ryanyeung/Desktop/Screenshot\ 2026-09-19\ at\ 20.47.43.png but this time it tints the rest a bit". You can now continue with the user's answers in mind.
```

---

## Assistant (Plan · GLM-5.3-Flash · 45.1s)

_Thinking:_

The user says the compact pill on click should "expand back again" and references a screenshot. Let me read that image: `/Users/ryanyeung/Desktop/Screenshot 2026-09-19 at 20.47.43.png`. "but this time it tints the rest a bit" — perhaps an Airbnb screenshot showing the expanded search with a dimmed/tinted page behind (Airbnb dims the page content when the search pill is expanded with its big popover panel open). Let me look at the screenshot.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Desktop/Screenshot 2026-09-19 at 20.47.43.png"
}
```

**Output:**
```
Image read successfully
```

---

## Assistant (Plan · GLM-5.3-Flash · 190.8s)

_Thinking:_

The second screenshot shows Airbnb's behavior: clicking the compact search pill expands it back into the full pill bar below the nav (Where | When | Who | Search) with an open panel, AND — "it tints the rest a bit" — the page content behind is dimmed/tinted (the gray overlay over the listing cards). So when the expanded search state is active (from compact), the rest of the page gets a scrim/tint.

So the interaction model (final):
- Top of page (expanded): nav (logo + links + actions, grey, no divider) + hero heading + big pill bar + divider.
- Scroll down past threshold: big bar retracts (slides up behind nav), nav links fade out, compact pill fades in at nav center.
- Click compact pill: expands back to the full search state — the big pill bar appears below the nav (pinned, since we're mid-page), nav links hidden, AND the rest of the page content is tinted (scrim overlay, like Airbnb's dimming) while this expanded-from-compact state is open. Presumably clicking outside/closing the panel or scrolling dismisses it back to compact state.

Airbnb specifics: when you click the compact pill, the header expands into the full-width search bar and a gray scrim covers page content; clicking the scrim closes back to compact.

So the states:
1. `expanded` (top of page): full search in hero, links visible, no tint, no compact pill.
2. `compact` (scrolled): compact pill centered, links hidden, big bar hidden, no tint.
3. `compactExpanded` (clicked compact): full pill bar pinned below nav (the big bar re-expands in its sticky slot at top-16), links hidden, page tinted with scrim; dismiss (scrim click / Esc / scroll?) → back to compact.

Implementation-wise: the big bar's sticky slot at top-16 can re-expand (translate back), links hide, scrim appears. The scrim: fixed inset-0 z-30 (below bar z-40, below nav z-50) bg-foreground/40 or similar with fade transition; click → collapse back to compact.

Wait — but when compactExpanded, does the big bar sit below nav covering content? The sticky slot occupies layout space in flow; when re-expanded, the pill shows at its pinned position (top-16) — content behind it gets pushed... no, no layout change; the bar visually slides back down from behind the nav into its slot. Fine.

Also the divider below the search bar: when compactExpanded with tint, Airbnb's expanded header shows... their expanded state is a full-width band with the pill + tint below. Our big bar has border-b (divider) — keep it; the tint sits below the divider.

Hmm — one question: should `compactExpanded` tint apply also at state 1? No — tint only when expanded from compact (per the user: "but this time it tints the rest a bit"). At top of page there's no tint.

Also — when compactExpanded, should the compact pill morph into the big bar (Airbnb animates the pill growing)? We'll animate: compact pill fades/scales out, big bar slides in. Good enough with motion transitions.

Now — clicking compact pill = expand. The user chose "expand back again" (not interactive popovers in compact). So compact pill is a BUTTON (not interactive segments). Its content: search summary text? Airbnb compact shows "Anywhere | Anytime | Add guests" (segment displays). Ours: show segment display values separated by dividers (or a placeholder). I'll spec: compact pill shows the same segment display texts (keyword/curriculum/subject/mode) truncated, single line, with the circular search button at right — matches image 1. Click → expand (state 3). 

While in state 3 (compactExpanded), does the pill bar remain fully interactive (popovers open)? Yes — it's the big bar; segments clickable, popovers open below the pinned bar over the tinted page. Airbnb does exactly this (their expanded state has working panels). Closing popover doesn't exit state 3; scrim click/Esc does (→ compact). Scrolling: if user scrolls while compactExpanded... Airbnb collapses back? Their scrim scrolls with page; scrolling dismisses expanded state back to compact (or stays expanded?). Simplest: scrolling down while compactExpanded → back to compact (dismiss). Scrolling up → stays. I'll note it.

Alright — also nav links visibility: hidden in compact AND compactExpanded states; visible only in state 1 (top).

Edge: at top (state 1) — big bar in hero (not pinned). If user clicks... nothing else needed.

Now finalize all details and write the plan. Let me also decide the exact component/API breakdown:

### New/changed files

1. **`src/styles.css`**
   - Add tokens: `:root { --surface-header: #fefefe; }` `.dark { --surface-header: #16181a; }` — wait, dark should stay visually same as today: today hero = bg-background (#121212), header = --surface (#121212)/95. So dark `--surface-header: #121212`. Light `#fefefe`.
   - Maybe add `.search-group-scrim` styles or just Tailwind classes inline. No shadows anywhere (respect the design rule).

2. **`src/components/layout/SiteHeader.tsx`**
   - New optional prop: `searchGroup?: { compactSearch: ReactNode; compactVisible: boolean }`? Better: consume the context. Design: 
     - Props: `merged?: boolean` (grey, borderless) and `centerSlot?: ReactNode` (rendered in nav center when compact). Visibility driven by context consumed inside SiteHeader (via `useSearchGroup()`) — but SiteHeader is generic; context hook default returns nulls so other pages unaffected.
   - Structure when merged:
     - header: `sticky top-0 z-50 hidden w-full lg:block bg-[color:var(--surface-header)]` (drop border-b; drop /95+backdrop-blur? keep opaque for clean scrim boundary — actually Airbnb's expanded header is opaque; keep opaque. backdrop-blur unnecessary when opaque; remove both for merged only).
     - nav row: logo left; nav links get `search-group-hidden:opacity-0 pointer-events-none` transition (fade + maybe width collapse? Simple fade/visibility); compact pill container: `absolute left-1/2 top-1/2 -translate-x/y -50%` with AnimatePresence fade/scale in when compact visible.
   - Note: `hidden lg:block` mobile unchanged. MobileBottomNav unchanged.

3. **`src/components/search/sticky-search-group.tsx`** (new)
   - `SearchGroupProvider` + context: `{ phase: "top" | "compact" | "expanded-overlay" }` driven by scroll hooks:
     - `top` when scrollY < threshold (big bar natural position, measured) or scroll-up.
     - `compact` when scrolling down past big-bar trigger.
     - `expanded` (tinted) when compact pill clicked; exits on scrim click / Esc / scroll down.
   - `StickySearchBar`: the sticky wrapper rendering children (desktop row): `sticky top-16 z-40 border-b border-border bg-[color:var(--surface-header)]` + collapse animation (translate/opacity, spring or 300ms ease) + `pointer-events-none` when hidden + reduced-motion snap. Also hosts scrim? Scrim is page-wide fixed z-30, rendered by provider or by StickySearchBar (only on lg).
   - Scroll hook: `useScrollDirection` with rAF throttle, hysteresis (~8px), trigger offset = measured bar top (~bar offsetTop + bar height → collapse only when bar would be pinned), reduced-motion aware.

4. **Search components split** (tutors-search.tsx, courses-search.tsx, cases-search.tsx):
   - Split each `XSearch` into:
     - `XSearchBar` — desktop row (SearchPillBar + FiltersPillButton + FiltersDialog) — goes inside StickySearchBar AND inside the compact pill?? Wait — compact pill is a SUMMARY button (expand on click), not interactive segments. So compact pill doesn't need segments props… but it should display segment summary text. Simplest: compact pill receives a `summary?: string` (e.g., built from draft: "Any curriculum · Any subject · Any mode" or filled values) + label. Each search component builds its summary from draft. 
     - `XSearchMobile` — mobile trigger + overlay (lg:hidden), stays in hero.
     - Keep `XSearch` (composition of both) for the homepage usage.
   - For /tutors: hero keeps `TutorsSearchMobile`; `TutorsSearchBar` moves into StickySearchBar slot.

5. **Compact pill component** (in sticky-search-group.tsx or separate): `CompactSearchPill({ summary, placeholder, onClick })` — rounded-full border bg-card, single-line truncate, circular blue search icon button; AnimatePresence handled in SiteHeader centerSlot.

6. **Route pages**:
   - `tutors.index.tsx`:
     - Wrap content in provider; `<SiteHeader merged centerSlot={<CompactSearchPill .../>}/>`; hero section: `bg-[color:var(--surface-header)]` (grey), remove `border-b` at lg (`lg:border-b-0`? mobile keeps border-b — wait mobile: hero keeps its border-b on mobile; but now mobile hero contains only heading + mobile trigger (desktop row moved out, which was lg-only anyway) — mobile layout unchanged. At lg, hero border removed (divider moves below sticky bar): `border-b border-border lg:border-b-0`. Hmm but then on lg, between hero (grey) and sticky bar (grey) no divider — correct, one group. 
     - Restructure: `<section hero>heading + TutorsSearchMobile</section><div><StickySearchBar><container><TutorsSearchBar/></container></StickySearchBar><section results/></div>`.
     - Spacing: hero `pt-10 sm:pt-12 pb-6 sm:pb-8`; sticky bar `py-4` (tune).
   - Same for `courses.index.tsx`, `tutor-requests.index.tsx` (PageContainer width="default" = max-w-4xl inside sticky bar container; hero grey; note main bg surface-subtle stays below).
   - Homepage `index.tsx` untouched.

7. **Scrim**: `fixed inset-0 z-30 bg-[color:var(--foreground)]/40 transition-opacity` rendered when phase === expanded (lg only); click → phase compact. Respect dark mode (foreground/40 works both). Also lock scroll? Airbnb doesn't lock. Don't lock. Esc handling via keydown.

Hmm wait — z-index check: sticky bar z-40; scrim z-30; nav z-50. Big bar popovers z-[9999] portal — above scrim — correct (Airbnb: panel above scrim). CompareBar/WhatsApp floats? z-40/z-50 — they'd sit above scrim but under... fine, tune if needed during implementation.

One more check — the sticky bar when pinned must NOT show during phase "compact" (hidden) — hidden = translated behind nav. During "expanded-overlay" phase it shows. During "top" it shows (natural or pinned). The provider's `collapsed` = phase === "compact". StickySearchBar consumes context; but ALSO should work standalone without provider (fallback: internal no-op). Fine.

Compact pill visibility: phase === "compact" || phase === "expanded-overlay"? When expanded-overlay, the compact pill morphs into big bar — hide compact pill (fade out) as big bar slides in. So compact pill visible only in "compact".

Nav links visible only in "top" phase.

AnnouncementBanner: part of header; during compact it stays (it's above nav? No — banner is below nav row in header). Header = nav row + banner. Banner height adds to sticky header (~40px when visible) — sticky bar top-16 (64px) would sit UNDER the banner when banner visible (banner is inside header, header is one sticky block: nav 64 + banner ~40 = 104px). Sticky bar top must clear the whole header height. Today hero content just flows below header; header total height = 64 + banner. The sticky bar `top-16` would overlap the banner when it's shown. Solution: measure header height dynamically (ref on header, expose via context) or `top` = header offsetHeight. Simpler: put the sticky bar INSIDE... no. Use context: provider stores header height via ResizeObserver on header element (id/data attr). Or simplest: `top-[var(--header-h)]`... I'll note: sticky top must equal actual header height (64px nav + announcement banner when present) — measure via ref/context (`headerRef` in provider or `document.querySelector('[data-site-header]')`). Implementation detail — flag it in the plan.

Also `scroll-mt` for anchor jumps — not relevant.

RTL/i18n: compact pill text via existing t() strings; summary built from segment displays (already localized).

Dark mode tokens: `--surface-header` dark #121212. Scrim: `bg-black/40` maybe better in dark; use `bg-[color:var(--foreground)]/40`? foreground dark = #e7e9ea (light scrim in dark mode — wrong). Use `bg-black/45 dark:bg-black/60`? Hmm, scrim should darken in both modes: black/40 works universally. Airbnb uses black-ish scrim. Spec: `bg-foreground/50` in light (foreground=dark) and `bg-black/60` in dark... simpler: `bg-black/45` both. I'll spec black scrim.

Also no shadows — all flat/borders. The compact pill uses border like the image (Airbnb image 1 pill has border, no shadow — good).

Verification plan: npx tsc --noEmit; targeted eslint --fix on touched files; npm run build; optionally run vite dev to eyeball (slow cold start ~80-90s, port 3000, kill after) — optional.

Estimates of touched files:
- src/styles.css (token + maybe scrim helper)
- src/components/layout/SiteHeader.tsx
- src/components/search/sticky-search-group.tsx (new)
- src/components/search/tutors-search.tsx, courses-search.tsx, cases-search.tsx (split exports)
- src/routes/tutors.index.tsx, courses.index.tsx, tutor-requests.index.tsx
- i18n: add keys for compact pill aria/labels (en/zh locales — check locale files exist: src/locales or i18n). I'll mention adding keys to translation files.

Risks/notes:
- Header height with announcement banner (dynamic top offset).
- Nav links fade: use opacity + pointer-events-none (keep layout to avoid reflow of logo/actions — links are in normal flow; hiding via opacity keeps space — but then compact pill centered overlaps empty space, fine).
- The compact pill centered: logo left/actions right unchanged.
- Reduced motion: snap transitions.
- Popover panels open from pinned bar — z-[9999] above scrim.
- The `top-16` hardcode vs measured header height (banner) — measure.
- Cases page container max-w-4xl (PageContainer default) — sticky bar container matches page container width so pill aligns with hero pill.

Alright, present the plan. Also mention that SearchPillBar itself stays as-is (the big bar look already matches Airbnb's expanded pill). The compact pill summary: e.g. tutors → "Find tutors · Any curriculum · Any subject · Any mode" — actually use the segment display values joined with "·"? Airbnb compact: "Anywhere | Anytime | Add guests" = segment labels. Ours: label-per-segment would be long (4 segments). Use display values: e.g. keyword "Any keyword"... Actually displays default to placeholders like "Any value". Fine — join with ` · `, truncate. Plus search icon circle.

Let me now write the plan file? Plan mode — I should present the plan as a message (no file edits allowed). Present concisely but complete.

The screenshot confirms the full interaction model: clicking the compact pill expands the search back below the nav and dims ("tints") the page behind it. I now have everything needed for the plan.

# Plan: Grouped grey header + retracting search (desktop, directory pages)

## Behavior (lg+ only; mobile untouched)

**Three states driven by scroll/click:**

1. **Top (expanded)** — nav row (logo + links + account) and the hero section (heading + big pill bar) form one grey `#FEFEFE` block, **no divider between them**; the divider moves to **below the search bar**. Nav links visible, no compact pill.
2. **Scrolled (compact)** — big pill bar retracts (slides up behind the opaque nav, spring ~300ms), the 7 nav links fade out, and a **compact Airbnb-style pill fades in centered** in the nav (segment summary text + circular blue search button, like your image). Big bar keeps its layout space (no content jump) and becomes `pointer-events-none`.
3. **Expanded-from-compact (tinted)** — clicking the compact pill re-expands the big pill bar pinned under the nav, links stay hidden, and a **scrim tints the page** (`fixed inset-0 bg-black/45`, fade in/out, z-index below the bar but above content). Dismiss via scrim click, Esc, or scrolling down → back to state 2. Popover panels (z-[9999] portals) open above the scrim, like Airbnb.

**Scroll logic:** scroll down past the big bar's natural position → compact; scroll up → expand; near top → always expanded. Hysteresis + rAF throttle; `useReducedMotion` snaps instead of animating (same pattern as `SearchPillBar`).

## Changes

**1. `src/styles.css`** — add tokens: `--surface-header: #fefefe` (light), `#121212` (dark, no visual change there). No shadows anywhere (flat rules respected).

**2. `src/components/layout/SiteHeader.tsx`** — new optional `merged` mode (+ `centerSlot` node):
- Grey opaque `bg-[color:var(--surface-header)]`, **remove `border-b`** and the `/95 backdrop-blur` in merged mode; other pages unaffected.
- Nav links get opacity/pointer-events transition (hidden in compact states).
- Compact pill rendered absolutely centered in the nav row with fade/scale animation (motion/react, already in deps).

**3. New `src/components/search/sticky-search-group.tsx`** — context + primitives shared by the 3 pages:
- `SearchGroupProvider` (phase state machine: `top` / `compact` / `expanded`), scroll-direction hook with hysteresis.
- `StickySearchBar`: `sticky z-40 border-b border-border bg-[color:var(--surface-header)]` wrapper that hosts the desktop search row; collapse = `-translate-y-full` + fade behind the nav (z-50 > z-40, so it slides cleanly out of view).
- `CompactSearchPill`: single-line truncated summary + search icon button.
- Sticky `top` offset measured from the real header height (nav 64px + announcement banner when visible — measured, not hardcoded `top-16`).

**4. Split each search component** (`tutors-search.tsx`, `courses-search.tsx`, `cases-search.tsx` — all share the same `hidden lg:flex` row + mobile overlay structure):
- `XSearchBar` = desktop pill row + `FiltersPillButton` + `FiltersDialog` → goes inside `StickySearchBar`.
- `XSearchMobile` = mobile trigger + overlay → stays in the hero (unchanged mobile layout).
- Keep the existing combined `XSearch` for the homepage (untouched).
- Each builds a compact `summary` string from its draft (localized, joined with `·`).

**5. Routes `tutors.index.tsx`, `courses.index.tsx`, `tutor-requests.index.tsx`**:
```
<SearchGroupProvider>
  <SiteHeader merged centerSlot={<CompactSearchPill summary=… onClick=…/>} />
  <section hero — bg surface-header, border-b only on mobile (lg:border-b-0)>heading + XSearchMobile</section>
  <div> ← spans rest of page so sticky persists while scrolling results
    <StickySearchBar><container matching page width><XSearchBar/></container></StickySearchBar>
    <section results/>
  </div>
```
Hero bottom padding tightened so heading → pill spacing matches today; `/tutor-requests` keeps its `PageContainer` width inside the sticky bar; results area below keeps existing backgrounds.

**6. i18n** — add keys for the compact pill (aria label, summary fallback) to the locale files.

## Verification
`npx tsc --noEmit`; targeted `npx eslint --fix` on touched files; `npm run build`. Optional visual check via dev server (slow start, port 3000, kill after).

## Notes / small decisions I made (flag if you disagree)
- Compact pill = **summary button** (click expands), not interactive segments — per your answer.
- Scrim = `black/45` flat tint (no shadow, consistent with the design system).
- While tinted, scrolling down returns to compact (Airbnb-like); scrolling up keeps it open.
- The homepage's floating search over the hero is left exactly as is.

---

## User

Ok go

---

## Assistant (Build · GLM-5.3-Flash · 36.7s)

_Thinking:_

Let me start implementing. First, let me set up a todo list since this is a multi-step task.

Plan recap:
1. `src/styles.css` — add `--surface-header` token (light #fefefe, dark #121212).
2. New `src/components/search/sticky-search-group.tsx` — context + StickySearchBar + CompactSearchPill + scrim + scroll hooks.
3. `src/components/layout/SiteHeader.tsx` — `merged` mode + `centerSlot`.
4. Split search components: tutors-search.tsx, courses-search.tsx, cases-search.tsx → `XSearchBar` + `XSearchMobile`, keep combined `XSearch`.
5. Routes: tutors.index.tsx, courses.index.tsx, tutor-requests.index.tsx restructure.
6. i18n keys for compact pill.
7. Verify: tsc, eslint, build.

Let me first read the remaining files I need: courses-search.tsx, cases-search.tsx, filters-dialog.tsx (FiltersPillButton), search-controls.tsx (briefly), and the i18n locale files. Let me do this in parallel.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Add --surface-header token to styles.css",
      "status": "in_progress",
      "priority": "high"
    },
    {
      "content": "Create sticky-search-group.tsx (context, StickySearchBar, CompactSearchPill, scrim)",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "SiteHeader: merged mode + centerSlot with link fade",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Split tutors-search into TutorsSearchBar + TutorsSearchMobile",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Split courses-search into CoursesSearchBar + CoursesSearchMobile",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Split cases-search into CasesSearchBar + CasesSearchMobile",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Restructure tutors.index.tsx with grouped header",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Restructure courses.index.tsx with grouped header",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Restructure tutor-requests.index.tsx with grouped header",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Add i18n keys for compact pill",
      "status": "pending",
      "priority": "medium"
    },
    {
      "content": "Verify: tsc, targeted eslint, build",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Add --surface-header token to styles.css",
    "status": "in_progress",
    "priority": "high"
  },
  {
    "content": "Create sticky-search-group.tsx (context, StickySearchBar, CompactSearchPill, scrim)",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "SiteHeader: merged mode + centerSlot with link fade",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Split tutors-search into TutorsSearchBar + TutorsSearchMobile",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Split courses-search into CoursesSearchBar + CoursesSearchMobile",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Split cases-search into CasesSearchBar + CasesSearchMobile",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Restructure tutors.index.tsx with grouped header",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Restructure courses.index.tsx with grouped header",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Restructure tutor-requests.index.tsx with grouped header",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Add i18n keys for compact pill",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Verify: tsc, targeted eslint, build",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · GLM-5.3-Flash · 22.5s)

**Tool: glob**

**Input:**
```json
{
  "pattern": "src/locales/*"
}
```

**Output:**
```
No files found
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "src/i18n*"
}
```

**Output:**
```
No files found
```

---

## Assistant (Build · GLM-5.3-Flash · 8.7s)

**Tool: grep**

**Input:**
```json
{
  "path": "src",
  "pattern": "nav\\.become_tutor|nav_mobile\\.case"
}
```

**Output:**
```
Found 3 matches
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/mobile-search-trigger.tsx:
  Line 26:     { key: "case", label: t("nav_mobile.case"), to: "/tutor-requests" as const },

  Line 28:     { key: "join", label: t("nav.become_tutor"), to: "/join" as const },


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx:
  Line 134:               {t("nav.become_tutor")}

```

---

## Assistant (Build · GLM-5.3-Flash · 14.1s)

**Tool: glob**

**Input:**
```json
{
  "pattern": "**/i18n/**"
}
```

**Output:**
```
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/i18n/config.ts
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/i18n/I18nProvider.tsx
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/i18n/locales/zh-HK.json
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/i18n/locales/en.json
```

**Tool: bash**

**Input:**
```json
{
  "command": "grep -rl \"nav.become_tutor\" --include=\"*.json\" --include=\"*.ts\" . 2>/dev/null | grep -v node_modules | grep -v \".next\" | grep -v dist"
}
```

**Output:**
```
(no output)
```

---

## Assistant (Build · GLM-5.3-Flash · 5.4s)

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n \"search_ui\" src/features/i18n/locales/en.json | head -50"
}
```

**Output:**
```
543:  "search_ui": {

```

---

## Assistant (Build · GLM-5.3-Flash · 5.5s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/i18n/locales/en.json",
  "limit": 120,
  "offset": 543
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/i18n/locales/en.json</path>
<type>file</type>
<content>
543:   "search_ui": {
544:     "start_search": "Start your search",
545:     "filters": "Filters",
546:     "clear_all": "Clear all",
547:     "close_search": "Close search",
548:     "segment_keyword": "Keyword",
549:     "segment_curriculum": "Curriculum",
550:     "segment_subject": "Subject",
551:     "segment_mode": "Lesson mode",
552:     "segment_level": "Level",
553:     "segment_district": "District",
554:     "segment_gender": "Gender",
555:     "segment_status": "Tutor status",
556:     "segment_sort": "Sort",
557:     "any_value": "Any",
558:     "any_district": "Any district",
559:     "panel_keyword_title": "Search",
560:     "suggested_subjects": "Suggested subjects",
561:     "suggested_hint": "Filter by subject",
562:     "price_hint": "Hourly rate, per tutor",
563:     "chip_all": "All",
564:     "chip_primary": "Primary",
565:     "chip_junior": "Junior Sec",
566:     "chip_admissions": "Admissions",
567:     "mode_any": "Any",
568:     "mode_online": "Online",
569:     "mode_in_person": "In-person",
570:     "mode_open": "Open",
571:     "gender_any": "Any",
572:     "show_tutors_one": "Show {{count}} tutor",
573:     "show_tutors_other": "Show {{count}} tutors",
574:     "search_tutors": "Search tutors",
575:     "show_courses_plain": "Show courses",
576:     "tab_tutors": "Tutors",
577:     "tab_courses": "Courses",
578:     "search_all_filters": "Search all filters",
579:     "quick_title": "Recommended for you",
580:     "price_min": "Minimum",
581:     "price_max": "Maximum",
582:     "pick_uni": "Uni student",
583:     "pick_examiner": "Examiner",
584:     "pick_full_part": "Full / part-time",
585:     "pick_budget": "Under HK$300",
586:     "tab_cases": "Cases",
587:     "case_other": "Other",
588:     "cases_placeholder": "Search subject, district, keyword…",
589:     "pick_female": "Female",
590:     "pick_male": "Male",
591:     "pick_online": "Online",
592:     "pick_in_person": "In-person",
593:     "gender_title": "Gender",
594:     "status_title": "Tutor status",
595:     "sort_title": "Sort",
596:     "show_tutors": "Show {{count}} tutors"
597:   }
598: }

(End of file - total 598 lines)
</content>
```

---

## Assistant (Build · GLM-5.3-Flash · 3.9s)

_Thinking:_

Now let me read the rest of the files I need: courses-search.tsx, cases-search.tsx, filters-dialog.tsx (FiltersPillButton + FiltersDialog props), and search-controls.tsx exports.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/courses-search.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/courses-search.tsx</path>
<type>file</type>
<content>
1: import { BookOpen, ClipboardList, GraduationCap } from "lucide-react";
2: import { useNavigate } from "@tanstack/react-router";
3: import { useState } from "react";
4: import { useTranslation } from "react-i18next";
5: 
6: import {
7:   PanelLabel,
8:   SearchBigInput,
9:   Segmented,
10:   SuggestedRow,
11:   type OptionRow,
12: } from "./search-controls";
13: import {
14:   FilterQuickPicks,
15:   FiltersDialog,
16:   FiltersPillButton,
17:   FiltersSection,
18: } from "./filters-dialog";
19: import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
20: import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
21: import { setSearchSlideDirection } from "./slide-direction";
22: import { MobileSearchTrigger } from "./mobile-search-trigger";
23: import { SearchableSelect } from "@/components/ui/searchable-select";
24: import { COURSE_LEVEL_OPTIONS, COURSE_MODE_OPTIONS } from "@/features/courses/queries";
25: import { HK_DISTRICTS } from "@/features/tutors/queries";
26: 
27: export type CoursesSearchState = {
28:   subject?: string;
29:   level?: string;
30:   mode?: string;
31:   district?: string;
32:   q?: string;
33: };
34: 
35: type CoursesSearchProps = {
36:   draft: CoursesSearchState;
37:   onDraftChange: (patch: Partial<CoursesSearchState>) => void;
38:   onApply: (override?: Partial<CoursesSearchState>) => void;
39:   onClear: () => void;
40:   subjectOptions: string[];
41:   /** Open the mobile overlay on mount (used when hopping between search tabs). */
42:   defaultOverlayOpen?: boolean;
43:   className?: string;
44: };
45: 
46: export function CoursesSearch({
47:   draft,
48:   onDraftChange,
49:   onApply,
50:   onClear,
51:   subjectOptions,
52:   defaultOverlayOpen,
53:   className,
54: }: CoursesSearchProps) {
55:   const { t } = useTranslation();
56:   const navigate = useNavigate();
57:   const [filtersOpen, setFiltersOpen] = useState(false);
58:   const [pillOpenId, setPillOpenId] = useState<string | null>(null);
59:   const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));
60: 
61:   const levelOptions: OptionRow[] = COURSE_LEVEL_OPTIONS.map((level) => ({
62:     value: level,
63:     label: level,
64:   }));
65:   const districtOptions: OptionRow[] = HK_DISTRICTS.map((district) => ({
66:     value: district,
67:     label: district,
68:   }));
69:   const subjectRows: OptionRow[] = subjectOptions.map((subject) => ({
70:     value: subject,
71:     label: subject,
72:   }));
73: 
74:   const modeSegmentOptions = COURSE_MODE_OPTIONS.map((option) => ({
75:     value: option.value,
76:     label:
77:       option.value === ""
78:         ? t("search_ui.mode_any")
79:         : option.value === "online"
80:           ? t("search_ui.mode_online")
81:           : option.value === "in_person"
82:             ? t("search_ui.mode_in_person")
83:             : t("search_ui.mode_open"),
84:   }));
85: 
86:   const modeDisplay = (() => {
87:     const option = COURSE_MODE_OPTIONS.find((candidate) => candidate.value === (draft.mode ?? ""));
88:     if (!draft.mode || !option) return t("search_ui.any_value");
89:     return option.label;
90:   })();
91: 
92:   const quickPicks = COURSE_LEVEL_OPTIONS.map((level) => ({
93:     id: level,
94:     label: level,
95:     icon: BookOpen,
96:     active: draft.level === level,
97:     onToggle: () => onDraftChange({ level: draft.level === level ? undefined : level }),
98:   }));
99: 
100:   const segments: PillSegment[] = [
101:     {
102:       id: "keyword",
103:       label: t("search_ui.segment_keyword"),
104:       title: t("search_ui.panel_keyword_title"),
105:       display: draft.q?.trim() ? draft.q : "Search course title, subject, keyword…",
106:       filled: Boolean(draft.q?.trim()),
107:       grow: "flex-[1.3]",
108:       content: (
109:         <KeywordPanelContent
110:           value={draft.q ?? ""}
111:           onValueChange={(q) => onDraftChange({ q: q || undefined })}
112:           placeholder="Search course title, subject, keyword…"
113:           ariaLabel="Search courses"
114:         />
115:       ),
116:     },
117:     {
118:       id: "level",
119:       label: t("search_ui.segment_level"),
120:       display: draft.level ?? t("search_ui.any_value"),
121:       filled: Boolean(draft.level),
122:       options: levelOptions,
123:       currentValue: draft.level,
124:       searchPlaceholder: t("search_panel.search_category"),
125:       emptyText: t("search_panel.no_matches"),
126:       onSelect: (value) => onDraftChange({ level: value || undefined }),
127:     },
128:     {
129:       id: "subject",
130:       label: t("search_ui.segment_subject"),
131:       display: draft.subject ?? t("search_ui.any_value"),
132:       filled: Boolean(draft.subject),
133:       options: subjectRows,
134:       currentValue: draft.subject,
135:       searchPlaceholder: t("search_panel.search_subject"),
136:       emptyText: t("search_panel.no_matches"),
137:       onSelect: (value) => onDraftChange({ subject: value || undefined }),
138:     },
139:     {
140:       id: "mode",
141:       label: t("search_ui.segment_mode"),
142:       display: modeDisplay,
143:       filled: Boolean(draft.mode),
144:       panelClassName: "w-[min(24rem,calc(100vw-2rem))]",
145:       content: (
146:         <div className="space-y-3">
147:           <p className="text-sm font-bold text-[color:var(--ink)]">{t("search_ui.segment_mode")}</p>
148:           <Segmented
149:             aria-label={t("search_ui.segment_mode")}
150:             value={draft.mode ?? ""}
151:             onChange={(mode) => onDraftChange({ mode: mode || undefined })}
152:             options={modeSegmentOptions}
153:           />
154:         </div>
155:       ),
156:     },
157:   ];
158: 
159:   const overlayTabs: MobileSearchTab[] = [
160:     {
161:       id: "tutors",
162:       label: t("search_ui.tab_tutors"),
163:       icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
164:       active: false,
165:       onSelect: () => {
166:         setSearchSlideDirection("prev");
167:         void navigate({
168:           to: "/tutors",
169:           search: { q: draft.q, subject: draft.subject, mode: draft.mode, open: true },
170:         });
171:       },
172:     },
173:     {
174:       id: "courses",
175:       label: t("search_ui.tab_courses"),
176:       icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
177:       active: true,
178:       onSelect: () => {},
179:     },
180:     {
181:       id: "cases",
182:       label: t("search_ui.tab_cases"),
183:       icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
184:       active: false,
185:       onSelect: () => {
186:         setSearchSlideDirection("next");
187:         void navigate({ to: "/tutor-requests", search: { q: draft.q, open: true } });
188:       },
189:     },
190:   ];
191: 
192:   return (
193:     <div className={className}>
194:       <div className="hidden items-stretch gap-2 lg:flex">
195:         <SearchPillBar
196:           segments={segments}
197:           submitLabel={t("search_panel.search")}
198:           submitColor="blue"
199:           onSubmit={() => onApply()}
200:           className="min-w-0 flex-1"
201:           openSegmentId={pillOpenId}
202:           onOpenSegmentIdChange={setPillOpenId}
203:         />
204:         <FiltersPillButton
205:           label={t("search_ui.filters")}
206:           count={draft.district ? 1 : undefined}
207:           onClick={() => {
208:             setPillOpenId(null);
209:             setFiltersOpen(true);
210:           }}
211:         />
212:       </div>
213: 
214:       <FiltersDialog
215:         open={filtersOpen}
216:         onOpenChange={setFiltersOpen}
217:         clearLabel={t("search_ui.clear_all")}
218:         applyLabel={t("search_ui.show_courses_plain")}
219:         onClear={onClear}
220:         onApply={() => onApply()}
221:       >
222:         <FiltersSection id="recommended" title={t("search_ui.quick_title")}>
223:           <FilterQuickPicks options={quickPicks} />
224:         </FiltersSection>
225:         <FiltersSection id="district" title={t("search_ui.segment_district")}>
226:           <SearchableSelect
227:             value={draft.district ?? ""}
228:             onChange={(value) => onDraftChange({ district: value || undefined })}
229:             options={[{ value: "", label: t("search_ui.any_district") }, ...districtOptions]}
230:             placeholder={t("search_ui.any_district")}
231:             searchPlaceholder={t("search_panel.search_subject")}
232:             className="h-11 rounded-xl"
233:           />
234:         </FiltersSection>
235:       </FiltersDialog>
236: 
237:       <MobileSearchTrigger
238:         label={t("search_ui.start_search")}
239:         onClick={() => setOverlayOpen(true)}
240:       />
241: 
242:       <MobileSearchOverlay
243:         open={overlayOpen}
244:         onOpenChange={setOverlayOpen}
245:         tabs={overlayTabs}
246:         clearLabel={t("search_ui.clear_all")}
247:         submitLabel={t("search_ui.show_courses_plain")}
248:         onClear={onClear}
249:         onSubmit={() => {
250:           onApply();
251:           setOverlayOpen(false);
252:         }}
253:       >
254:         <div className="space-y-6">
255:           <div>
256:             <p className="mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]">
257:               {t("search_ui.panel_keyword_title")}
258:             </p>
259:             <SearchBigInput
260:               value={draft.q ?? ""}
261:               onValueChange={(q) => onDraftChange({ q: q || undefined })}
262:               onEnter={() => onApply()}
263:               placeholder="Search course title, subject, keyword…"
264:               ariaLabel="Search courses"
265:             />
266:           </div>
267: 
268:           <div className="space-y-1.5">
269:             <PanelLabel>{t("search_ui.segment_level")}</PanelLabel>
270:             <SearchableSelect
271:               value={draft.level ?? ""}
272:               onChange={(value) => onDraftChange({ level: value || undefined })}
273:               options={levelOptions}
274:               placeholder="Any level"
275:               searchPlaceholder={t("search_panel.search_category")}
276:               className="h-12 rounded-2xl"
277:             />
278:           </div>
279: 
280:           {subjectRows.length > 0 ? (
281:             <div className="space-y-1">
282:               <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
283:               <div className="-mx-2">
284:                 {subjectRows.slice(0, 5).map((option) => (
285:                   <SuggestedRow
286:                     key={option.value}
287:                     title={option.label}
288:                     hint={t("search_ui.suggested_hint")}
289:                     onClick={() => {
290:                       onApply({ subject: option.value });
291:                       setOverlayOpen(false);
292:                     }}
293:                   />
294:                 ))}
295:               </div>
296:             </div>
297:           ) : null}
298: 
299:           <div className="space-y-2">
300:             <PanelLabel>{t("search_ui.segment_mode")}</PanelLabel>
301:             <Segmented
302:               aria-label={t("search_ui.segment_mode")}
303:               value={draft.mode ?? ""}
304:               onChange={(mode) => onDraftChange({ mode: mode || undefined })}
305:               options={modeSegmentOptions}
306:             />
307:           </div>
308: 
309:           <div className="space-y-1.5">
310:             <PanelLabel>{t("search_ui.segment_district")}</PanelLabel>
311:             <SearchableSelect
312:               value={draft.district ?? ""}
313:               onChange={(value) => onDraftChange({ district: value || undefined })}
314:               options={[{ value: "", label: t("search_ui.any_district") }, ...districtOptions]}
315:               placeholder={t("search_ui.any_district")}
316:               searchPlaceholder={t("search_panel.search_subject")}
317:               className="h-12 rounded-2xl"
318:             />
319:           </div>
320:         </div>
321:       </MobileSearchOverlay>
322:     </div>
323:   );
324: }

(End of file - total 324 lines)
</content>
```

---

## Assistant (Build · GLM-5.3-Flash · 8.0s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/cases-search.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/cases-search.tsx</path>
<type>file</type>
<content>
1: import { ClipboardList, GraduationCap, BookOpen } from "lucide-react";
2: import { useNavigate } from "@tanstack/react-router";
3: import { useState } from "react";
4: import { useTranslation } from "react-i18next";
5: 
6: import { PanelLabel, SearchBigInput, SuggestedRow, type OptionRow } from "./search-controls";
7: import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
8: import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
9: import { setSearchSlideDirection } from "./slide-direction";
10: import { MobileSearchTrigger } from "./mobile-search-trigger";
11: import { SearchableSelect } from "@/components/ui/searchable-select";
12: import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
13: import { HK_DISTRICTS } from "@/features/tutors/queries";
14: 
15: export type CasesSearchState = {
16:   q?: string;
17:   category?: string;
18:   district?: string;
19: };
20: 
21: const CASE_CATEGORY_VALUES = [
22:   "IB",
23:   "DSE",
24:   "IGCSE",
25:   "AP",
26:   "A-Level",
27:   "Primary School",
28:   "Junior Secondary",
29:   "Admissions",
30:   "Other",
31: ];
32: 
33: const caseCategoryLabel = (value: string, t: (key: string) => string) => {
34:   if (value === "Primary School") return t("search_panel.category_primary_school");
35:   if (value === "Junior Secondary") return t("search_panel.category_junior_secondary");
36:   if (value === "Admissions") return t("search_panel.category_admissions");
37:   if (value === "Other") return t("search_ui.case_other");
38:   return value;
39: };
40: 
41: type CasesSearchProps = {
42:   draft: CasesSearchState;
43:   onDraftChange: (patch: Partial<CasesSearchState>) => void;
44:   onApply: (override?: Partial<CasesSearchState>) => void;
45:   onClear: () => void;
46:   subjectOptions: string[];
47:   /** Open the mobile overlay on mount (used when hopping between search tabs). */
48:   defaultOverlayOpen?: boolean;
49:   className?: string;
50: };
51: 
52: /** Same Airbnb-style search pattern as the tutors/courses directories, for the case board. */
53: export function CasesSearch({
54:   draft,
55:   onDraftChange,
56:   onApply,
57:   onClear,
58:   subjectOptions,
59:   defaultOverlayOpen,
60:   className,
61: }: CasesSearchProps) {
62:   const { t } = useTranslation();
63:   const navigate = useNavigate();
64:   const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));
65: 
66:   const categoryOptions: OptionRow[] = CASE_CATEGORY_VALUES.map((value) => ({
67:     value,
68:     label: caseCategoryLabel(value, t),
69:   }));
70:   const districtOptions: OptionRow[] = HK_DISTRICTS.map((district) => ({
71:     value: district,
72:     label: district,
73:   }));
74: 
75:   const segments: PillSegment[] = [
76:     {
77:       id: "keyword",
78:       label: t("search_ui.segment_keyword"),
79:       title: t("search_ui.panel_keyword_title"),
80:       display: draft.q?.trim() ? draft.q : t("search_ui.cases_placeholder"),
81:       filled: Boolean(draft.q?.trim()),
82:       grow: "flex-[1.3]",
83:       content: (
84:         <KeywordPanelContent
85:           value={draft.q ?? ""}
86:           onValueChange={(q) => onDraftChange({ q: q || undefined })}
87:           placeholder={t("search_ui.cases_placeholder")}
88:           ariaLabel={t("search_ui.cases_placeholder")}
89:         />
90:       ),
91:     },
92:     {
93:       id: "category",
94:       label: t("search_ui.segment_curriculum"),
95:       display: draft.category ? caseCategoryLabel(draft.category, t) : t("search_ui.any_value"),
96:       filled: Boolean(draft.category),
97:       options: categoryOptions,
98:       currentValue: draft.category,
99:       searchPlaceholder: t("search_panel.search_category"),
100:       emptyText: t("search_panel.no_matches"),
101:       onSelect: (value) => onDraftChange({ category: value || undefined }),
102:     },
103:     {
104:       id: "district",
105:       label: t("search_ui.segment_district"),
106:       display: draft.district ?? t("search_ui.any_value"),
107:       filled: Boolean(draft.district),
108:       options: districtOptions,
109:       currentValue: draft.district,
110:       searchPlaceholder: t("search_panel.search_subject"),
111:       emptyText: t("search_panel.no_matches"),
112:       onSelect: (value) => onDraftChange({ district: value || undefined }),
113:     },
114:   ];
115: 
116:   const overlayTabs: MobileSearchTab[] = [
117:     {
118:       id: "tutors",
119:       label: t("search_ui.tab_tutors"),
120:       icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
121:       active: false,
122:       onSelect: () => {
123:         setSearchSlideDirection("prev");
124:         void navigate({
125:           to: "/tutors",
126:           search: { q: draft.q, mode: undefined, subject: undefined, open: true },
127:         });
128:       },
129:     },
130:     ...(CENTRE_MARKET_ENABLED
131:       ? [
132:           {
133:             id: "courses",
134:             label: t("search_ui.tab_courses"),
135:             icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
136:             active: false,
137:             onSelect: () => {
138:               setSearchSlideDirection("prev");
139:               void navigate({
140:                 to: "/courses",
141:                 search: { q: draft.q, subject: undefined, mode: undefined, open: true },
142:               });
143:             },
144:           },
145:         ]
146:       : []),
147:     {
148:       id: "cases",
149:       label: t("search_ui.tab_cases"),
150:       icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
151:       active: true,
152:       onSelect: () => {},
153:     },
154:   ];
155: 
156:   return (
157:     <div className={className}>
158:       <div className="hidden items-stretch gap-2 lg:flex">
159:         <SearchPillBar
160:           segments={segments}
161:           submitLabel={t("search_panel.search")}
162:           submitColor="blue"
163:           onSubmit={() => onApply()}
164:           className="min-w-0 flex-1"
165:         />
166:       </div>
167: 
168:       <MobileSearchTrigger
169:         label={t("search_ui.start_search")}
170:         onClick={() => setOverlayOpen(true)}
171:       />
172: 
173:       <MobileSearchOverlay
174:         open={overlayOpen}
175:         onOpenChange={setOverlayOpen}
176:         tabs={overlayTabs}
177:         clearLabel={t("search_ui.clear_all")}
178:         submitLabel={t("search_panel.search")}
179:         onClear={onClear}
180:         onSubmit={() => {
181:           onApply();
182:           setOverlayOpen(false);
183:         }}
184:       >
185:         <div className="space-y-6">
186:           <div>
187:             <p className="mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]">
188:               {t("search_ui.panel_keyword_title")}
189:             </p>
190:             <SearchBigInput
191:               value={draft.q ?? ""}
192:               onValueChange={(q) => onDraftChange({ q: q || undefined })}
193:               onEnter={() => onApply()}
194:               placeholder={t("search_ui.cases_placeholder")}
195:               ariaLabel={t("search_ui.cases_placeholder")}
196:             />
197:           </div>
198: 
199:           <div className="space-y-1.5">
200:             <PanelLabel>{t("search_ui.segment_curriculum")}</PanelLabel>
201:             <SearchableSelect
202:               value={draft.category ?? ""}
203:               onChange={(value) => onDraftChange({ category: value || undefined })}
204:               options={[{ value: "", label: t("search_panel.any_category") }, ...categoryOptions]}
205:               placeholder={t("search_panel.any_category")}
206:               searchPlaceholder={t("search_panel.search_category")}
207:               className="h-12 rounded-2xl"
208:             />
209:           </div>
210: 
211:           {subjectOptions.length > 0 ? (
212:             <div className="space-y-1">
213:               <PanelLabel>{t("search_ui.suggested_subjects")}</PanelLabel>
214:               <div className="-mx-2">
215:                 {subjectOptions.slice(0, 5).map((subject) => (
216:                   <SuggestedRow
217:                     key={subject}
218:                     title={subject}
219:                     hint={t("search_ui.suggested_hint")}
220:                     onClick={() => {
221:                       onApply({ q: subject });
222:                       setOverlayOpen(false);
223:                     }}
224:                   />
225:                 ))}
226:               </div>
227:             </div>
228:           ) : null}
229: 
230:           <div className="space-y-1.5">
231:             <PanelLabel>{t("search_ui.segment_district")}</PanelLabel>
232:             <SearchableSelect
233:               value={draft.district ?? ""}
234:               onChange={(value) => onDraftChange({ district: value || undefined })}
235:               options={[{ value: "", label: t("search_ui.any_district") }, ...districtOptions]}
236:               placeholder={t("search_ui.any_district")}
237:               searchPlaceholder={t("search_panel.search_subject")}
238:               className="h-12 rounded-2xl"
239:             />
240:           </div>
241:         </div>
242:       </MobileSearchOverlay>
243:     </div>
244:   );
245: }

(End of file - total 245 lines)
</content>
```

---

## Assistant (Build · GLM-5.3-Flash · 8.4s)

_Thinking:_

Now let me read filters-dialog.tsx (FiltersPillButton + FiltersDialog) to understand props, then start implementing.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/filters-dialog.tsx",
  "limit": 70
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/filters-dialog.tsx</path>
<type>file</type>
<content>
1: import { SlidersHorizontal, X } from "lucide-react";
2: import {
3:   createContext,
4:   useContext,
5:   useEffect,
6:   useMemo,
7:   useRef,
8:   useState,
9:   type ComponentType,
10:   type ReactNode,
11: } from "react";
12: import { useTranslation } from "react-i18next";
13: 
14: import { cn } from "@/lib/utils";
15: import { Button } from "@/components/ui/button";
16: import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
17: 
18: /** The standalone "Filters" pill that sits beside the search bar. */
19: export function FiltersPillButton({
20:   label,
21:   count,
22:   onClick,
23:   className,
24: }: {
25:   label: string;
26:   count?: number;
27:   onClick: () => void;
28:   className?: string;
29: }) {
30:   return (
31:     <Button
32:       type="button"
33:       variant="outline"
34:       onClick={onClick}
35:       className={cn(
36:         "h-auto shrink-0 gap-2 self-stretch rounded-full border-border bg-card px-5 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
37:         className,
38:       )}
39:     >
40:       <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
41:       <span className="truncate">{label}</span>
42:       {count ? (
43:         <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-link)] px-1.5 text-[11px] font-bold text-white">
44:           {count}
45:         </span>
46:       ) : null}
47:     </Button>
48:   );
49: }
50: 
51: type SectionMeta = { id: string; title: string };
52: 
53: type FiltersSectionContextValue = {
54:   register: (meta: SectionMeta, element: HTMLElement) => () => void;
55:   focusId: string | null;
56: };
57: 
58: const FiltersSectionContext = createContext<FiltersSectionContextValue | null>(null);
59: 
60: /**
61:  * Airbnb-style filters modal: centered title, "Search all filters" jump bar,
62:  * scrollable body, sticky footer. Sections register themselves so the search
63:  * bar can scroll + flash the matching one.
64:  */
65: export function FiltersDialog({
66:   open,
67:   onOpenChange,
68:   title,
69:   clearLabel,
70:   applyLabel,

(Showing lines 1-70 of 314. Use offset=71 to continue.)
</content>
```

---

## Assistant (Build · GLM-5.3-Flash · 350.0s)

_Thinking:_

Now I have everything. Let me start implementing.

### Step 1: styles.css token

Add to `:root`:
```css
  /* Search-group header block (nav + directory search band) */
  --surface-header: #fefefe;
```
And in `.dark`:
```css
  --surface-header: #121212;
```

### Step 2: sticky-search-group.tsx

Key design:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
```

Phases: `"top" | "compact" | "expanded"`.

State machine:
- Provider holds `phase`.
- Effect: scroll listener (rAF-throttled) computing direction & position.
  - If phase === "expanded": scrolling down (delta > hysteresis) → setPhase("compact"). Scrolling up → stay expanded. 
  - Else: if scrollY > trigger → phase "compact" (when scrolling down) — actually standard: if scrolling down && scrollY > trigger → compact; if scrolling up (any) → top?? No — scrolling up mid-page shouldn't reveal the big bar; it should stay compact (or expand?). Hmm.

Wait, reconsider. Earlier I said: scroll down → compact; scroll up → expand (state top). But "top" phase shows nav links — mid-page scroll-up showing links + big bar pinned = fine actually? But then the user scrolls up mid-page, big bar appears pinned with links hidden... hmm links should show in "top" phase.

Let me re-think about what's most Airbnb-like AND simple:

Airbnb home: scroll down → compact; scroll up → expanded (full pill). Always. On their search results page, expanded is default regardless of scroll.

For us: scroll up mid-page → expand (big bar pinned at its sticky slot below nav; nav links... hmm if links visible mid-page it looks like the top-of-page state but content is mid-scroll — that's fine and matches Airbnb's scroll-up behavior).

So simplified: phase = scrolling down && past-trigger → "compact"; otherwise "top". Plus manual "expanded" overlay when compact clicked. Wait — but then what's the difference between "top" and the expanded-from-compact overlay? The tint. And links hidden. So three phases:

- `top`: scrollY <= trigger (or scrolling up). Links visible, big bar visible, no scrim, compact hidden.
- `compact`: scrolling down && scrollY > trigger && not expanded. Links hidden, big bar hidden (translated behind nav), compact visible, no scrim.
- `expandedOverlay`: user clicked compact. Links hidden, big bar visible (pinned), scrim visible, compact hidden. Exit: scrim click/Esc/scroll-down → compact.

Transition trigger→top: when scrolling up, scrollY may be way below trigger; phase becomes "top" — but the big bar pinned at sticky top-16... its natural position: sticky element pins when scrollY > its natural top. At scrollY mid-page, the sticky bar IS pinned (top-16) — good. When user continues scrolling up toward top, bar unpins to natural position. Good.

Edge: user at scrollY mid-page expands overlay, clicks scrim → compact. Fine.

Scroll listener with direction detection:
```ts
const lastY = useRef(0);
const onScroll = () => {
  const y = window.scrollY;
  const delta = y - lastY.current;
  lastY.current = y;
  // hysteresis
  if (phase === "expandedOverlay") {
    if (delta > 4) setPhase("compact"); // scroll down dismisses
    return;
  }
  if (y <= trigger) { setPhase("top"); return; }  // trigger measured
  if (delta > 4) setPhase("compact");
  else if (delta < -4) setPhase("top");
};
```
Hmm — but during "expandedOverlay" scroll-down dismisses to compact; scroll-up keeps. OK.

Wait, there's an issue with setPhase inside scroll listener using stale `phase` closure — use functional updates or refs. I'll keep `phaseRef` synced, or use `setPhase(prev => ...)` pattern with functional updates.

Trigger measurement: the big bar's document position + height (collapse only once bar would be pinned, i.e., once scrollY >= barTop - headerH). Use ref on StickySearchBar element; measure `offsetTop` (relative to document: getBoundingClientRect().top + scrollY, measured on mount + resize). Actually simpler: measure on mount and on resize: `barEl.getBoundingClientRect().top + window.scrollY` = document top of bar. Trigger = that - headerHeight (so collapse starts right when the bar hits the nav). Plus a small buffer (e.g., 16px past) to avoid flicker at boundary.

headerHeight: measure header element. SiteHeader root gets `data-slot="site-header"`? For provider measuring, simplest: query `document.querySelector("header")`? SiteHeader renders `<header>`. On directory pages it's the only `<header>`... risky but ok. Better: provider accepts `headerRef`? The route wraps `<SiteHeader>` inside provider; provider can query its own DOM subtree via a wrapper div ref and `querySelector("header")`. Provider renders children directly (no wrapper) — context + effects. Hmm, simplest robust: provider uses `useSyncExternalStore`-less approach: on mount, find header: `document.querySelector('[data-site-header]')` — I'll add `data-site-header` attr to SiteHeader root. Measure with ResizeObserver → headerH state. Default 64.

Sticky top: `style={{ top: headerH }}`? With banner, header height = 64 + banner(≈41 when visible) ≈ 105. Sticky top = headerH. Transition: when banner dismissed, header height changes → ResizeObserver updates. Good.

But wait: banner visible at top; when scrolled, banner stays visible too (part of sticky header). Airbnb has no banner. Keep it — sticky bar top = header height. Fine.

Actually — hmm, one nuance: with sticky `top: headerH`, when at "top" phase and scrollY < bar natural top, bar is in flow (its sticky top doesn't matter). Good.

Scrim: rendered inside StickySearchBar? The scrim should cover the page below header, z between content and bar. `fixed inset-0 z-30 bg-black/45 lg:block` + `data-[state]` fade. Render when phase === "expandedOverlay". Click → setPhase("compact"). Esc keydown → compact. z-30: below bar (z-40), below nav (z-50); above content (content z-auto) and above mobile stuff? lg only anyway (provider active only on lg pages... but the provider runs on mobile too since it wraps the page — scroll events on mobile would toggle phases! Need to guard: only enable scroll logic on lg+ (matchMedia("(min-width: 1024px)")). On mobile: phase forced "top" — everything renders as before (StickySearchBar is `hidden lg:block`? No wait — StickySearchBar is the sticky wrapper; on mobile the desktop row inside is `hidden lg:flex` and mobile trigger is separate. If StickySearchBar wrapper is `hidden lg:block`, then on mobile it renders nothing — but the wrapper also carries the border-b divider below search on desktop... on mobile the hero keeps its own border-b. OK: StickySearchBar root: `hidden lg:block sticky z-40 border-b border-border bg-[color:var(--surface-header)]`. On mobile → display:none, not sticky. 

And provider scroll logic gated by matchMedia lg.

Compact pill (in SiteHeader center): summary + icon; onClick → phase "expandedOverlay". Visible only when phase === "compact" (AnimatePresence). aria-label i18n key.

Where does compact pill's summary text come from? Props from route: `summary?: string`. Route builds from draft: e.g. tutors: `[category/subject/q/mode displays].join(" · ")`? Simpler: pass `segments` displays? To avoid over-coupling, route passes a localized string. For tutors page I'll build: keyword q or t(any), category label, subject, mode display. Hmm — that's essentially `modeDisplay` etc. Let me create a helper in each search component file: `export function buildTutorsCompactSummary(draft, t): string`. Or simpler: the CompactSearchPill takes `summary?: string` and falls back to `t("search_ui.compact_placeholder")` ("Search tutors" / "Search courses" / "Search requests"). I'll compute summary in route from draft values:

tutors: 
```ts
const compactSummary = [
  draft.q?.trim(),
  draft.category ? categoryLabel(draft.category) : "",
  draft.subject,
  modeFilled ? modeDisplay : "",
].filter(Boolean).join(" · ") || t("search_ui.search_tutors");
```
Hmm modeDisplay already = "Any" when unfilled. Let me just include display when `filled`. Wait simpler: `draft.mode ? modeDisplay : ""`. OK.

But the route component for tutors doesn't have categoryLabel (it's in tutors-search). I'll export summary builders from the search files. Let me keep it simple: each XSearchBar file exports `buildXSummary(draft: XSearchState): string` using its own t(). Then route: `summary={buildTutorsCompactSummary(draft)}`.

Hmm wait — actually cleaner: put the summary builder inside each search component file since they own the label logic.

CompactSearchPill:
```tsx
export function CompactSearchPill({ summary, onExpand }: { summary: string; onExpand: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onExpand} aria-label={t("search_ui.expand_search")} className="flex h-12 max-w-[min(40rem,calc(100vw-24rem))] items-center gap-1 rounded-full border border-border bg-card p-1 pr-1.5 text-left transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:...">
      <span className="min-w-0 flex-1 truncate px-4 text-sm font-semibold text-[color:var(--ink)]">{summary}</span>
      <Button type="button" variant="solid" color="blue" shape="pill" aria-hidden tabIndex={-1} className="h-8 w-8 shrink-0 rounded-full p-0"><Search className="h-3.5 w-3.5"/></Button>
    </button>
  );
}
```
Actually the whole pill is a button; inner Button would be nested button — invalid HTML. Use span styled as circle inside. Like the image: circular azure search button at right. I'll use a `<span>` with the azure bg.

Hover state: Airbnb's compact pill gets a grey wash on hover — `hover:bg-[color:var(--surface-subtle)]`... the pill bg is white card on #FEFEFE header. OK.

StickySearchBar:
```tsx
export function StickySearchBar({ children, className }: { children: ReactNode; className?: string }) {
  const { collapsed } = useSearchGroup(); // collapsed = phase === "compact"
  const prefersReducedMotion = useReducedMotion();
  return (
    <div
      className={cn(
        "sticky z-40 hidden border-b border-border bg-[color:var(--surface-header)] lg:block",
        className,
      )}
      style={{ top: headerTop }} // from context
      data-collapsed={collapsed || undefined}
    >
      <div className={cn("transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none", collapsed && (prefersReducedMotion ? "opacity-0" : "-translate-y-[110%] opacity-0"), !collapsed && "pointer-events-auto", collapsed && "pointer-events-none")}>
        {children}
      </div>
    </div>
  );
}
```
Wait — outer is sticky with fixed height content; the inner translates. Outer height stays (layout preserved). When collapsed, inner translated up behind nav (nav z-50 opaque #FEFEFE — opaque! good) and faded. pointer-events-none on inner when collapsed.

Hmm — actually translate on inner div: outer sticky box height = inner height. Inner translated -110% moves visually above outer box → behind nav (nav above in z). But wait, the outer box's overflow visible — translated inner renders OUTSIDE the outer box, over the nav area. nav z-50 > outer z-40 → nav paints on top. inner opacity-0 anyway. Good.

Also add `will-change`? Not necessary.

The collapse animation with reduced motion: just opacity-0 (snap). With motion: translate+fade 300ms.

Actually — should the whole collapse be driven by context `collapsed`? StickySearchBar consumes context; but ALSO StickySearchBar needs the header height. Context value: `{ phase, collapsed, expand, collapse, headerHeight }`.

Provider must be OUTSIDE SiteHeader (SiteHeader consumes for links+compact) — and outside the content (StickySearchBar + scrim). So route: `<SearchGroupProvider><SiteHeader merged centerSlot=.../>...<StickySearchBar>...</StickySearchBar>...</SearchGroupProvider>`.

Provider also renders the scrim? Put scrim in provider? Provider renders `children` only... I can have provider render a scrim element before children — but scrim z-30 fixed. Hmm, provider returning a fragment with scrim + children is fine. But scrim only on lg (`hidden lg:block`). And only when phase expandedOverlay. Click handler + Esc effect. I'll render scrim inside provider — actually cleaner in StickySearchBar? No—StickySearchBar is hidden lg:block... scrim inside it inherits display none on mobile — good actually! But StickySearchBar must exist for scrim... it does on all 3 pages. OK scrim inside StickySearchBar root (which is `hidden lg:block` → scrim hidden on mobile automatically). 

Esc effect in provider (lg-gated).

Now `collapsed` for SiteHeader links: links visible when phase === "top". Context consumed in SiteHeader only when `merged` — otherwise hook returns default (phase "top", collapsed false) via default context value. Default context: `{ phase: "top", collapsed: false, headerHeight: 64, expand: noop, collapse: noop }` so non-directory pages work without provider.

matchMedia gating: subscribe `(min-width: 1024px)`; if not lg → force phase "top" & skip scroll listener.

Trigger measurement details:
- Provider refs: it needs the bar element's document top. StickySearchBar registers itself via context method `registerBar(el)`. Or provider queries `[data-sticky-search-bar]` after mount. I'll use a callback registration: context `{ registerBar: (el: HTMLElement | null) => void }` — StickySearchBar calls it in ref. Then measure: `el.getBoundingClientRect().top + window.scrollY - headerHeight` → trigger. Measure on mount + resize + when header height changes. Also fonts loading may change position — also measure on first scroll? Simpler: measure lazily on each scroll event? getBoundingClientRect on scroll = layout read every scroll frame — fine perf-wise actually (single read, no thrash since we don't write layout). Airbnb-ish sites do this. To keep simple + robust: compute trigger in the scroll handler: `const barTop = barRef.current.getBoundingClientRect().top + y` then `collapsed target = y > barTop - headerH - 8`. Single rAF-batched read per frame. OK.

Actually simpler: trigger = scrollY such that bar's rect.top (viewport) <= headerH + 8. i.e., in handler: `const rect = barEl.getBoundingClientRect(); const pinned = rect.top <= headerH + 8;` But when collapsed (translated) rect.top changes! getBoundingClientRect includes transforms → collapsed inner translated... measure OUTER sticky box (not translated inner). Outer sticky box top when pinned = headerH (sticky top) → rect.top <= headerH+8 → pinned always true once stuck... At natural position rect.top = natural top > headerH → not pinned. But wait when collapsed, outer stays sticky at top=headerH (outer isn't translated, inner is) → rect.top = headerH → pinned true. Good, transform on inner doesn't affect outer measurement.

But subtle: when phase compact and scroll-up → phase top → inner translates back down. Fine.

So scroll handler:
```
const y = window.scrollY;
const delta = y - lastY;
const pinned = barRect.top <= headerH + 8; // bar pinned under nav
if (!lg) -> top
if (phase === expandedOverlay) { if (delta > 4) setPhase("compact"); return; }
if (!pinned) { setPhase("top"); return; }
if (delta > 4) setPhase("compact");
else if (delta < -4) setPhase("top");
```
Wait — pinned only true after scrolling past; at top not pinned → top. Mid-page not scrolling → keep current phase (no delta change, pinned → stays). Scrolling down mid → compact. Scroll up mid → top (big bar pinned re-expands + links return). Good.

Hmm — but one more: when NOT pinned and delta > 4 (scrolling down near top) → top. Correct.

Initial: phase top, lastY = scrollY at mount.

Bar measurement when barRef null (mount race): skip phase changes until measured (except pinned false → top). Fine.

ResizeObserver not needed if measuring rect per scroll frame.

Scroll listener: `{ passive: true }`, rAF-throttle via ticking flag.

Esc listener: when phase === expandedOverlay → collapse to compact. Add in provider effect.

Also when compact clicked → expand: also scroll? No — bar is pinned; expanding shows it. Airbnb keeps scroll position. Good.

One more edge — banner: when banner visible, headerH ≈ 105; pinned check rect.top <= headerH + 8. Sticky top = headerH. When at top-of-page with banner, bar natural top ≈ 64+105+heading... fine.

Now SiteHeader merged:
```tsx
export function SiteHeader({ className, tone = "light", merged = false, centerSlot }: {...})
```
- root className when merged: replace `border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm` with `bg-[color:var(--surface-header)]`. Keep sticky top-0 z-50 hidden lg:block.
- nav row: `relative` so centerSlot absolute centers within row.
- nav links `<nav className="ml-12 ...">` — add transition + hidden in compact: `searchGroup.phase !== "top"` → `opacity-0 pointer-events-none`. Wrap: `className={cn("ml-12 flex items-center gap-9 transition-opacity duration-200", !linksVisible && "pointer-events-none opacity-0")}`. Note: keeping layout (no width collapse) — logo/actions stay put; compact pill centers over empty middle space. 
- centerSlot: `<div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">` with AnimatePresence + motion.div (fade+scale 0.96→1, y -4→0). pointer-events-auto on pill. Render only when merged && centerSlot.
- The context: `const searchGroup = useSearchGroup();` — `linksVisible = !merged || searchGroup.phase === "top"`; `compactVisible = merged && searchGroup.phase === "compact"`.
- On mobile header is hidden — fine.

Wait — centerSlot content: route passes `<CompactSearchPill summary={...} onExpand={searchGroup.expand}/>`; but SiteHeader needs searchGroup to animate in/out; route can't access searchGroup outside provider... route IS inside provider (wraps SiteHeader). So route could conditionally render centerSlot based on context — but route consuming context re-renders whole page on scroll phase change (heavy — results list re-render). Better: SiteHeader consumes context internally and controls visibility of centerSlot (children rendered but hidden via AnimatePresence). Route passes `centerSlot` node always; SiteHeader shows/hides it by phase. Route stays static. 

But route needs `onExpand` for the pill — route can't consume context without re-render... it CAN consume context and pass through; the page re-render on phase change: the pages are large (tutor grid) — re-render on every phase toggle (scroll down/up) could be janky. Avoid: make CompactSearchPill internally use context: `onExpand` default = context.expand. So route passes only `summary`. CompactSearchPill calls `useSearchGroup().expand` itself. 

But CompactSearchPill inside SiteHeader centerSlot → within provider tree. SiteHeader renders centerSlot regardless of phase (AnimatePresence handles exit). When phase !== compact, pill unmounts (exit anim). Its internal context.expand works. Route never touches context. 

Also the pill summary text comes from draft (route state) — route re-renders on draft changes only. Good.

Now visibility rules in SiteHeader:
- `linksVisible = searchGroup.phase === "top"` (when merged).
- `showCompact = merged && searchGroup.phase === "compact"`.

StickySearchBar: `hidden = phase === "compact"`.

Scrim + Esc + click → `collapse()` (to compact).

Provider phases: "top" | "compact" | "expandedOverlay". `expandedOverlay` naming → "expanded".

Now — subtle CSS issue: StickySearchBar outer `sticky top-[var]` — inline style top: headerHeight px. During SSR/prerender? These routes are SPA client-rendered mostly (Vite SPA? Nitro prerender?). Default headerHeight 64 pre-measure — fine.

Another subtlety: **the sticky outer box height** — inner content height = pill row (~64px) + py. When collapsed (translated), outer box still occupies its height — content below doesn't move (desired).

**Divider below search bar**: outer has border-b. When collapsed (translated inner), border stays on outer at its layout position... WAIT — the border is on the OUTER box (sticky box) which is NOT translated. When collapsed, the outer box's bottom border still renders at the layout position — a stray hairline over the results! Fix: put border+bg on the INNER div (the translated one). Outer: `sticky z-40 hidden lg:block` + top style; inner: `border-b border-border bg-[color:var(--surface-header)] ...` with collapse classes. But bg on inner only → when pinned, outer shows inner covering full box — same thing. OK: outer = sticky positioning only; inner = bg + border + transition. 

Hmm but sticky box height: determined by inner content height (normal flow) — good.

But wait — during collapse translate, the inner slides up; outer box (now visually empty) shows page background behind... no bg → transparent → content below scrolls... the outer box region shows whatever is behind (page bg). Since inner slid up behind nav, the box area shows page bg — matches "search bar gone". Good.

**grey at top**: hero bg + inner bg = #FEFEFE. The RESULTS section below = bg-background (white) — divider separates. Good.

**z-index of sticky bar vs CompareBar** (tutors page CompareBar fixed bottom, z?) — irrelevant.

**Announcement banner effect on sticky top**: measured. headerH via ResizeObserver on header element. SiteHeader root: add `data-site-header=""`. Provider: on mount, `document.querySelector("[data-site-header]")` — but header is hidden on mobile (`hidden lg:block`) — offsetHeight 0 on mobile → headerH 0 — but provider only active on lg. OK. ResizeObserver observes it; on banner dismiss, height shrinks → update. Also observe for lg switch.

Provider:
```tsx
type SearchGroupPhase = "top" | "compact" | "expanded";
const SearchGroupContext = createContext<SearchGroupContextValue | null>(null);
const DEFAULT: value = { phase: "top", headerTop: 64, expand: () => {}, collapse: () => {}, registerBar: () => {} };

export function useSearchGroup() { return useContext(SearchGroupContext) ?? DEFAULT; }

export function SearchGroupProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SearchGroupPhase>("top");
  const [headerTop, setHeaderTop] = useState(64);
  const barRef = useRef<HTMLDivElement | null>(null); // outer sticky bar
  const lastY = useRef<number | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const isLg = useMediaQueryLg(); // custom
  ...
}
```

Need matchMedia hook — check if repo has one: grep "matchMedia" in src. Let me check quickly. If exists use it; else write tiny inline:

```ts
const [isLg, setIsLg] = useState(false);
useEffect(() => {
  const mq = window.matchMedia("(min-width: 64rem)");
  const update = () => setIsLg(mq.matches);
  update();
  mq.addEventListener("change", update);
  return () => mq.removeEventListener("change", update);
}, []);
```
Tailwind lg = 64rem = 1024px. Yes, Tailwind v4 default `lg: 64rem`. Confirm breakpoints in styles.css? The dropdown sheet media query uses `width < 64rem` for <lg — consistent.

Header measurement:
```ts
useEffect(() => {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return;
  const update = () => setHeaderTop(header.offsetHeight || 64);
  update();
  const ro = new ResizeObserver(update);
  ro.observe(header);
  return () => ro.disconnect();
}, []);
```
offsetHeight of `hidden` element = 0 on mobile → guard `|| 64`? If 0 use 64. Only used on lg anyway.

Scroll effect (depends on isLg, headerTop):
```ts
useEffect(() => {
  if (!isLg) { setPhase("top"); lastY.current = null; return; }
  const onScroll = () => {
    const y = window.scrollY;
    const prev = lastY.current;
    lastY.current = y;
    const bar = barElRef.current;
    const current = phaseRef.current;
    if (current === "expanded") {
      if (prev !== null && y - prev > 4) setPhase("compact");
      return;
    }
    const pinned = !!bar && bar.getBoundingClientRect().top <= headerTop + 8;
    if (!pinned) { setPhasePhase top; return; }
    if (prev !== null) {
      if (y - prev > 4) setPhase("compact");
      else if (prev - y > 4) setPhase("top");
    }
  };
  let ticking = false;
  const handler = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); };
  window.addEventListener("scroll", handler, { passive: true });
  return () => window.removeEventListener("scroll", handler);
}, [isLg, headerTop]);
```
Hmm wait — when `!pinned` → setPhase("top") — but also reset lastY? It's continuous. OK.

Edge: `pinned` check uses getBoundingClientRect of outer sticky box: outer has `top: headerTop` sticky — when stuck, rect.top == headerTop → <= headerTop+8 → true. When in natural flow, rect.top = natural. When NOT stuck and y small → false → top. 

But careful: when bar hidden (display none on mobile) rect.top = 0 → pinned true → but isLg false path returns early. OK.

registerBar: context method setting barElRef. StickySearchBar:
```tsx
const { registerBar } = useSearchGroup();
<div ref={registerBar} ...>
```
Register outer sticky div.

Esc effect:
```ts
useEffect(() => {
  if (!isLg || phase !== "expanded") return;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPhase("compact"); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [isLg, phase]);
```

expand(): setPhase("expanded"). collapse(): setPhase("compact").

Scrim in StickySearchBar? StickySearchBar needs `phase` for hidden state + scrim. Consume context:
```tsx
const { phase, collapse, registerBar, headerTop } = useSearchGroup();
const collapsed = phase === "compact";
const scrimVisible = phase === "expanded";
```
Render:
```tsx
<div ref={registerBar} className="sticky z-40 hidden lg:block" style={{ top: headerTop }}>
  <button type="button" aria-label={t("search_ui.dismiss_search")} onClick={collapse} className={cn("fixed inset-0 z-30 cursor-default bg-black/45 transition-opacity duration-300", scrimVisible ? "opacity-100" : "pointer-events-none opacity-0")} />
  <div className={cn("border-b border-border bg-[color:var(--surface-header)] transition-[transform,opacity] duration-300 ease-out", collapsed ? (reducedMotion ? "opacity-0" : "-translate-y-[120%] opacity-0") : "", collapsed ? "pointer-events-none" : "pointer-events-auto", className)}>
    {children}
  </div>
</div>
```
Hmm — button as scrim: cursor-default, no focus ring? Scrim button focusable — meh; keep div+onClick? Accessibility: Esc covers keyboard. Airbnb uses click-outside. I'll use a plain div with onClick + aria-hidden="true" (decorative). Esc handles keyboard. Simpler + avoids focus trap weirdness. But then eslint jsx-a11y might flag click-events-have-key-events on div? The repo eslint — check if jsx-a11y enforced... unknown; I'll use button with `tabIndex={-1}` aria-hidden to be safe from a11y rules? aria-hidden + tabindex -1 + onClick... Actually simplest: `<div aria-hidden="true" onClick=... />` — if a11y rule complains, adjust. Actually let me check eslint config quickly for jsx-a11y plugin. I'll peek at eslint.config.js later during lint step.

Inner also gets `className` from prop (spacing py). Actually pass className to inner.

Also motion — should collapse use motion/react spring like the bar highlight? CSS transition 300ms ease-out is fine + reduced-motion class. Keep CSS (simpler, no re-render loops). Reduced motion: `motion-reduce:transition-none` + when collapsed just `opacity-0` (snap, no translate) → add conditional: reducedMotion ? "opacity-0" : "-translate-y-[120%] opacity-0". Both include opacity-0; fine.

Hmm wait — `motion-reduce:transition-none` on element with conditional reducedMotion class — redundant; keep both harmless. I'll keep the conditional logic only (prefersReducedMotion from useReducedMotion).

One more: `pointer-events-none` when collapsed on inner (so hidden bar doesn't block clicks at its layout box — actually when translated, the inner is visually elsewhere (behind nav), but pointer events follow transforms — the inner's box maps to translated position (behind nav, z lower than nav) → clicks at layout position pass through to content below? Transformed element hit area = transformed box. So layout-area clicks hit whatever is beneath — the outer sticky box (transparent) then content. Good — pointer-events-none still safer (popovers? Radix popovers portal so unaffected).

But careful: when collapsed and user clicks where the bar WAS — hits results below — fine.

Compact pill in SiteHeader center — AnimatePresence:
```tsx
{merged && centerSlot ? (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <AnimatePresence initial={false}>
      {showCompact ? (
        <motion.div initial={{ opacity: 0, scale: 0.94, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={{ duration: 0.22, ease: "easeOut" }} className="pointer-events-auto">
          {centerSlot}
        </motion.div>
      ) : null}
    </AnimatePresence>
  </div>
) : null}
```
Reduced motion: motion/react doesn't auto-respect; wrap with useReducedMotion → snap (duration 0). I'll add: `const reduce = useReducedMotion(); transition={reduce ? { duration: 0 } : {...}}`.

Nav links fade:
```tsx
<nav className={cn("ml-12 flex items-center gap-9 transition-opacity duration-200", linksVisible ? "opacity-100" : "pointer-events-none opacity-0")}>
```

SiteHeader props: add `merged?: boolean` + `centerSlot?: ReactNode`. Root classes:
```tsx
className={cn(
  "sticky top-0 z-50 hidden w-full lg:block",
  merged
    ? "bg-[color:var(--surface-header)]"
    : "border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm",
  tone === "dark" && "site-header--dark",
  className,
)}
```
Add `data-site-header` attr on root `<header>`. Note `site-header--dark` sets border-bottom-color + bg !important — unused (tone never dark); leave.

Nav row container: `<div className="mx-auto relative flex h-[64px] ...">` — add relative for centering.

**Split search components:**

tutors-search.tsx:
- Extract `TutorsSearchBar` (desktop): props draft, onDraftChange, onApply, onClear, resultCount?, allPrices?, whatsappUrl? (FiltersDialog footerExtra uses whatsappUrl), className?
- Extract `TutorsSearchMobile` (mobile): draft, onDraftChange, onApply, onClear, defaultOverlayOpen?, className?
- Combined `TutorsSearch` renders both (homepage) with original props (keeps resultCount/allPrices/whatsappUrl/defaultOverlayOpen).
- Export `buildTutorsCompactSummary(draft): string`:
```ts
export function buildTutorsCompactSummary(draft: TutorsSearchState): string {
  const { t } = useTranslation(); // hook needed — make it a component-level helper instead
}
```
Hooks can't be in plain function — make it a hook `useTutorsCompactSummary(draft)` or build inside component and pass summary to pill in route. Route needs summary string. Make each file export a hook: `useTutorsSearchSummary(draft)`. Hmm, or simpler — the pill's summary can be computed by route with plain logic using t() from route (route already has t): 

tutors route:
```ts
const compactSummary = [
  draft.q?.trim(),
  draft.category ? categoryLabelT(draft.category) : "",
  draft.subject,
  modeDisplay filled...
]
```
But categoryLabel + modeDisplay logic lives in the search component. Duplicating in route = drift. Cleanest: export a hook from tutors-search.tsx:
```ts
export function useTutorsCompactSummary(draft: TutorsSearchState): string {
  const { t } = useTranslation();
  const subjectOptions = getSubjectOptionsForCategory(draft.category); // not needed for summary
  const modeDisplay = ... (same logic)
  const categoryLabel = ...
  return [q?.trim(), category?, subject?, mode?].filter(Boolean).join(" · ") || t("search_ui.search_tutors");
}
```
Duplication of small display logic — acceptable. Actually — alternative: TutorsSearchBar accepts optional `summary` rendering? No.

Even simpler alternative: CompactSearchPill renders `summary` — the route computes. Fine, go with exported hooks per search file:
- tutors-search.tsx: `useTutorsCompactSummary`
- courses-search.tsx: `useCoursesCompactSummary`
- cases-search.tsx: `useCasesCompactSummary`

i18n keys to add (`search_ui`):
- "compact_expand": "Expand search" (aria-label for compact pill)
- Actually pill aria-label: `t("search_ui.compact_expand")` = "Show search filters"? Airbnb: pill announces "Search". Use "Expand search". And scrim not needed (aria-hidden).
- Maybe "dismiss_search" not needed (scrim aria-hidden).

Add to en.json + zh-HK.json.

Route restructure (tutors.index.tsx):
```tsx
return (
  <SearchGroupProvider>
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader merged centerSlot={<CompactSearchPill summary={compactSummary} />} />
      <main className="flex-1">
        <section className="bg-[color:var(--surface-header)] pt-10 pb-6 sm:pt-12 sm:pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 .../>
            <p .../>
            <TutorsSearchMobile className="mt-7" ... />
          </div>
        </section>
        <div>
          <StickySearchBar className="py-4">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <TutorsSearchBar draft={draft} onDraftChange={setDraftParam} onApply={applySearch} onClear={clearAll} resultCount={filtered.length} allPrices={...} whatsappUrl={hotlineUrl || undefined} />
            </div>
          </StickySearchBar>
          <section className="py-12">...results...</section>
        </div>
      </main>
      <SiteFooter />
      ...
    </div>
  </SearchGroupProvider>
);
```
Wait — provider outside the bg div or inside? Provider renders context only (no DOM) → wrap whole return. Mobile: hero has NO border-b now! Original hero had `border-b` (mobile divider below mobile trigger + nav pills). If I remove border-b from hero, mobile loses its divider. Fix: hero keeps `border-b border-border lg:border-b-0`. Desktop divider = StickySearchBar's border-b. Mobile divider = hero border-b (unchanged position: below trigger pills). 

Wait check original: hero `border-b border-border py-10 sm:py-12` — mobile border below the MobileSearchTrigger quick-nav pills. Yes keep mobile as-is.

Hmm — but on desktop, StickySearchBar py-4 wraps pill row; hero pb-6/8 + sticky bar py-4 → gap heading→pill = pb(24/32) + py-top(16) = 40-48 ≈ original mt-7 (28px) + py-12 bottom(48)... total pill-to-border original = 48. New: pill bottom pad 16. Fine, tune with py-5 maybe. I'll use hero `pb-6 sm:pb-8` and StickySearchBar `py-4`. Visual check later.

Tutor-requests page: hero includes Badge + h1 + p + CTA button + CasesSearch. CasesSearch split: desktop row (no filters dialog — CasesSearch has no FiltersPillButton/FiltersDialog) + mobile. Sticky bar container: PageContainer width="default" (max-w-4xl). Hero container PageContainer too. Original hero section `border-b border-border` — keep `lg:border-b-0`.

Also note tutor-requests page mainClassName bg surface-subtle — results bg #F7F9FA below divider. Top block #FEFEFE. OK.

courses.index.tsx similar to tutors.

Homepage index.tsx — uses `TutorsSearch` combined — unchanged.

Now — the combined TutorsSearch must keep working: it renders both parts; but TutorsSearchBar contains FiltersDialog (desktop-only fine) and TutorsSearchMobile contains MobileSearchOverlay. Combined = both. Its className wrapper: original structure `<div className={className}> <div hidden lg:flex>bar</div> <FiltersDialog/> <MobileSearchTrigger/> <MobileSearchOverlay/> </div>`. New combined: `<div className={className}><TutorsSearchBar .../><TutorsSearchMobile .../></div>` — but wait, on mobile, TutorsSearchBar renders `hidden lg:flex` row (no DOM impact) + FiltersDialog (portal, closed) → fine.

Homepage hero: index.tsx has search inside hero card — unchanged behavior.

One consideration — **the pinned big bar vs the tinted state: popovers**: SearchPillBar popovers portal to body with z-[9999] — above scrim (z-30) and nav (z-50). Good.

**Popover positioning when bar pinned**: PopoverContent align start relative to trigger — fine.

**Focus/scroll lock during expandedOverlay**: Airbnb doesn't lock scroll. Skip.

**When expandedOverlay and user scrolls UP** → stays expanded (per plan). Scrim + bar pinned. OK.

**When expandedOverlay and user clicks a segment** → popover opens above scrim. Submitting search (onApply) navigates (same route, new search params) — scroll position preserved (no page reload); state stays expandedOverlay? Airbnb closes panel after search. Hmm — applySearch navigates with new params; the overlay state remains (bar still pinned + tint). Ideally after successful apply → collapse to compact? Actually after applying search at top-of-page... the apply button in big bar: after navigate, keep as-is (no auto-collapse) — user sees results behind tint. Hmm — that's odd. Better: onApply → collapse to "compact" (bar retracts, tint lifts, user sees fresh results). But onApply at TOP phase (state 1) shouldn't collapse to compact — it should stay top (scroll stays). Nuance: if phase top → keep top; if expanded → collapse. Implement in route: `onApply={(o) => { applySearch(o); if (phase === "expanded") collapse(); }}` — route would need context... re-render concern: route consumes context → page re-renders on phase change. The heavy part (tutor grid) — re-render cost... React re-render of ~200 DOM nodes list — probably fine (few times per scroll direction change, not per scroll frame). Hmm, but it re-renders on EVERY phase toggle (scroll down → compact: one re-render; scroll up: another). Acceptable? The grid is big (up to ~dozens of cards). Risky for scroll jank.

Alternative: pass handler down via context-independent mechanism: give StickySearchBar/CompactSearchPill an optional `onApply` event? Cleaner: the pill bar's submit → we want collapse. The big bar lives in StickySearchBar children (route JSX) — could wrap TutorsSearchBar in a component that consumes context (small component, not whole page): e.g., in route:
```tsx
<StickySearchBar>
  <Container><SearchGroupApplyWrapper onApplied={(phase)=>...}><TutorsSearchBar onApply={applySearch}/></SearchGroupApplyWrapper></Container>
</StickySearchBar>
```
Over-engineering. Simpler: export a tiny consumer component from sticky-search-group.tsx:
```tsx
export function AutoCollapseSearchBar({ children }) // consumes context, clones child adding onApply wrapper? No.
```
Simplest robust: make the page's onApply function static (useCallback-free) and have the collapse handled inside SearchPillBar submit? No — SearchPillBar is generic.

Alternative approach: let context re-render page — measure cost later; pages use react-query data; re-render is just React reconciliation. Tutor grid ~ 6-30 cards → trivial. Courses list similar. Fine — let route consume context (useSearchGroup) for onApply wiring. Honestly simpler and correct. If perf issues, optimize later.

Hmm wait — actually there's an even simpler path: the submit button in the big bar → after apply, Airbnb closes the panel and shows results. Our apply navigates → new results. If phase stays "top" (user at top), bar unpins... user sees results below. No collapse needed. If phase "expanded" (tinted), collapsing to compact after apply feels right. So route onApply: `applySearch(o); if (searchGroup.phase === "expanded") searchGroup.collapse();` — route consumes context. OK doing that. Route re-renders on phase change — fine.

Actually hold on, also the FiltersDialog "apply" → onApply → same route handler → same collapse behavior. Good.

**Route compact summary via hook** — defined in search files.

**zh-HK translations**: add keys mirroring en.

Let me also double-check `Button` props: variant "solid", color "blue", shape "pill" — used in SearchPillBar submit. Reuse for compact icon: `<span>` styled manually (nested button invalid). Look at Button solid blue classes — just mimic: `bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)] hover:bg-[color:var(--btn-accent-hover)]`. Use span: `flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--btn-accent)] text-white`.

Pill sizing: h-12 (48px) like Airbnb. Max width: `max-w-[36rem]`? In nav center with logo/actions: at lg 1024: logo ~170 + actions ~150 (language toggle + sign in/up) or ~300 (account w-60 + lang) — pill max ~ 1024-80-170-320-64 ≈ 390px. Use `max-w-[min(28rem,calc(100vw-40rem))]`? Getting fussy — use `max-w-[32rem]` and rely on truncate + `w-[min(32rem,calc(100vw-42rem))]`? Hmm. Actually — center absolute can overlap if too wide. Give pill: `w-[min(30rem,calc(100vw-44rem))]` → at 1024: min(480, 1024-704=320) = 320px. At 1440: 480. Reasonable. Account button w-60 (240) + lang toggle (~56) + gaps ~ 320 right side; logo ~ 190 + px-10 (80) → left ~ 270. Total fixed ≈ 590 + gaps. 100vw-44rem(704) at 1024 → 320: 270+320+320 = 910 < 1024 ok. At 1280: 576 pill → 270+576+320=1166 < 1280 ok. Use `w-[min(30rem,calc(100vw-44rem))] min-w-56`.

Hmm, lg breakpoint exactly 1024 might be tight-ish but fine (min-w-56=224).

**Announcement banner + compact pill**: banner visible in compact too (part of header) — fine.

Now write the code. Also check `useReducedMotion` import from "motion/react" (already used in search-pill-bar).

Also `AnimatePresence` from "motion/react".

Let me also confirm `cn` path `@/lib/utils`.

Potential gotcha: ESLint `no-restricted-syntax` for shadows — we're not using shadows. Transition lists must not reference box-shadow — we use `transition-[transform,opacity]` — fine.

Another gotcha: react-hooks/exhaustive-deps on effects.

Let me now write styles.css edit first.

Now implementing. Step 1 — the token in `styles.css`:

**Tool: edit**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css",
  "newString": "  /* Themed app surfaces */\n  --ink: #0f1419;\n  --surface: #ffffff;\n  --surface-header: #fefefe; /* grouped nav + directory search band (Airbnb grey) */\n  --surface-subtle: #f7f9fa;",
  "oldString": "  /* Themed app surfaces */\n  --ink: #0f1419;\n  --surface: #ffffff;\n  --surface-subtle: #f7f9fa;"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 5.9s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css",
  "limit": 14,
  "offset": 205
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css</path>
<type>file</type>
<content>
205:  */
206: .dark {
207:   --ink: #e7e9ea;
208:   --surface: #121212;
209:   --surface-subtle: #1a1c1e;
210:   --surface-raised: #232327;
211:   --surface-hover: #26282c;
212:   --surface-invert: #f0f3f4;
213:   --surface-invert-hover: #d9dde0;
214:   --surface-invert-fg: #0f1419;
215:   --brand-link: #1d9bf0;
216:   --subtle-foreground: #9ba1a6;
217:   --disabled-foreground: #8a8e93;
218:   --success: #4ade80;

(Showing lines 205-218 of 678. Use offset=219 to continue.)
</content>
```

---

## Assistant (Build · GLM-5.3-Flash · 7.4s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/styles.css",
  "newString": ".dark {\n  --ink: #e7e9ea;\n  --surface: #121212;\n  --surface-header: #121212;\n  --surface-subtle: #1a1c1e;",
  "oldString": ".dark {\n  --ink: #e7e9ea;\n  --surface: #121212;\n  --surface-subtle: #1a1c1e;"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 17.3s)

_Thinking:_

Step 2 — create `sticky-search-group.tsx`. Let me check whether there's an existing matchMedia hook in the repo first.

Step 2 — the search-group primitives. Checking for an existing media-query hook first:

**Tool: grep**

**Input:**
```json
{
  "path": "src",
  "pattern": "matchMedia|useMediaQuery"
}
```

**Output:**
```
Found 5 matches
/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/__root.tsx:
  Line 153: const themeInitScript = `(function(){try{var t=localStorage.getItem('matchmax-theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/theme/ThemeProvider.tsx:
  Line 41:   return window.matchMedia("(prefers-color-scheme: dark)").matches;

  Line 50:     if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {

  Line 90:     const media = window.matchMedia("(prefers-color-scheme: dark)");


/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/hooks/use-mobile.tsx:
  Line 9:     const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

```

---

## Assistant (Build · GLM-5.3-Flash · 9.0s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/hooks/use-mobile.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/hooks/use-mobile.tsx</path>
<type>file</type>
<content>
1: import * as React from "react";
2: 
3: const MOBILE_BREAKPOINT = 768;
4: 
5: export function useIsMobile() {
6:   const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);
7: 
8:   React.useEffect(() => {
9:     const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
10:     const onChange = () => {
11:       setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
12:     };
13:     mql.addEventListener("change", onChange);
14:     setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
15:     return () => mql.removeEventListener("change", onChange);
16:   }, []);
17: 
18:   return !!isMobile;
19: }

(End of file - total 19 lines)
</content>
```

---

## Assistant (Build · GLM-5.3-Flash · 91.4s)

_Thinking:_

No lg-specific hook; I'll write the matchMedia inline in the provider. Now create `sticky-search-group.tsx`:

**Tool: write**

**Input:**
```json
{
  "content": "import { Search } from \"lucide-react\";\nimport { AnimatePresence, motion, useReducedMotion } from \"motion/react\";\nimport {\n  createContext,\n  useCallback,\n  useContext,\n  useEffect,\n  useRef,\n  useState,\n  type ReactNode,\n} from \"react\";\nimport { useTranslation } from \"react-i18next\";\n\nimport { cn } from \"@/lib/utils\";\n\n/**\n * Airbnb-style grouped search header state machine (desktop lg+ only).\n *\n * - \"top\"      → nav links visible, full search bar in the page flow, no scrim.\n * - \"compact\"  → full bar retracted behind the nav, compact pill centered in\n *                the nav row, links hidden.\n * - \"expanded\" → compact pill clicked: full bar pinned under the nav again and\n *                a scrim tints the page until dismissed (scrim click / Esc /\n *                scrolling down).\n *\n * On <lg the provider is inert: everything renders exactly as before.\n */\nexport type SearchGroupPhase = \"top\" | \"compact\" | \"expanded\";\n\ntype SearchGroupContextValue = {\n  phase: SearchGroupPhase;\n  /** Sticky offset for the pinned bar: the live height of the site header. */\n  headerTop: number;\n  /** Register the sticky bar element (drives pin detection). */\n  registerBar: (element: HTMLDivElement | null) => void;\n  expand: () => void;\n  /** Dismiss the tinted state back to the compact pill. */\n  collapse: () => void;\n};\n\nconst DEFAULT_CONTEXT: SearchGroupContextValue = {\n  phase: \"top\",\n  headerTop: 64,\n  registerBar: () => {},\n  expand: () => {},\n  collapse: () => {},\n};\n\nconst SearchGroupContext = createContext<SearchGroupContextValue | null>(null);\n\nexport function useSearchGroup() {\n  return useContext(SearchGroupContext) ?? DEFAULT_CONTEXT;\n}\n\nexport function SearchGroupProvider({ children }: { children: ReactNode }) {\n  const [phase, setPhase] = useState<SearchGroupPhase>(\"top\");\n  const [headerTop, setHeaderTop] = useState(64);\n  const [isDesktop, setIsDesktop] = useState(false);\n  const barRef = useRef<HTMLDivElement | null>(null);\n  const lastScrollY = useRef<number | null>(null);\n  const phaseRef = useRef(phase);\n  phaseRef.current = phase;\n\n  // Only drive the state machine at Tailwind's lg breakpoint; below lg every\n  // consumer renders its static (top) appearance.\n  useEffect(() => {\n    const mql = window.matchMedia(\"(min-width: 64rem)\");\n    const update = () => setIsDesktop(mql.matches);\n    update();\n    mql.addEventListener(\"change\", update);\n    return () => mql.removeEventListener(\"change\", update);\n  }, []);\n\n  // The pinned bar must clear the whole sticky header, announcement banner\n  // included — measure it live instead of hardcoding 64px.\n  useEffect(() => {\n    const header = document.querySelector<HTMLElement>(\"[data-site-header]\");\n    if (!header) return;\n    const update = () => {\n      const height = header.offsetHeight;\n      setHeaderTop(height > 0 ? height : 64);\n    };\n    update();\n    const observer = new ResizeObserver(update);\n    observer.observe(header);\n    return () => observer.disconnect();\n  }, []);\n\n  const registerBar = useCallback((element: HTMLDivElement | null) => {\n    barRef.current = element;\n  }, []);\n\n  const expand = useCallback(() => setPhase(\"expanded\"), []);\n  const collapse = useCallback(() => setPhase(\"compact\"), []);\n\n  useEffect(() => {\n    if (!isDesktop) {\n      lastScrollY.current = null;\n      setPhase(\"top\");\n      return;\n    }\n    lastScrollY.current = window.scrollY;\n\n    const evaluate = () => {\n      const y = window.scrollY;\n      const previous = lastScrollY.current;\n      lastScrollY.current = y;\n      const current = phaseRef.current;\n\n      if (current === \"expanded\") {\n        // Scrolling down while tinted returns to the compact pill; scrolling\n        // up keeps the expanded search open.\n        if (previous !== null && y - previous > 4) setPhase(\"compact\");\n        return;\n      }\n\n      const bar = barRef.current;\n      const pinned = !!bar && bar.getBoundingClientRect().top <= headerTop + 8;\n      if (!pinned) {\n        setPhase(\"top\");\n        return;\n      }\n      if (previous !== null) {\n        if (y - previous > 4) setPhase(\"compact\");\n        else if (previous - y > 4) setPhase(\"top\");\n      }\n    };\n\n    let ticking = false;\n    const onScroll = () => {\n      if (ticking) return;\n      ticking = true;\n      requestAnimationFrame(() => {\n        ticking = false;\n        evaluate();\n      });\n    };\n\n    window.addEventListener(\"scroll\", onScroll, { passive: true });\n    return () => window.removeEventListener(\"scroll\", onScroll);\n  }, [isDesktop, headerTop]);\n\n  useEffect(() => {\n    if (!isDesktop || phase !== \"expanded\") return;\n    const onKeyDown = (event: KeyboardEvent) => {\n      if (event.key === \"Escape\") setPhase(\"compact\");\n    };\n    window.addEventListener(\"keydown\", onKeyDown);\n    return () => window.removeEventListener(\"keydown\", onKeyDown);\n  }, [isDesktop, phase]);\n\n  return (\n    <SearchGroupContext.Provider value={{ phase, headerTop, registerBar, expand, collapse }}>\n      {children}\n    </SearchGroupContext.Provider>\n  );\n}\n\n/**\n * Sticky band that carries the desktop search row. It pins directly under the\n * site header; the band itself (background + divider) collapses out of view\n * while the compact pill is showing so the layout never jumps.\n */\nexport function StickySearchBar({\n  children,\n  className,\n}: {\n  children: ReactNode;\n  className?: string;\n}) {\n  const { t } = useTranslation();\n  const { phase, headerTop, registerBar, collapse } = useSearchGroup();\n  const prefersReducedMotion = useReducedMotion();\n  const collapsed = phase === \"compact\";\n  const scrimVisible = phase === \"expanded\";\n\n  return (\n    <div\n      ref={registerBar}\n      className=\"sticky z-40 hidden lg:block\"\n      style={{ top: headerTop }}\n      data-state={collapsed ? \"collapsed\" : \"expanded\"}\n    >\n      <div\n        aria-hidden=\"true\"\n        onClick={collapse}\n        className={cn(\n          \"fixed inset-0 z-30 cursor-default bg-black/45 transition-opacity duration-300 motion-reduce:transition-none\",\n          scrimVisible ? \"opacity-100\" : \"pointer-events-none opacity-0\",\n        )}\n      />\n      <div\n        className={cn(\n          \"border-b border-border bg-[color:var(--surface-header)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none\",\n          collapsed\n            ? cn(\n                \"pointer-events-none opacity-0\",\n                !prefersReducedMotion && \"-translate-y-[120%]\",\n              )\n            : \"pointer-events-auto opacity-100\",\n          className,\n        )}\n      >\n        {children}\n      </div>\n    </div>\n  );\n}\n\n/**\n * Compact Airbnb-style pill for the center of the nav row: single-line search\n * summary with the circular azure submit mark. Clicking it expands the full\n * search bar again (tinted state).\n */\nexport function CompactSearchPill({ summary }: { summary: string }) {\n  const { t } = useTranslation();\n  const { expand } = useSearchGroup();\n  const prefersReducedMotion = useReducedMotion();\n\n  return (\n    <button\n      type=\"button\"\n      onClick={expand}\n      aria-label={t(\"search_ui.compact_expand\")}\n      className={cn(\n        \"flex h-12 w-[min(30rem,calc(100vw-44rem))] min-w-56 items-center gap-2 rounded-full border border-border bg-card py-1 pr-1.5 pl-5 text-left transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40\",\n      )}\n    >\n      <span className=\"min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--ink)]\">\n        {summary}\n      </span>\n      <span\n        aria-hidden=\"true\"\n        className=\"flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-accent)] text-white transition-colors group-hover:bg-[color:var(--btn-accent-hover)]\"\n      >\n        <Search className=\"h-4 w-4\" />\n      </span>\n    </button>\n  );\n}\n\n/** Fades the compact pill in/out inside the nav row. */\nexport function CompactPillSlot({ children }: { children: ReactNode }) {\n  const prefersReducedMotion = useReducedMotion();\n  return (\n    <AnimatePresence initial={false}>\n      <motion.div\n        key=\"compact-pill\"\n        initial={{ opacity: 0, scale: 0.94, y: -6 }}\n        animate={{ opacity: 1, scale: 1, y: 0 }}\n        exit={{ opacity: 0, scale: 0.96, y: -4 }}\n        transition={\n          prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: \"easeOut\" }\n        }\n        className=\"pointer-events-auto\"\n      >\n        {children}\n      </motion.div>\n    </AnimatePresence>\n  );\n}\n",
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/sticky-search-group.tsx"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 54.4s)

_Thinking:_

Wait — in `CompactPillSlot` I hardcoded `key="compact-pill"` with no conditional child — AnimatePresence needs the child to conditionally mount/unmount for exit animation. The visibility condition must be applied by the caller (SiteHeader): `{showCompact ? <CompactPillSlot>{pill}</CompactPillSlot> : null}` — but then AnimatePresence itself unmounts with the child → exit animation lost!

Correct pattern: AnimatePresence stays mounted, child conditionally rendered inside:
```tsx
<AnimatePresence initial={false}>
  {visible ? <motion.div key="pill" ...>{children}</motion.div> : null}
</AnimatePresence>
```
So CompactPillSlot needs a `visible` prop from SiteHeader (which knows the phase). Let me restructure: `CompactPillSlot({ visible, children })`. SiteHeader passes `visible={showCompact}`. Let me fix that.

Also in StickySearchBar — the scrim is inside the sticky div; when collapsed the whole sticky div still occupies height; scrim is fixed so fine. But wait: the sticky container `hidden lg:block` — when its content (inner) is translated up, container height remains = inner height. OK.

One issue: the scrim is `fixed inset-0 z-30` inside a `sticky z-40` parent — fixed positioning inside sticky works (sticky doesn't create containing block for fixed... actually sticky DOES NOT create a containing block for fixed descendants — transform does! The inner div has `-translate-y-[120%]` when collapsed — but scrim is sibling, not child of inner. However: any ancestor with transform creates containing block. The sticky outer has no transform. OK scrim truly fixed. 

But wait — will-change/backdrop? None. Good.

Another issue: pointer-events on scrim when hidden: `pointer-events-none opacity-0` — good. But when `collapsed` (compact) the scrim stays hidden — good.

Hmm, also `data-state` unused — remove to avoid lint noise? It's harmless; remove for cleanliness.

Also the `useTranslation` in StickySearchBar is unused now (scrim aria-hidden, no label). Remove it.

Let me rewrite those parts.

Two fixes to the file I just wrote: `CompactPillSlot` must own the visibility toggle for exit animations to work, and clean up unused bits:

**Tool: edit**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/sticky-search-group.tsx",
  "newString": "/** Fades the compact pill in/out inside the nav row. */\nexport function CompactPillSlot({\n  visible,\n  children,\n}: {\n  visible: boolean;\n  children: ReactNode;\n}) {\n  const prefersReducedMotion = useReducedMotion();\n  return (\n    <AnimatePresence initial={false}>\n      {visible ? (\n        <motion.div\n          key=\"compact-pill\"\n          initial={{ opacity: 0, scale: 0.94, y: -6 }}\n          animate={{ opacity: 1, scale: 1, y: 0 }}\n          exit={{ opacity: 0, scale: 0.96, y: -4 }}\n          transition={\n            prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: \"easeOut\" }\n          }\n          className=\"pointer-events-auto\"\n        >\n          {children}\n        </motion.div>\n      ) : null}\n    </AnimatePresence>\n  );\n}",
  "oldString": "/** Fades the compact pill in/out inside the nav row. */\nexport function CompactPillSlot({ children }: { children: ReactNode }) {\n  const prefersReducedMotion = useReducedMotion();\n  return (\n    <AnimatePresence initial={false}>\n      <motion.div\n        key=\"compact-pill\"\n        initial={{ opacity: 0, scale: 0.94, y: -6 }}\n        animate={{ opacity: 1, scale: 1, y: 0 }}\n        exit={{ opacity: 0, scale: 0.96, y: -4 }}\n        transition={\n          prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: \"easeOut\" }\n        }\n        className=\"pointer-events-auto\"\n      >\n        {children}\n      </motion.div>\n    </AnimatePresence>\n  );\n}"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 12.4s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/sticky-search-group.tsx",
  "newString": "export function StickySearchBar({\n  children,\n  className,\n}: {\n  children: ReactNode;\n  className?: string;\n}) {\n  const { phase, headerTop, registerBar, collapse } = useSearchGroup();\n  const prefersReducedMotion = useReducedMotion();\n  const collapsed = phase === \"compact\";\n  const scrimVisible = phase === \"expanded\";\n\n  return (\n    <div\n      ref={registerBar}\n      className=\"sticky z-40 hidden lg:block\"\n      style={{ top: headerTop }}\n    >",
  "oldString": "export function StickySearchBar({\n  children,\n  className,\n}: {\n  children: ReactNode;\n  className?: string;\n}) {\n  const { t } = useTranslation();\n  const { phase, headerTop, registerBar, collapse } = useSearchGroup();\n  const prefersReducedMotion = useReducedMotion();\n  const collapsed = phase === \"compact\";\n  const scrimVisible = phase === \"expanded\";\n\n  return (\n    <div\n      ref={registerBar}\n      className=\"sticky z-40 hidden lg:block\"\n      style={{ top: headerTop }}\n      data-state={collapsed ? \"collapsed\" : \"expanded\"}\n    >"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 29.5s)

_Thinking:_

Now the `useTranslation` import may be unused in the file — CompactSearchPill uses it. It's still used. Good.

Step 3 — SiteHeader. Edit:
1. Props: `merged?: boolean`, `centerSlot?: ReactNode`.
2. Root: conditional bg/border, add `data-site-header`.
3. Nav row: add `relative`; nav links fade via context; compact slot after the row content.

Let me rewrite the relevant parts of SiteHeader.

Step 3 — `SiteHeader.tsx`:

**Tool: edit**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx",
  "newString": "import { Link, useRouterState } from \"@tanstack/react-router\";\nimport {\n  Bookmark,\n  BookOpen,\n  Building2,\n  ChevronsUpDown,\n  LogOut,\n  Moon,\n  Settings,\n  ShieldCheck,\n  Sun,\n  UserRound,\n} from \"lucide-react\";\nimport { useTranslation } from \"react-i18next\";\n\nimport { LanguageToggle } from \"@/components/brand/LanguageToggle\";\nimport { Logo } from \"@/components/brand/Logo\";\nimport { CompactPillSlot, useSearchGroup } from \"@/components/search/sticky-search-group\";\nimport { Button } from \"@/components/ui/button\";",
  "oldString": "import { Link, useRouterState } from \"@tanstack/react-router\";\nimport {\n  Bookmark,\n  BookOpen,\n  Building2,\n  ChevronsUpDown,\n  LogOut,\n  Moon,\n  Settings,\n  ShieldCheck,\n  Sun,\n  UserRound,\n} from \"lucide-react\";\nimport { useTranslation } from \"react-i18next\";\n\nimport { LanguageToggle } from \"@/components/brand/LanguageToggle\";\nimport { Logo } from \"@/components/brand/Logo\";\nimport { Button } from \"@/components/ui/button\";"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 40.9s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/layout/SiteHeader.tsx",
  "newString": "export function SiteHeader({\n  className,\n  tone = \"light\",\n  merged = false,\n  centerSlot,\n}: {\n  className?: string;\n  tone?: \"light\" | \"dark\";\n  /**\n   * Grouped search-header mode (directory pages): no divider under the nav,\n   * shared #FEFEFE band with the search area below, and the nav links fade\n   * out while the compact search pill is showing.\n   */\n  merged?: boolean;\n  /** Compact search pill rendered centered in the nav row (merged mode). */\n  centerSlot?: React.ReactNode;\n}) {\n  const { t } = useTranslation();\n  const { user, signOut, hasAnyRole } = useAuth();\n  const { membership } = useMyOrganization();\n  const hasOrg = !!membership;\n  const { theme, setTheme } = useTheme();\n  const isAdmin = hasAnyRole([\"admin\", \"super_admin\"]);\n  const pathname = useRouterState({ select: (state) => state.location.pathname });\n  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);\n  const searchGroup = useSearchGroup();\n  const linksVisible = !merged || searchGroup.phase === \"top\";\n  const compactVisible = merged && searchGroup.phase === \"compact\";\n  const accountName =\n    user?.user_metadata.display_name?.trim() || user?.email?.split(\"@\")[0] || \"Account\";\n  const accountInitial = accountName.charAt(0).toUpperCase();\n  const useDarkTheme = theme !== \"dark\";\n  const brandLabelClassName = \"text-lg font-bold tracking-tight text-brand-gradient sm:text-xl\";\n\n  // Mobile has no top bar at all — navigation lives in the bottom tab bar and\n  // the quick-nav pills under each search trigger. The fixed bottom nav must\n  // render outside the hidden header so it stays visible.\n  return (\n    <>\n      <header\n        data-site-header=\"\"\n        className={cn(\n          \"sticky top-0 z-50 hidden w-full lg:block\",\n          merged\n            ? \"bg-[color:var(--surface-header)]\"\n            : \"border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm\",\n          tone === \"dark\" && \"site-header--dark\",\n          className,\n        )}\n      >\n        <div className=\"relative mx-auto flex h-[64px] max-w-[1440px] items-center gap-2 px-4 sm:px-8 lg:gap-0 lg:px-10\">\n          {merged && centerSlot ? (\n            <div className=\"pointer-events-none absolute inset-0 flex items-center justify-center\">\n              <CompactPillSlot visible={compactVisible}>{centerSlot}</CompactPillSlot>\n            </div>\n          ) : null}\n          <Link to=\"/\" className=\"flex shrink-0 items-center\" aria-label=\"MatchMax home\">\n            <div className=\"flex items-center gap-2\">\n              <Logo className=\"shrink-0\" />\n              <span className={brandLabelClassName}>MatchMax</span>\n            </div>\n          </Link>\n\n          <nav\n            className={cn(\n              \"ml-12 flex items-center gap-9 transition-opacity duration-200 motion-reduce:transition-none\",\n              linksVisible ? \"opacity-100\" : \"pointer-events-none opacity-0\",\n            )}\n          >",
  "oldString": "export function SiteHeader({\n  className,\n  tone = \"light\",\n}: {\n  className?: string;\n  tone?: \"light\" | \"dark\";\n}) {\n  const { t } = useTranslation();\n  const { user, signOut, hasAnyRole } = useAuth();\n  const { membership } = useMyOrganization();\n  const hasOrg = !!membership;\n  const { theme, setTheme } = useTheme();\n  const isAdmin = hasAnyRole([\"admin\", \"super_admin\"]);\n  const pathname = useRouterState({ select: (state) => state.location.pathname });\n  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);\n  const accountName =\n    user?.user_metadata.display_name?.trim() || user?.email?.split(\"@\")[0] || \"Account\";\n  const accountInitial = accountName.charAt(0).toUpperCase();\n  const useDarkTheme = theme !== \"dark\";\n  const brandLabelClassName = \"text-lg font-bold tracking-tight text-brand-gradient sm:text-xl\";\n\n  // Mobile has no top bar at all — navigation lives in the bottom tab bar and\n  // the quick-nav pills under each search trigger. The fixed bottom nav must\n  // render outside the hidden header so it stays visible.\n  return (\n    <>\n      <header\n        className={cn(\n          \"sticky top-0 z-50 hidden w-full border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm lg:block\",\n          tone === \"dark\" && \"site-header--dark\",\n          className,\n        )}\n      >\n        <div className=\"mx-auto flex h-[64px] max-w-[1440px] items-center gap-2 px-4 sm:px-8 lg:gap-0 lg:px-10\">\n          <Link to=\"/\" className=\"flex shrink-0 items-center\" aria-label=\"MatchMax home\">\n            <div className=\"flex items-center gap-2\">\n              <Logo className=\"shrink-0\" />\n              <span className={brandLabelClassName}>MatchMax</span>\n            </div>\n          </Link>\n\n          <nav className=\"ml-12 flex items-center gap-9\">"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 608.1s)

_Thinking:_

Wait — there's an issue with the compact pill z-order: the compact pill container is `absolute inset-0` inside the nav row — it comes BEFORE the Link and nav in DOM, so it paints under them if overlapping. Since links are faded (opacity-0, pointer-events-none) overlap is only visual. But the account actions on the right (ml-auto div) come after in DOM → they'd paint above the pill if overlap at narrow widths — pill is `pointer-events-none` container with `pointer-events-auto` inner — the pill button clickable unless overlapped by right actions. The pill max width formula keeps it clear. OK.

Now Step 4 — split tutors-search.tsx. Plan:
- Extract desktop parts into `TutorsSearchBar` component: props { draft, onDraftChange, onApply, onClear, resultCount?, allPrices?, whatsappUrl?, className? }.
- Extract mobile parts into `TutorsSearchMobile`: props { draft, onDraftChange, onApply, onClear, defaultOverlayOpen?, className? }.
- Combined `TutorsSearch` keeps original props signature.
- Add `useTutorsCompactSummary(draft)` hook.

The current TutorsSearch body has shared derived state used by both parts:
- subjectOptions, suggestedSubjects (mobile)
- segments (desktop)
- overlayTabs (mobile)
- priceValue, priceHistogram, filterCount (desktop filters)
- quickPicks (desktop filters)
- applyLabel (desktop dialog + mobile overlay submit label)

Splitting:
- TutorsSearchBar: pillOpenId state, filtersOpen state, segments, quickPicks, priceValue, priceHistogram, filterCount, FiltersDialog with footerExtra (whatsappUrl), applyLabel (uses resultCount).
- TutorsSearchMobile: overlayOpen state, subjectOptions/suggestedSubjects, overlayTabs, applyLabel (uses resultCount — mobile overlay submit label "Show N tutors"), SearchBigInput etc.

Both need applyLabel → compute in each (resultCount prop needed in both). Combined TutorsSearch passes resultCount to both.

Careful with hooks: `useMemo` for priceValue/priceHistogram in Bar. `useNavigate` needed in Mobile (overlayTabs). `useTranslation` in both.

Also `handleCategorySelect` used by desktop segment + mobile select → duplicate in both (small). Actually desktop uses handleCategorySelect for category segment; mobile overlay uses it too. Keep local copies.

`modeDisplay` used in desktop segments + mobile? Mobile doesn't show modeDisplay. Desktop only.

Let me now rewrite tutors-search.tsx completely.

Note imports: PriceFields shared by both (desktop dialog + mobile overlay) — keep in file.

Summary hook: 
```ts
export function useTutorsCompactSummary(draft: TutorsSearchState): string {
  const { t } = useTranslation();
  const categoryLabel = (value: string) => {
    if (value === "Primary") return t("search_panel.category_primary_school");
    if (value === "Junior Secondary") return t("search_panel.category_junior_secondary");
    if (value === "Admissions") return t("search_panel.category_admissions");
    return value;
  };
  const mode = draft.mode === "in_person"
    ? (draft.station ? `${t("search_panel.mode_in_person")} · ${draft.station}` : t("search_panel.mode_in_person"))
    : draft.mode === "online" ? t("search_panel.mode_online") : "";
  const parts = [
    draft.q?.trim(),
    draft.category ? categoryLabel(draft.category) : "",
    draft.subject,
    mode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : t("search_ui.search_tutors");
}
```
Hmm — the desktop segment mode display uses search_panel.mode_in_person / mode_online — check these keys exist. Yes (used in current code).

Now write the new tutors-search.tsx. I'll restructure the file:

1. Imports (unchanged mostly + nothing new needed).
2. Types: TutorsSearchState, TutorsSearchProps (combined), TutorsSearchBarProps, TutorsSearchMobileProps.
3. Constants + helpers (PRICE_*, formatPrice, CATEGORY_VALUES, categoryLabel fn using t).
4. useTutorsCompactSummary.
5. TutorsSearchBar.
6. TutorsSearchMobile.
7. TutorsSearch (combined).
8. PriceFields, ModePanelContent (shared internal).

The categoryLabel fn is used in segments + summary: make a module-level function taking t: `const categoryLabel = (value: string, t: TFunction)` — repo pattern in cases-search: `caseCategoryLabel(value, t)` with `t: (key: string) => string`. Follow that.

Mode display shared too: `const modeDisplayLabel = (mode, station, t)`. Used in segments + summary.

Write the file now. Keep the styling identical. The combined TutorsSearch renders `<div className={className}><TutorsSearchBar .../><TutorsSearchMobile .../></div>` — wait original also had FiltersDialog between; now inside Bar. MobileSearchTrigger + overlay inside Mobile. Original order: bar row, FiltersDialog, MobileSearchTrigger, MobileSearchOverlay. New: Bar (row + FiltersDialog), Mobile (trigger + overlay). DOM order changes slightly (dialog before trigger vs after) — irrelevant (portals).

Note: TutorsSearchMobile without className renders `<div>` (block) — original MobileSearchTrigger rendered `lg:hidden` div. TutorsSearchMobile root: `<div className={cn("lg:hidden", className)}>`? Careful: it contains MobileSearchOverlay which is `fixed ... lg:hidden` — wrapping in `lg:hidden` div is fine (display none on lg hides children incl. fixed overlay — overlay only opens on mobile anyway). Original structure had trigger (lg:hidden) and overlay as siblings directly in root div — root visible on desktop too (empty). New: wrap both in `lg:hidden` — fine and cleaner. Actually wait — if defaultOverlayOpen is true on desktop (hopping tabs with open=true param)... `/tutors?open=1` on desktop: original code: MobileSearchOverlay `fixed inset-0 z-[70] ... lg:hidden` — hidden on lg regardless. So same behavior. OK.

TutorsSearchBar root: `<div className={className}>` containing `hidden lg:flex` row + FiltersDialog. On mobile nothing renders (row hidden). For the route, Bar goes inside StickySearchBar (lg:block) — Bar's className can be undefined.

Write it.

Step 4 — split `tutors-search.tsx`:

_Thinking:_

Wait — there's an issue with the compact pill centering: the container has `max-w-[1440px] mx-auto` — the absolute inset-0 div is relative to this row container (which I made `relative`). The pill will center within the 1440px-max container — matching the nav row. Good.

But also: the centerSlot div `absolute inset-0 flex items-center justify-center` + `pointer-events-none` — pill inside gets `pointer-events-auto` from CompactPillSlot motion.div. Good.

Step 4 — split tutors-search.tsx. The current component:
- Lines 82-556: TutorsSearch with desktop row + FiltersDialog + mobile trigger + overlay.

New structure:
- `TutorsSearchBar` — desktop row + FiltersDialog. Props: draft, onDraftChange, onApply, onClear, resultCount?, allPrices?, whatsappUrl?, className?
- `TutorsSearchMobile` — MobileSearchTrigger + MobileSearchOverlay. Props: draft, onDraftChange, onApply, onClear, defaultOverlayOpen?, className?
- `TutorsSearch` — combined (homepage), same original props.
- `useTutorsCompactSummary(draft)` — summary hook.

Shared logic: segments config (used by bar), overlayTabs (used by mobile), quickPicks (bar's dialog), priceValue/priceHistogram (bar's dialog), subjectOptions/suggestedSubjects (bar segments + mobile overlay), applyLabel (bar submit? no — submitLabel is t("search_panel.search"); applyLabel used in FiltersDialog footer apply + mobile overlay submit).

Let me restructure carefully:

```tsx
// ---- shared helpers ----
function useTutorsSearchPieces(draft, onDraftChange, onApply, onClear, opts) {...}
```
Hmm — both Bar and Mobile need some common derivations (subjectOptions, modeDisplay, categoryOptions, statusOptions, sortOptions, genderOptions, handleCategorySelect, handleModeChange, priceValue). Rather than a mega-hook, compute inside each component (small duplication) — but subjectOptions/suggestedSubjects/options lists needed in both. A shared hook is cleaner:

```tsx
function useTutorsSearchOptions(draft: TutorsSearchState, onDraftChange) {
  const { t } = useTranslation();
  const subjectOptions = getSubjectOptionsForCategory(draft.category);
  const suggestedSubjects = subjectOptions.length > 0 ? subjectOptions : DEFAULT_SUBJECT_OPTIONS;
  const handleCategorySelect = ...
  const handleModeChange = ...
  const priceValue = useMemo(...)
  ... categoryOptions, statusOptions, sortOptions, genderOptions, modeDisplay
  return {...}
}
```
And segments builder as a plain function taking everything. And overlayTabs builder for mobile.

Let me write the new file content for the relevant sections. I'll rewrite tutors-search.tsx wholesale (keeping PriceFields, ModePanelContent unchanged, plus imports).

Structure:

```tsx
export type TutorsSearchState = {...} // unchanged
const PRICE_MIN..., formatPrice, CATEGORY_VALUES // unchanged

type TutorsSearchBarProps = {
  draft, onDraftChange, onApply, onClear,
  resultCount?: number,
  allPrices?: number[],
  whatsappUrl?: string,
  className?: string,
};

type TutorsSearchMobileProps = {
  draft, onDraftChange, onApply, onClear,
  defaultOverlayOpen?: boolean,
  className?: string,
};

type TutorsSearchProps = TutorsSearchBarProps-ish & mobile: keep original combined props: draft, onDraftChange, onApply, onClear, resultCount?, allPrices?, defaultOverlayOpen?, whatsappUrl?, className?

/** Shared derived options/labels for the tutors search segments + overlay. */
function useTutorsSearchOptions(draft, onDraftChange) { ... }

function buildSegments({...}): PillSegment[] // needs many inputs; or build inside Bar and Mobile separately? Mobile doesn't use segments. Only Bar uses segments.

export function TutorsSearchBar({...}) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pillOpenId, setPillOpenId] = useState<string|null>(null);
  const options = useTutorsSearchOptions(draft, onDraftChange);
  const segments = ... (build inline using options)
  const filterCount = ...
  const applyLabel = ...
  const quickPicks = ...
  return (
    <div className={className}>
      <div className="hidden items-stretch gap-2 lg:flex">...</div>
      <FiltersDialog ...>...</FiltersDialog>
    </div>
  );
}
```

Wait — the desktop row wrapper: original `<div className="hidden items-stretch gap-2 lg:flex">`. In the new StickySearchBar context, the bar row is always desktop; keep the `hidden lg:flex` for safety (StickySearchBar is hidden below lg anyway).

Hmm, actually since StickySearchBar is `hidden lg:block`, the row inside doesn't need `hidden lg:flex` — but harmless to keep for the homepage combined usage (where TutorsSearchBar renders standalone without sticky wrapper — needs the hidden class!). Keep it.

Mobile:
```tsx
export function TutorsSearchMobile({ draft, onDraftChange, onApply, onClear, defaultOverlayOpen, className }: TutorsSearchMobileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));
  const options = useTutorsSearchOptions(draft, onDraftChange);
  const overlayTabs = ...
  const applyLabel = ...
  return (
    <div className={className}>
      <MobileSearchTrigger ... />
      <MobileSearchOverlay ...>...</MobileSearchOverlay>
    </div>
  );
}
```

Combined:
```tsx
export function TutorsSearch(props: TutorsSearchProps) {
  const { draft, onDraftChange, onApply, onClear, resultCount, allPrices, defaultOverlayOpen, whatsappUrl, className } = props;
  return (
    <div className={className}>
      <TutorsSearchBar draft={draft} onDraftChange={onDraftChange} onApply={onApply} onClear={onClear} resultCount={resultCount} allPrices={allPrices} whatsappUrl={whatsappUrl} />
      <TutorsSearchMobile draft={draft} onDraftChange={onDraftChange} onApply={onApply} onClear={onClear} defaultOverlayOpen={defaultOverlayOpen} />
    </div>
  );
}
```
Wait — original combined wrapped everything in `<div className={className}>`; new combined: outer div className + inner components also render their own divs with className... Bar gets no className (inner hidden lg:flex + dialog). Mobile gets no className. So combined = wrapper div + children divs. Original was flat. Slight DOM change on homepage (extra wrapper divs) — harmless.

Hmm — but on the homepage, TutorsSearchBar with `hidden lg:flex` row: same as before. MobileSearchTrigger: `lg:hidden`. Same. 

useTutorsSearchOptions hook: contains subjectOptions, suggestedSubjects, handleCategorySelect, handleModeChange, priceValue, priceHistogram? — priceHistogram needs allPrices (bar-only). Keep priceHistogram in Bar. priceValue needed by Bar (histogram + price fields) AND Mobile (price labels + PriceFields) — include in hook.

modeDisplay: needed in Bar segments AND Mobile? Mobile overlay doesn't show modeDisplay (it shows ModePanelContent). Only Bar. But compact summary needs it — separate hook. Fine, keep modeDisplay in both bar & summary hook... duplication again. Alternatively include modeDisplay in shared hook (bar uses; summary hook could use it too... summary hook separate file-level). Let me make ONE hook `useTutorsSearchOptions(draft, onDraftChange)` that returns everything including modeDisplay, categoryLabel fn, and also `compactSummary` string! Then:

- Bar uses: segments, priceValue, priceHistogram (local), quickPicks (local), filterCount (local).
- Mobile uses: subjectOptions/suggestedSubjects, options lists, handleCategorySelect, handleModeChange, priceValue, applyLabel? (applyLabel needs resultCount — bar-only prop... mobile overlay submitLabel = applyLabel which includes resultCount? Original: `applyLabel` computed from resultCount; used in FiltersDialog applyLabel AND MobileSearchOverlay submitLabel. resultCount prop exists only on combined/bar. Hmm — original mobile overlay used applyLabel (with resultCount). So TutorsSearchMobile needs resultCount too?? On the directory pages, resultCount was passed to TutorsSearch — mobile trigger/overlay in hero used applyLabel with count. If I split, mobile needs resultCount as well to preserve behavior. 

Wait — actually does the mobile overlay even show on desktop pages... it shows on mobile where results count is also meaningful. To preserve exact behavior, pass resultCount to both Bar and Mobile (props allow optional). But resultCount comes from `filtered.length` in route — fine, pass to both. On homepage, combined passes to both.

So Mobile props add `resultCount?: number`. Hmm — but was applyLabel used on mobile? Yes: `submitLabel={applyLabel}`. Keep.

OK so shared hook returns:
- subjectOptions, suggestedSubjects
- handleCategorySelect, handleModeChange
- priceValue
- categoryOptions, statusOptions, sortOptions, genderOptions, modeDisplay, categoryLabel (for summary + segments)

compactSummary: separate exported hook `useTutorsCompactSummary(draft)` reusing tiny logic (categoryLabel + modeDisplay duplication ~15 lines). Acceptable.

Actually — cleaner: make the shared options hook ALSO return compactSummary. Then route calls `const { compactSummary } = useTutorsSearchOptions(draft, setDraftParam)`? Route passes onDraftChange = setDraftParam — the hook needs onDraftChange for handleCategorySelect/handleModeChange. Route has setDraftParam. So route: `const { compactSummary } = useTutorsSearchOptions(draft, setDraftParam);` Hmm — but Bar/Mobile each also call it — 3 calls, each recomputing memos — fine (cheap).

But wait — hook uses `useNavigate`? No. It uses t() + draft + onDraftChange. OK.

Let me define in tutors-search.tsx:

```tsx
/** Shared segment/option derivations for the tutors desktop bar and mobile overlay. */
function useTutorsSearchOptions(draft: TutorsSearchState, onDraftChange: (patch: Partial<TutorsSearchState>) => void) {
  const { t } = useTranslation();

  const subjectOptions = getSubjectOptionsForCategory(draft.category);
  const suggestedSubjects = subjectOptions.length > 0 ? subjectOptions : DEFAULT_SUBJECT_OPTIONS;

  const handleCategorySelect = (category: string) => {
    const nextSubjects = getSubjectOptionsForCategory(category);
    onDraftChange({
      category: category || undefined,
      ...(draft.subject && !nextSubjects.includes(draft.subject) ? { subject: undefined } : {}),
    });
  };

  const handleModeChange = (next: { mode: string; station?: string }) => {
    onDraftChange({
      mode: next.mode || undefined,
      station: next.mode === "in_person" ? next.station : undefined,
    });
  };

  const priceValue = useMemo(
    () => [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX] as [number, number],
    [draft.min_price, draft.max_price],
  );

  const categoryLabel = (value: string) => {...};
  const categoryOptions: OptionRow[] = [...];
  const statusOptions = [...];
  const sortOptions = [...];
  const genderOptions = [...];
  const modeDisplay = ...;
  const compactSummary = [
    draft.q?.trim(),
    draft.category ? categoryLabel(draft.category) : "",
    draft.subject,
    draft.mode ? modeDisplay : "",
  ].filter(Boolean).join(" · ") || t("search_ui.search_tutors");

  return { subjectOptions, suggestedSubjects, handleCategorySelect, handleModeChange, priceValue, categoryLabel, categoryOptions, statusOptions, sortOptions, genderOptions, modeDisplay, compactSummary };
}
```

But it's module-private; export a public summary hook:
```tsx
export function useTutorsCompactSummary(draft: TutorsSearchState): string {
  return useTutorsSearchOptions(draft, () => {}).compactSummary;
}
```
Noop onDraftChange — fine (handlers unused).

Now write the whole new tutors-search.tsx. It's long; let me carefully compose it with all pieces (keeping PriceFields + ModePanelContent as-is).

Also — `KeywordPanelContent` import stays (used in segments + mobile overlay uses SearchBigInput directly).

Imports needed: same as before + nothing new.

Let me now write the file. I'll rewrite the full file to keep it coherent.

Step 4 — rewrite `tutors-search.tsx` with the split:

_Thinking:_

Now step 4 — split `tutors-search.tsx`. The plan:
- `TutorsSearchBar`: desktop row (SearchPillBar + FiltersPillButton + FiltersDialog). Props: draft, onDraftChange, onApply, onClear, resultCount?, allPrices?, whatsappUrl?, className?
- `TutorsSearchMobile`: MobileSearchTrigger + MobileSearchOverlay. Props: draft, onDraftChange, onApply, onClear, defaultOverlayOpen?, className?
- `TutorsSearch` combined for homepage.
- `useTutorsCompactSummary(draft)` hook.

Note: shared bits between Bar and Mobile: segments config, overlayTabs, quickPicks, categoryOptions, etc. The segments are needed by the Bar only. overlayTabs by Mobile. To avoid duplicating logic, I can create shared internal helper components/hooks within the file:

Structure:
```tsx
function useTutorsSegments(draft, onDraftChange): PillSegment[] { ... }  // includes subjectOptions etc.
```
Hmm — segments need subjectOptions + category label logic; the Mobile needs subjectOptions too (suggested subjects). Let me restructure with a `useTutorsSearchModel(draft, onDraftChange)` hook returning { segments, subjectOptions/suggestedSubjects, overlayTabs? } — overlayTabs need navigate. Keep it simpler:

Actually simplest: keep one internal function that builds segments (needs draft + onDraftChange + t). Since t comes from useTranslation, and navigate for overlay tabs... Let me write:

```tsx
function useTutorsSegments(draft: TutorsSearchState, onDraftChange): PillSegment[] {
  const { t } = useTranslation();
  const subjectOptions = getSubjectOptionsForCategory(draft.category);
  const suggestedSubjects = subjectOptions.length > 0 ? subjectOptions : DEFAULT_SUBJECT_OPTIONS;
  const handleCategorySelect = ...
  const modeDisplay = ...
  const categoryOptions: OptionRow[] = ...
  const segments = ...
  return { segments, suggestedSubjects };
}
```
Returns object. Bar uses segments; Mobile uses suggestedSubjects (and its own SearchableSelect lists — categoryOptions needed in Mobile too! The mobile overlay has category SearchableSelect with categoryOptions). So hook returns { segments, suggestedSubjects, categoryOptions, genderOptions, statusOptions, sortOptions, modeDisplay }.

Let me define a single hook `useTutorsSearchModel(draft, onDraftChange)` returning everything shared. Then:

- TutorsSearchBar: uses segments + filterCount + price histogram etc. (price histogram stays in Bar — it's for FiltersDialog; Mobile has PriceFields without histogram).
- TutorsSearchMobile: uses overlay tabs + mobile panel contents.
- TutorsSearch (combined) calls both.

Wait — the current TutorsSearch computes: quickPicks (Bar), segments (Bar), overlayTabs (Mobile), priceHistogram (Bar), applyLabel (both: Bar submit uses resultCount; Mobile submit uses applyLabel). Hmm applyLabel used in Mobile submitLabel and FiltersDialog applyLabel (Bar). resultCount prop drives applyLabel; Mobile gets resultCount too.

Let me lay out the new file structure concretely:

```tsx
export type TutorsSearchState = {...};
// constants PRICE_MIN etc.

type TutorsSearchSharedProps = {
  draft: TutorsSearchState;
  onDraftChange: (patch: Partial<TutorsSearchState>) => void;
  onApply: (override?: Partial<TutorsSearchState>) => void;
  onClear: () => void;
};

/** Shared model: option lists, segment configs, quick picks, labels. */
function useTutorsSearchModel(draft, onDraftChange) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  ... categoryOptions, statusOptions, sortOptions, genderOptions
  ... handleCategorySelect, handleModeChange
  ... priceValue? (needed by both: Bar histogram/slider, Mobile slider) — include priceValue + formatPrice usage
  ... quickPicks (Bar only — but harmless here)
  ... segments (Bar)
  ... modeDisplay
  ... filterCount (Bar)
  ... suggestedSubjects (Mobile)
  ... overlayTabs (Mobile)
  ... applyLabel (needs resultCount — pass as arg?)
}
```
applyLabel depends on resultCount which only the page knows. Pass resultCount into the hook? TutorsSearchMobile needs applyLabel; Bar's FiltersDialog + submit also. So hook param: `resultCount?: number`.

This is a lot of prop-drilling refactor. Alternative simpler approach that avoids the mega-hook: **TutorsSearchBar takes optional render of mobile? No.**

Simplest robust refactor with minimal risk: keep the shared logic in module-scope pure functions taking (draft, t) and callbacks:

- `buildCategoryOptions(t): OptionRow[]` (pure)
- `buildStatusOptions(t)`, `buildSortOptions(t)`, `buildGenderOptions(t)`
- `categoryLabel(value, t)`
- `modeDisplayOf(draft, t)`
- `subjectOptionsFor(draft.category)` — exists already (getSubjectOptionsForCategory)

Then TutorsSearchBar composes them, TutorsSearchMobile composes them. Small duplication of composition code, no behavior drift. 

Let me now rewrite tutors-search.tsx fully. I'll write the whole new file content.

Key pieces:

```tsx
export function useTutorsCompactSummary(draft: TutorsSearchState): string {
  const { t } = useTranslation();
  const parts = [
    draft.q?.trim() || "",
    draft.category ? tutorsCategoryLabel(draft.category, t) : "",
    draft.subject ?? "",
    draft.mode ? modeDisplayOf(draft, t) : "",
  ].filter(Boolean);
  return parts.join(" · ") || t("search_ui.search_tutors");
}
```
Hmm modeDisplay when unfilled = t("search_ui.any_value") = "Any" — for summary only include if filled. And category label function: rename to avoid collision.

Full new tutors-search.tsx:

```tsx
import { ... } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { PanelLabel, SearchBigInput, Segmented, SuggestedRow, type OptionRow } from "./search-controls";
import { FilterQuickPicks, FiltersDialog, FiltersPillButton, FiltersSection } from "./filters-dialog";
import { KeywordPanelContent, SearchPillBar, type PillSegment } from "./search-pill-bar";
import { MobileSearchOverlay, type MobileSearchTab } from "./mobile-search-overlay";
import { setSearchSlideDirection } from "./slide-direction";
import { MobileSearchTrigger } from "./mobile-search-trigger";
import { MtrStationPickerContent } from "@/components/ui/mtr-station-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { DEFAULT_SUBJECT_OPTIONS, getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { cn } from "@/lib/utils";

export type TutorsSearchState = {...}

const PRICE_MIN = 100; ... etc
const CATEGORY_VALUES = [...]
const formatPrice = ...

const tutorsCategoryLabel = (value: string, t) => {...}
const tutorsModeDisplay = (draft, t) => {...}

type TutorsSearchProps = { draft, onDraftChange, onApply, onClear, resultCount?, allPrices?, defaultOverlayOpen?, whatsappUrl?, className? };

export function useTutorsCompactSummary(draft) {...}

/** Desktop pill row + filters dialog. Pairs with StickySearchBar on directory pages. */
export function TutorsSearchBar({ draft, onDraftChange, onApply, onClear, resultCount, allPrices, whatsappUrl, className }: TutorsSearchProps) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pillOpenId, setPillOpenId] = useState<string|null>(null);

  const subjectOptions = getSubjectOptionsForCategory(draft.category);
  const handleCategorySelect = ...
  const handleModeChange = ...
  const priceValue = useMemo(...)
  const priceHistogram = useMemo(...)
  const filterCount = ...
  const categoryOptions = ...
  const statusOptions = ...
  const sortOptions = ...
  const genderOptions = ...
  const modeDisplay = tutorsModeDisplay(draft, t)
  const applyLabel = ...
  const quickPicks = ...
  const segments = ...

  return (
    <div className={className}>
      <div className="hidden items-stretch gap-2 lg:flex"> ... </div>
      <FiltersDialog .../>
    </div>
  );
}
```

Hmm wait — the desktop row itself is `hidden lg:flex` — inside StickySearchBar (hidden lg:block). Redundant but harmless; keep for homepage combined usage.

```tsx
/** Mobile trigger + overlay. */
export function TutorsSearchMobile({ draft, onDraftChange, onApply, onClear, defaultOverlayOpen, className }: Omit<TutorsSearchProps, "resultCount"|"allPrices"|"whatsappUrl">) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));
  ... subjectOptions, suggestedSubjects
  ... categoryOptions, genderOptions, statusOptions, sortOptions
  ... modeDisplay
  const applyLabel = resultCount... — needs resultCount! Mobile submit shows "Show N tutors". Keep resultCount in Mobile props too.
  ... overlayTabs

  return (
    <div className={className}>
      <MobileSearchTrigger .../>
      <MobileSearchOverlay ...>...</MobileSearchOverlay>
    </div>
  );
}

/** Homepage composition: desktop row + mobile in one wrapper. */
export function TutorsSearch(props: TutorsSearchProps) {
  const { className, ...rest } = props;
  return (
    <div className={className}>
      <TutorsSearchBar {...rest} />
      <TutorsSearchMobile {...rest} />
    </div>
  );
}
```
Careful: combined TutorsSearch previously rendered ONE FiltersDialog + trigger + overlay; new combined renders Bar (includes FiltersDialog) + Mobile. Same DOM. 

Also `resultCount` needed by both → keep in shared props type. Mobile's props = same type minus whatsappUrl. Simplest: one props type for all; components use what they need. But lint may complain unused props destructured — I'll destructure only what's used per component and accept optional props in type. TS won't complain about unused type fields, only unused destructured vars. So define one `TutorsSearchProps` and each component destructures its own subset.

applyLabel for Mobile: `resultCount === undefined ? t("search_ui.search_tutors") : t("search_ui.show_tutors", { count: resultCount })` — duplicate the small expression in both (fine).

Now write the file. I must be careful to preserve exact JSX for the desktop row, filters dialog, mobile overlay (copy from current file, redistributed).

Also note: `useNavigate` was used for overlayTabs (mobile) — moves to Mobile. `CENTRE_MARKET_ENABLED` in Mobile. `setSearchSlideDirection` Mobile. `WhatsAppIcon` in Bar (filters dialog footer). `Slider`, `Input` in Bar (PriceFields with histogram) — but PriceFields is shared between Bar (with histogram) and Mobile (without) — keep PriceFields as shared internal component (used by both) — needs onDraftChange typed to TutorsSearchState patch. Keep as-is.

ModePanelContent shared too.

Let me write the complete new tutors-search.tsx.

Step 4 — split `tutors-search.tsx`. Writing the restructured file:

**Tool: write**

**Input:**
```json
{
  "content": "import {\n  BadgeCheck,\n  BookOpen,\n  Briefcase,\n  ClipboardList,\n  Coins,\n  GraduationCap,\n  MapPin,\n  Monitor,\n  UserRound,\n  Users,\n} from \"lucide-react\";\nimport { useNavigate } from \"@tanstack/react-router\";\nimport { useMemo, useState } from \"react\";\nimport { useTranslation } from \"react-i18next\";\n\nimport { WhatsAppIcon } from \"@/components/layout/WhatsAppFloatButton\";\nimport {\n  PanelLabel,\n  SearchBigInput,\n  Segmented,\n  SuggestedRow,\n  type OptionRow,\n} from \"./search-controls\";\nimport {\n  FilterQuickPicks,\n  FiltersDialog,\n  FiltersPillButton,\n  FiltersSection,\n} from \"./filters-dialog\";\nimport { KeywordPanelContent, SearchPillBar, type PillSegment } from \"./search-pill-bar\";\nimport { MobileSearchOverlay, type MobileSearchTab } from \"./mobile-search-overlay\";\nimport { setSearchSlideDirection } from \"./slide-direction\";\nimport { MobileSearchTrigger } from \"./mobile-search-trigger\";\nimport { MtrStationPickerContent } from \"@/components/ui/mtr-station-select\";\nimport { SearchableSelect } from \"@/components/ui/searchable-select\";\nimport { Slider } from \"@/components/ui/slider\";\nimport { Input } from \"@/components/ui/input\";\nimport { CENTRE_MARKET_ENABLED } from \"@/lib/feature-flags\";\nimport { DEFAULT_SUBJECT_OPTIONS, getSubjectOptionsForCategory } from \"@/features/tutors/subjects\";\nimport { cn } from \"@/lib/utils\";\n\nexport type TutorsSearchState = {\n  category?: string;\n  subject?: string;\n  station?: string;\n  mode?: string;\n  gender?: string;\n  status?: string;\n  min_price?: number;\n  max_price?: number;\n  sort?: string;\n  q?: string;\n};\n\nconst PRICE_MIN = 100;\nconst PRICE_MAX = 1200;\nconst PRICE_STEP = 10;\nconst HISTOGRAM_BUCKETS = 28;\n\nconst CATEGORY_VALUES = [\"IB\", \"DSE\", \"IGCSE\", \"AP\", \"A-Level\"];\n\nconst formatPrice = (price: number) =>\n  price === PRICE_MAX ? `HK$${price.toLocaleString()}+` : `HK$${price.toLocaleString()}`;\n\nconst tutorsCategoryLabel = (value: string, t: (key: string) => string) => {\n  if (value === \"Primary\") return t(\"search_panel.category_primary_school\");\n  if (value === \"Junior Secondary\") return t(\"search_panel.category_junior_secondary\");\n  if (value === \"Admissions\") return t(\"search_panel.category_admissions\");\n  return value;\n};\n\nconst tutorsModeDisplay = (draft: TutorsSearchState, t: (key: string) => string) => {\n  if (draft.mode === \"in_person\") {\n    return draft.station\n      ? `${t(\"search_panel.mode_in_person\")} · ${draft.station}`\n      : t(\"search_panel.mode_in_person\");\n  }\n  if (draft.mode === \"online\") return t(\"search_panel.mode_online\");\n  return t(\"search_ui.any_value\");\n};\n\nexport type TutorsSearchProps = {\n  draft: TutorsSearchState;\n  onDraftChange: (patch: Partial<TutorsSearchState>) => void;\n  /** Apply the current draft (navigate). `override` merges values set in the same event. */\n  onApply: (override?: Partial<TutorsSearchState>) => void;\n  onClear: () => void;\n  /** Live count for the \"Show N tutors\" button; omit for a plain \"Search tutors\" label. */\n  resultCount?: number;\n  /** All published tutors' hourly rates — powers the price histogram. */\n  allPrices?: number[];\n  /** Open the mobile overlay on mount (used when hopping between search tabs). */\n  defaultOverlayOpen?: boolean;\n  whatsappUrl?: string;\n  className?: string;\n};\n\n/** One-line summary for the compact nav pill while the full bar is retracted. */\nexport function useTutorsCompactSummary(draft: TutorsSearchState): string {\n  const { t } = useTranslation();\n  const parts = [\n    draft.q?.trim() ?? \"\",\n    draft.category ? tutorsCategoryLabel(draft.category, t) : \"\",\n    draft.subject ?? \"\",\n    draft.mode ? tutorsModeDisplay(draft, t) : \"\",\n  ].filter(Boolean);\n  return parts.length > 0 ? parts.join(\" · \") : t(\"search_ui.search_tutors\");\n}\n\n/**\n * Desktop Airbnb-style pill row (segment bar + filters). On directory pages\n * this is hosted by StickySearchBar so it pins under the nav and retracts on\n * scroll; on the homepage it renders in the hero as before.\n */\nexport function TutorsSearchBar({\n  draft,\n  onDraftChange,\n  onApply,\n  onClear,\n  resultCount,\n  allPrices,\n  whatsappUrl,\n  className,\n}: TutorsSearchProps) {\n  const { t } = useTranslation();\n  const [filtersOpen, setFiltersOpen] = useState(false);\n  const [pillOpenId, setPillOpenId] = useState<string | null>(null);\n\n  const subjectOptions = getSubjectOptionsForCategory(draft.category);\n\n  const handleCategorySelect = (category: string) => {\n    const nextSubjects = getSubjectOptionsForCategory(category);\n    onDraftChange({\n      category: category || undefined,\n      ...(draft.subject && !nextSubjects.includes(draft.subject) ? { subject: undefined } : {}),\n    });\n  };\n\n  const handleModeChange = (next: { mode: string; station?: string }) => {\n    onDraftChange({\n      mode: next.mode || undefined,\n      station: next.mode === \"in_person\" ? next.station : undefined,\n    });\n  };\n\n  const priceValue = useMemo(\n    () => [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX] as [number, number],\n    [draft.min_price, draft.max_price],\n  );\n\n  const priceHistogram = useMemo(() => {\n    if (!allPrices || allPrices.length === 0) return null;\n    const span = PRICE_MAX - PRICE_MIN;\n    const buckets = new Array<number>(HISTOGRAM_BUCKETS).fill(0);\n    for (const price of allPrices) {\n      const clamped = Math.min(Math.max(price, PRICE_MIN), PRICE_MAX);\n      const index = Math.min(\n        HISTOGRAM_BUCKETS - 1,\n        Math.floor(((clamped - PRICE_MIN) / span) * HISTOGRAM_BUCKETS),\n      );\n      buckets[index] += 1;\n    }\n    const peak = Math.max(...buckets, 1);\n    return buckets.map((count, index) => ({\n      level: count / peak,\n      inRange:\n        (index + 0.5) / HISTOGRAM_BUCKETS >= (priceValue[0] - PRICE_MIN) / span &&\n        (index + 0.5) / HISTOGRAM_BUCKETS <= (priceValue[1] - PRICE_MIN) / span,\n    }));\n    // priceValue is derived from draft; histogram re-tints when the range moves.\n  }, [allPrices, priceValue]);\n\n  const filterCount = [\n    draft.gender,\n    draft.status,\n    draft.min_price !== undefined ? \"price\" : \"\",\n    draft.max_price !== undefined ? \"price\" : \"\",\n    draft.sort,\n  ].filter(Boolean).length;\n\n  const categoryOptions: OptionRow[] = [\n    ...CATEGORY_VALUES.map((value) => ({ value, label: value })),\n    { value: \"Primary\", label: t(\"search_panel.category_primary_school\") },\n    { value: \"Junior Secondary\", label: t(\"search_panel.category_junior_secondary\") },\n    { value: \"Admissions\", label: t(\"search_panel.category_admissions\") },\n  ];\n\n  const statusOptions = [\n    { value: \"\", label: t(\"search_panel.any_status\") },\n    { value: \"uni_student\", label: t(\"search_panel.status_uni_student\") },\n    { value: \"full_part_time_tutor\", label: t(\"search_panel.status_full_part_time\") },\n    { value: \"examiner\", label: t(\"search_panel.status_examiner\") },\n  ];\n\n  const sortOptions = [\n    { value: \"\", label: t(\"search_panel.sort_recommended\") },\n    { value: \"price_asc\", label: t(\"search_panel.sort_price_asc\") },\n    { value: \"price_desc\", label: t(\"search_panel.sort_price_desc\") },\n  ];\n\n  const genderOptions = [\n    { value: \"\", label: t(\"search_ui.gender_any\") },\n    { value: \"female\", label: t(\"search_panel.gender_female\") },\n    { value: \"male\", label: t(\"search_panel.gender_male\") },\n  ];\n\n  const modeDisplay = tutorsModeDisplay(draft, t);\n\n  const applyLabel =\n    resultCount === undefined\n      ? t(\"search_ui.search_tutors\")\n      : t(\"search_ui.show_tutors\", { count: resultCount });\n\n  const quickPicks = [\n    {\n      id: \"uni\",\n      label: t(\"search_ui.pick_uni\"),\n      icon: GraduationCap,\n      active: draft.status === \"uni_student\",\n      onToggle: () =>\n        onDraftChange({ status: draft.status === \"uni_student\" ? undefined : \"uni_student\" }),\n    },\n    {\n      id: \"examiner\",\n      label: t(\"search_ui.pick_examiner\"),\n      icon: BadgeCheck,\n      active: draft.status === \"examiner\",\n      onToggle: () =>\n        onDraftChange({ status: draft.status === \"examiner\" ? undefined : \"examiner\" }),\n    },\n    {\n      id: \"fullpart\",\n      label: t(\"search_ui.pick_full_part\"),\n      icon: Briefcase,\n      active: draft.status === \"full_part_time_tutor\",\n      onToggle: () =>\n        onDraftChange({\n          status: draft.status === \"full_part_time_tutor\" ? undefined : \"full_part_time_tutor\",\n        }),\n    },\n    {\n      id: \"female\",\n      label: t(\"search_ui.pick_female\"),\n      icon: UserRound,\n      active: draft.gender === \"female\",\n      onToggle: () => onDraftChange({ gender: draft.gender === \"female\" ? undefined : \"female\" }),\n    },\n    {\n      id: \"male\",\n      label: t(\"search_ui.pick_male\"),\n      icon: Users,\n      active: draft.gender === \"male\",\n      onToggle: () => onDraftChange({ gender: draft.gender === \"male\" ? undefined : \"male\" }),\n    },\n    {\n      id: \"budget\",\n      label: t(\"search_ui.pick_budget\"),\n      icon: Coins,\n      active: draft.max_price === 300,\n      onToggle: () => onDraftChange({ max_price: draft.max_price === 300 ? undefined : 300 }),\n    },\n    {\n      id: \"online\",\n      label: t(\"search_ui.pick_online\"),\n      icon: Monitor,\n      active: draft.mode === \"online\",\n      onToggle: () => onDraftChange({ mode: draft.mode === \"online\" ? undefined : \"online\" }),\n    },\n    {\n      id: \"inperson\",\n      label: t(\"search_ui.pick_in_person\"),\n      icon: MapPin,\n      active: draft.mode === \"in_person\",\n      onToggle: () => onDraftChange({ mode: draft.mode === \"in_person\" ? undefined : \"in_person\" }),\n    },\n  ];\n\n  const segments: PillSegment[] = [\n    {\n      id: \"keyword\",\n      label: t(\"search_ui.segment_keyword\"),\n      title: t(\"search_ui.panel_keyword_title\"),\n      display: draft.q?.trim() ? draft.q : t(\"search_panel.keyword_placeholder\"),\n      filled: Boolean(draft.q?.trim()),\n      grow: \"flex-[1.3]\",\n      content: (\n        <KeywordPanelContent\n          value={draft.q ?? \"\"}\n          onValueChange={(q) => onDraftChange({ q: q || undefined })}\n          placeholder={t(\"search_panel.keyword_placeholder\")}\n          ariaLabel={t(\"search_panel.keyword_aria\")}\n        />\n      ),\n    },\n    {\n      id: \"category\",\n      label: t(\"search_ui.segment_curriculum\"),\n      display: draft.category ? tutorsCategoryLabel(draft.category, t) : t(\"search_ui.any_value\"),\n      filled: Boolean(draft.category),\n      options: categoryOptions,\n      currentValue: draft.category,\n      searchPlaceholder: t(\"search_panel.search_category\"),\n      emptyText: t(\"search_panel.no_matches\"),\n      onSelect: handleCategorySelect,\n    },\n    {\n      id: \"subject\",\n      label: t(\"search_ui.segment_subject\"),\n      display: draft.subject ?? t(\"search_ui.any_value\"),\n      filled: Boolean(draft.subject),\n      options: subjectOptions.map((subject) => ({ value: subject, label: subject })),\n      currentValue: draft.subject,\n      searchPlaceholder: t(\"search_panel.search_subject\"),\n      emptyText: t(\"search_panel.no_matches\"),\n      onSelect: (value) => onDraftChange({ subject: value || undefined }),\n    },\n    {\n      id: \"mode\",\n      label: t(\"search_ui.segment_mode\"),\n      display: modeDisplay,\n      filled: Boolean(draft.mode),\n      panelClassName: \"w-[min(22rem,calc(100vw-2rem))]\",\n      content: (\n        <ModePanelContent\n          mode={draft.mode ?? \"\"}\n          station={draft.station}\n          onChange={handleModeChange}\n        />\n      ),\n    },\n  ];\n\n  return (\n    <div className={className}>\n      <div className=\"hidden items-stretch gap-2 lg:flex\">\n        <SearchPillBar\n          segments={segments}\n          submitLabel={t(\"search_panel.search\")}\n          submitColor=\"blue\"\n          onSubmit={() => onApply()}\n          className=\"min-w-0 flex-1\"\n          openSegmentId={pillOpenId}\n          onOpenSegmentIdChange={setPillOpenId}\n        />\n        <FiltersPillButton\n          label={t(\"search_ui.filters\")}\n          count={filterCount || undefined}\n          onClick={() => {\n            setPillOpenId(null);\n            setFiltersOpen(true);\n          }}\n        />\n      </div>\n\n      <FiltersDialog\n        open={filtersOpen}\n        onOpenChange={setFiltersOpen}\n        clearLabel={t(\"search_ui.clear_all\")}\n        applyLabel={applyLabel}\n        onClear={onClear}\n        onApply={() => onApply()}\n        footerExtra={\n          whatsappUrl ? (\n            <a\n              href={whatsappUrl}\n              target=\"_blank\"\n              rel=\"noreferrer\"\n              className=\"inline-flex shrink-0 items-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[color:var(--brand-whatsapp-hover)]\"\n            >\n              <WhatsAppIcon className=\"h-4 w-4\" aria-hidden=\"true\" />\n              {t(\"directory.empty_whatsapp\")}\n            </a>\n          ) : undefined\n        }\n      >\n        <FiltersSection id=\"recommended\" title={t(\"search_ui.quick_title\")}>\n          <FilterQuickPicks options={quickPicks} />\n        </FiltersSection>\n        <FiltersSection\n          id=\"price\"\n          title={t(\"search_panel.price_range\")}\n          hint={t(\"search_ui.price_hint\")}\n        >\n          <PriceFields\n            priceValue={priceValue}\n            histogram={priceHistogram}\n            onDraftChange={onDraftChange}\n          />\n        </FiltersSection>\n        <FiltersSection id=\"gender\" title={t(\"search_ui.gender_title\")}>\n          <Segmented\n            aria-label={t(\"search_panel.any_gender\")}\n            value={draft.gender ?? \"\"}\n            onChange={(gender) => onDraftChange({ gender: gender || undefined })}\n            options={genderOptions}\n            className=\"max-w-xs\"\n          />\n        </FiltersSection>\n        <FiltersSection id=\"status\" title={t(\"search_ui.status_title\")}>\n          <SearchableSelect\n            value={draft.status ?? \"\"}\n            onChange={(value) => onDraftChange({ status: value || undefined })}\n            options={statusOptions}\n            placeholder={t(\"search_panel.any_status\")}\n            className=\"h-11 rounded-xl\"\n          />\n        </FiltersSection>\n        <FiltersSection id=\"sort\" title={t(\"search_ui.sort_title\")}>\n          <SearchableSelect\n            value={draft.sort ?? \"\"}\n            onChange={(value) => onDraftChange({ sort: value || undefined })}\n            options={sortOptions}\n            placeholder={t(\"search_panel.sort_recommended\")}\n            searchPlaceholder={t(\"search_panel.search_sorting\")}\n            className=\"h-11 rounded-xl\"\n          />\n        </FiltersSection>\n      </FiltersDialog>\n    </div>\n  );\n}\n\n/**\n * Mobile search entry: \"Start your search\" trigger + quick-nav pills and the\n * full-screen overlay. Rendered inside the hero section, untouched by the\n * desktop sticky search group.\n */\nexport function TutorsSearchMobile({\n  draft,\n  onDraftChange,\n  onApply,\n  onClear,\n  resultCount,\n  defaultOverlayOpen,\n  className,\n}: TutorsSearchProps) {\n  const { t } = useTranslation();\n  const navigate = useNavigate();\n  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));\n\n  const subjectOptions = getSubjectOptionsForCategory(draft.category);\n  const suggestedSubjects = subjectOptions.length > 0 ? subjectOptions : DEFAULT_SUBJECT_OPTIONS;\n\n  const handleCategorySelect = (category: string) => {\n    const nextSubjects = getSubjectOptionsForCategory(category);\n    onDraftChange({\n      category: category || undefined,\n      ...(draft.subject && !nextSubjects.includes(draft.subject) ? { subject: undefined } : {}),\n    });\n  };\n\n  const handleModeChange = (next: { mode: string; station?: string }) => {\n    onDraftChange({\n      mode: next.mode || undefined,\n      station: next.mode === \"in_person\" ? next.station : undefined,\n    });\n  };\n\n  const priceValue = useMemo(\n    () => [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX] as [number, number],\n    [draft.min_price, draft.max_price],\n  );\n\n  const categoryOptions: OptionRow[] = [\n    ...CATEGORY_VALUES.map((value) => ({ value, label: value })),\n    { value: \"Primary\", label: t(\"search_panel.category_primary_school\") },\n    { value: \"Junior Secondary\", label: t(\"search_panel.category_junior_secondary\") },\n    { value: \"Admissions\", label: t(\"search_panel.category_admissions\") },\n  ];\n\n  const statusOptions = [\n    { value: \"\", label: t(\"search_panel.any_status\") },\n    { value: \"uni_student\", label: t(\"search_panel.status_uni_student\") },\n    { value: \"full_part_time_tutor\", label: t(\"search_panel.status_full_part_time\") },\n    { value: \"examiner\", label: t(\"search_panel.status_examiner\") },\n  ];\n\n  const sortOptions = [\n    { value: \"\", label: t(\"search_panel.sort_recommended\") },\n    { value: \"price_asc\", label: t(\"search_panel.sort_price_asc\") },\n    { value: \"price_desc\", label: t(\"search_panel.sort_price_desc\") },\n  ];\n\n  const genderOptions = [\n    { value: \"\", label: t(\"search_ui.gender_any\") },\n    { value: \"female\", label: t(\"search_panel.gender_female\") },\n    { value: \"male\", label: t(\"search_panel.gender_male\") },\n  ];\n\n  const applyLabel =\n    resultCount === undefined\n      ? t(\"search_ui.search_tutors\")\n      : t(\"search_ui.show_tutors\", { count: resultCount });\n\n  const overlayTabs: MobileSearchTab[] = [\n    {\n      id: \"tutors\",\n      label: t(\"search_ui.tab_tutors\"),\n      icon: <GraduationCap className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: true,\n      onSelect: () => {},\n    },\n    ...(CENTRE_MARKET_ENABLED\n      ? [\n          {\n            id: \"courses\",\n            label: t(\"search_ui.tab_courses\"),\n            icon: <BookOpen className=\"h-5 w-5\" aria-hidden=\"true\" />,\n            active: false,\n            onSelect: () => {\n              setSearchSlideDirection(\"next\");\n              void navigate({\n                to: \"/courses\",\n                search: { q: draft.q, subject: draft.subject, mode: draft.mode, open: true },\n              });\n            },\n          },\n        ]\n      : []),\n    {\n      id: \"cases\",\n      label: t(\"search_ui.tab_cases\"),\n      icon: <ClipboardList className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: false,\n      onSelect: () => {\n        setSearchSlideDirection(\"next\");\n        void navigate({ to: \"/tutor-requests\", search: { q: draft.q, open: true } });\n      },\n    },\n  ];\n\n  return (\n    <div className={className}>\n      <MobileSearchTrigger\n        label={t(\"search_ui.start_search\")}\n        onClick={() => setOverlayOpen(true)}\n      />\n\n      <MobileSearchOverlay\n        open={overlayOpen}\n        onOpenChange={setOverlayOpen}\n        tabs={overlayTabs}\n        clearLabel={t(\"search_ui.clear_all\")}\n        submitLabel={applyLabel}\n        onClear={onClear}\n        onSubmit={() => {\n          onApply();\n          setOverlayOpen(false);\n        }}\n      >\n        <div className=\"space-y-6\">\n          <div>\n            <p className=\"mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]\">\n              {t(\"search_ui.panel_keyword_title\")}\n            </p>\n            <SearchBigInput\n              value={draft.q ?? \"\"}\n              onValueChange={(q) => onDraftChange({ q: q || undefined })}\n              onEnter={() => onApply()}\n              placeholder={t(\"search_panel.keyword_placeholder\")}\n              ariaLabel={t(\"search_panel.keyword_aria\")}\n            />\n          </div>\n\n          <div className=\"space-y-1.5\">\n            <PanelLabel>{t(\"search_ui.segment_curriculum\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.category ?? \"\"}\n              onChange={handleCategorySelect}\n              options={[{ value: \"\", label: t(\"search_panel.any_category\") }, ...categoryOptions]}\n              placeholder={t(\"search_panel.any_category\")}\n              searchPlaceholder={t(\"search_panel.search_category\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n\n          <div className=\"space-y-1\">\n            <PanelLabel>{t(\"search_ui.suggested_subjects\")}</PanelLabel>\n            <div className=\"-mx-2\">\n              {suggestedSubjects.slice(0, 5).map((subject) => (\n                <SuggestedRow\n                  key={subject}\n                  title={subject}\n                  hint={t(\"search_ui.suggested_hint\")}\n                  onClick={() => {\n                    onApply({ q: subject });\n                    setOverlayOpen(false);\n                  }}\n                />\n              ))}\n            </div>\n          </div>\n\n          <div className=\"space-y-2\">\n            <PanelLabel>{t(\"search_ui.segment_mode\")}</PanelLabel>\n            <ModePanelContent\n              mode={draft.mode ?? \"\"}\n              station={draft.station}\n              onChange={handleModeChange}\n            />\n          </div>\n\n          <div className=\"space-y-2\">\n            <PanelLabel>{t(\"search_ui.gender_title\")}</PanelLabel>\n            <Segmented\n              aria-label={t(\"search_panel.any_gender\")}\n              value={draft.gender ?? \"\"}\n              onChange={(gender) => onDraftChange({ gender: gender || undefined })}\n              options={genderOptions}\n            />\n          </div>\n\n          <div className=\"space-y-2\">\n            <PanelLabel>{t(\"search_ui.status_title\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.status ?? \"\"}\n              onChange={(value) => onDraftChange({ status: value || undefined })}\n              options={statusOptions}\n              placeholder={t(\"search_panel.any_status\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n\n          <div className=\"space-y-2.5\">\n            <PanelLabel className=\"tabular-nums\">\n              {t(\"search_panel.price_from\")} {formatPrice(priceValue[0])}{\" \"}\n              {t(\"search_panel.price_to\")} {formatPrice(priceValue[1])}\n            </PanelLabel>\n            <PriceFields priceValue={priceValue} onDraftChange={onDraftChange} />\n          </div>\n\n          <div className=\"space-y-2\">\n            <PanelLabel>{t(\"search_ui.sort_title\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.sort ?? \"\"}\n              onChange={(value) => onDraftChange({ sort: value || undefined })}\n              options={sortOptions}\n              placeholder={t(\"search_panel.sort_recommended\")}\n              searchPlaceholder={t(\"search_panel.search_sorting\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n        </div>\n      </MobileSearchOverlay>\n    </div>\n  );\n}\n\n/** Homepage composition: desktop pill row + mobile entry in one wrapper. */\nexport function TutorsSearch(props: TutorsSearchProps) {\n  const { className, ...rest } = props;\n  return (\n    <div className={className}>\n      <TutorsSearchBar {...rest} />\n      <TutorsSearchMobile {...rest} />\n    </div>\n  );\n}\n\n/** Airbnb-style price range: histogram (optional) + slider + min/max pills. */\nfunction PriceFields({\n  priceValue,\n  onDraftChange,\n  histogram,\n}: {\n  priceValue: [number, number];\n  onDraftChange: (patch: Partial<TutorsSearchState>) => void;\n  histogram?: Array<{ level: number; inRange: boolean }> | null;\n}) {\n  const { t } = useTranslation();\n  const span = PRICE_MAX - PRICE_MIN;\n  return (\n    <div className=\"space-y-3\">\n      {histogram ? (\n        <div className=\"flex h-10 items-end gap-px\" aria-hidden=\"true\">\n          {histogram.map((bucket, index) => (\n            <span\n              key={index}\n              className={cn(\n                \"w-full min-w-px\",\n                bucket.inRange\n                  ? \"bg-[color:var(--brand-royal)]\"\n                  : \"bg-[color:var(--foreground)]/[0.18]\",\n              )}\n              style={{ height: `${Math.max(10, Math.round(bucket.level * 100))}%` }}\n            />\n          ))}\n        </div>\n      ) : null}\n      <Slider\n        value={priceValue}\n        onValueChange={([lo, hi]) =>\n          onDraftChange({\n            min_price: lo > PRICE_MIN ? lo : undefined,\n            max_price: hi < PRICE_MAX ? hi : undefined,\n          })\n        }\n        min={PRICE_MIN}\n        max={PRICE_MAX}\n        step={PRICE_STEP}\n        minStepsBetweenThumbs={1}\n        showTooltip\n        tooltipContent={formatPrice}\n        aria-label={t(\"search_panel.price_range\")}\n      />\n      <div className=\"flex items-end justify-between gap-3\">\n        <div className=\"w-28 space-y-1.5\">\n          <span className=\"text-xs font-semibold text-[color:var(--ink)]/70\">\n            {t(\"search_ui.price_min\")}\n          </span>\n          <Input\n            type=\"number\"\n            inputMode=\"numeric\"\n            min={PRICE_MIN}\n            max={priceValue[1] - PRICE_STEP}\n            step={PRICE_STEP}\n            value={priceValue[0]}\n            onChange={(event) => {\n              const raw = Number(event.target.value);\n              if (!Number.isFinite(raw)) return;\n              const clamped = Math.min(Math.max(raw, PRICE_MIN), priceValue[1] - PRICE_STEP);\n              onDraftChange({ min_price: clamped > PRICE_MIN ? clamped : undefined });\n            }}\n            aria-label={t(\"search_ui.price_min\")}\n            className=\"h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-semibold tabular-nums\"\n          />\n        </div>\n        <div className=\"w-28 space-y-1.5\">\n          <span className=\"text-xs font-semibold text-[color:var(--ink)]/70\">\n            {t(\"search_ui.price_max\")}\n          </span>\n          <Input\n            type=\"number\"\n            inputMode=\"numeric\"\n            min={priceValue[0] + PRICE_STEP}\n            max={PRICE_MAX}\n            step={PRICE_STEP}\n            value={priceValue[1]}\n            onChange={(event) => {\n              const raw = Number(event.target.value);\n              if (!Number.isFinite(raw)) return;\n              const clamped = Math.min(Math.max(raw, priceValue[0] + PRICE_STEP), PRICE_MAX);\n              onDraftChange({ max_price: clamped < PRICE_MAX ? clamped : undefined });\n            }}\n            aria-label={t(\"search_ui.price_max\")}\n            className=\"h-11 rounded-full border-[color:var(--ink)]/15 bg-card text-center font-semibold tabular-nums\"\n          />\n        </div>\n      </div>\n    </div>\n  );\n}\n\nfunction ModePanelContent({\n  mode,\n  station,\n  onChange,\n}: {\n  mode: string;\n  station?: string;\n  onChange: (next: { mode: string; station?: string }) => void;\n}) {\n  const { t } = useTranslation();\n  return (\n    <div className=\"space-y-3\">\n      <Segmented\n        aria-label={t(\"search_panel.any_mode\")}\n        value={mode}\n        onChange={(nextMode) =>\n          onChange({\n            mode: nextMode,\n            station: nextMode === \"in_person\" ? station : undefined,\n          })\n        }\n        options={[\n          { value: \"\", label: t(\"search_ui.mode_any\") },\n          { value: \"online\", label: t(\"search_ui.mode_online\") },\n          { value: \"in_person\", label: t(\"search_ui.mode_in_person\") },\n        ]}\n      />\n      {mode === \"in_person\" ? (\n        <div className=\"max-h-72 overflow-hidden rounded-2xl border border-border\">\n          <MtrStationPickerContent\n            value={station}\n            showAnyOption={false}\n            onSelect={(nextStation) => onChange({ mode: \"in_person\", station: nextStation })}\n            listClassName=\"max-h-56\"\n          />\n        </div>\n      ) : null}\n    </div>\n  );\n}\n",
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/tutors-search.tsx"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 58.2s)

_Thinking:_

Now step 5 — courses-search.tsx. Same split. The mobile overlay for courses has subjectRows etc. And a summary hook.

Courses segments: keyword, level, subject, mode. Summary: q, level, subject, mode label.

Step 5 — split `courses-search.tsx`:

**Tool: write**

**Input:**
```json
{
  "content": "import { BookOpen, ClipboardList, GraduationCap } from \"lucide-react\";\nimport { useNavigate } from \"@tanstack/react-router\";\nimport { useState } from \"react\";\nimport { useTranslation } from \"react-i18next\";\n\nimport {\n  PanelLabel,\n  SearchBigInput,\n  Segmented,\n  SuggestedRow,\n  type OptionRow,\n} from \"./search-controls\";\nimport {\n  FilterQuickPicks,\n  FiltersDialog,\n  FiltersPillButton,\n  FiltersSection,\n} from \"./filters-dialog\";\nimport { KeywordPanelContent, SearchPillBar, type PillSegment } from \"./search-pill-bar\";\nimport { MobileSearchOverlay, type MobileSearchTab } from \"./mobile-search-overlay\";\nimport { setSearchSlideDirection } from \"./slide-direction\";\nimport { MobileSearchTrigger } from \"./mobile-search-trigger\";\nimport { SearchableSelect } from \"@/components/ui/searchable-select\";\nimport { COURSE_LEVEL_OPTIONS, COURSE_MODE_OPTIONS } from \"@/features/courses/queries\";\nimport { HK_DISTRICTS } from \"@/features/tutors/queries\";\n\nexport type CoursesSearchState = {\n  subject?: string;\n  level?: string;\n  mode?: string;\n  district?: string;\n  q?: string;\n};\n\ntype CoursesSearchProps = {\n  draft: CoursesSearchState;\n  onDraftChange: (patch: Partial<CoursesSearchState>) => void;\n  /** Apply the current draft (navigate). `override` merges values set in the same event. */\n  onApply: (override?: Partial<CoursesSearchState>) => void;\n  onClear: () => void;\n  subjectOptions: string[];\n  /** Open the mobile overlay on mount (used when hopping between search tabs). */\n  defaultOverlayOpen?: boolean;\n  className?: string;\n};\n\nconst coursesModeLabel = (value: string, t: (key: string) => string) => {\n  if (value === \"\") return t(\"search_ui.mode_any\");\n  if (value === \"online\") return t(\"search_ui.mode_online\");\n  if (value === \"in_person\") return t(\"search_ui.mode_in_person\");\n  return t(\"search_ui.mode_open\");\n};\n\n/** One-line summary for the compact nav pill while the full bar is retracted. */\nexport function useCoursesCompactSummary(draft: CoursesSearchState): string {\n  const { t } = useTranslation();\n  const parts = [\n    draft.q?.trim() ?? \"\",\n    draft.level ?? \"\",\n    draft.subject ?? \"\",\n    draft.mode ? coursesModeLabel(draft.mode, t) : \"\",\n  ].filter(Boolean);\n  return parts.length > 0 ? parts.join(\" · \") : t(\"search_ui.show_courses_plain\");\n}\n\n/**\n * Desktop Airbnb-style pill row (segment bar + filters) for the course\n * directory, hosted by StickySearchBar so it pins under the nav and retracts\n * on scroll.\n */\nexport function CoursesSearchBar({\n  draft,\n  onDraftChange,\n  onApply,\n  onClear,\n  subjectOptions,\n  className,\n}: CoursesSearchProps) {\n  const { t } = useTranslation();\n  const [filtersOpen, setFiltersOpen] = useState(false);\n  const [pillOpenId, setPillOpenId] = useState<string | null>(null);\n\n  const levelOptions: OptionRow[] = COURSE_LEVEL_OPTIONS.map((level) => ({\n    value: level,\n    label: level,\n  }));\n  const districtOptions: OptionRow[] = HK_DISTRICTS.map((district) => ({\n    value: district,\n    label: district,\n  }));\n  const subjectRows: OptionRow[] = subjectOptions.map((subject) => ({\n    value: subject,\n    label: subject,\n  }));\n\n  const modeSegmentOptions = COURSE_MODE_OPTIONS.map((option) => ({\n    value: option.value,\n    label: coursesModeLabel(option.value, t),\n  }));\n\n  const modeDisplay = (() => {\n    const option = COURSE_MODE_OPTIONS.find((candidate) => candidate.value === (draft.mode ?? \"\"));\n    if (!draft.mode || !option) return t(\"search_ui.any_value\");\n    return option.label;\n  })();\n\n  const quickPicks = COURSE_LEVEL_OPTIONS.map((level) => ({\n    id: level,\n    label: level,\n    icon: BookOpen,\n    active: draft.level === level,\n    onToggle: () => onDraftChange({ level: draft.level === level ? undefined : level }),\n  }));\n\n  const segments: PillSegment[] = [\n    {\n      id: \"keyword\",\n      label: t(\"search_ui.segment_keyword\"),\n      title: t(\"search_ui.panel_keyword_title\"),\n      display: draft.q?.trim() ? draft.q : \"Search course title, subject, keyword…\",\n      filled: Boolean(draft.q?.trim()),\n      grow: \"flex-[1.3]\",\n      content: (\n        <KeywordPanelContent\n          value={draft.q ?? \"\"}\n          onValueChange={(q) => onDraftChange({ q: q || undefined })}\n          placeholder=\"Search course title, subject, keyword…\"\n          ariaLabel=\"Search courses\"\n        />\n      ),\n    },\n    {\n      id: \"level\",\n      label: t(\"search_ui.segment_level\"),\n      display: draft.level ?? t(\"search_ui.any_value\"),\n      filled: Boolean(draft.level),\n      options: levelOptions,\n      currentValue: draft.level,\n      searchPlaceholder: t(\"search_panel.search_category\"),\n      emptyText: t(\"search_panel.no_matches\"),\n      onSelect: (value) => onDraftChange({ level: value || undefined }),\n    },\n    {\n      id: \"subject\",\n      label: t(\"search_ui.segment_subject\"),\n      display: draft.subject ?? t(\"search_ui.any_value\"),\n      filled: Boolean(draft.subject),\n      options: subjectRows,\n      currentValue: draft.subject,\n      searchPlaceholder: t(\"search_panel.search_subject\"),\n      emptyText: t(\"search_panel.no_matches\"),\n      onSelect: (value) => onDraftChange({ subject: value || undefined }),\n    },\n    {\n      id: \"mode\",\n      label: t(\"search_ui.segment_mode\"),\n      display: modeDisplay,\n      filled: Boolean(draft.mode),\n      panelClassName: \"w-[min(24rem,calc(100vw-2rem))]\",\n      content: (\n        <div className=\"space-y-3\">\n          <p className=\"text-sm font-bold text-[color:var(--ink)]\">{t(\"search_ui.segment_mode\")}</p>\n          <Segmented\n            aria-label={t(\"search_ui.segment_mode\")}\n            value={draft.mode ?? \"\"}\n            onChange={(mode) => onDraftChange({ mode: mode || undefined })}\n            options={modeSegmentOptions}\n          />\n        </div>\n      ),\n    },\n  ];\n\n  return (\n    <div className={className}>\n      <div className=\"hidden items-stretch gap-2 lg:flex\">\n        <SearchPillBar\n          segments={segments}\n          submitLabel={t(\"search_panel.search\")}\n          submitColor=\"blue\"\n          onSubmit={() => onApply()}\n          className=\"min-w-0 flex-1\"\n          openSegmentId={pillOpenId}\n          onOpenSegmentIdChange={setPillOpenId}\n        />\n        <FiltersPillButton\n          label={t(\"search_ui.filters\")}\n          count={draft.district ? 1 : undefined}\n          onClick={() => {\n            setPillOpenId(null);\n            setFiltersOpen(true);\n          }}\n        />\n      </div>\n\n      <FiltersDialog\n        open={filtersOpen}\n        onOpenChange={setFiltersOpen}\n        clearLabel={t(\"search_ui.clear_all\")}\n        applyLabel={t(\"search_ui.show_courses_plain\")}\n        onClear={onClear}\n        onApply={() => onApply()}\n      >\n        <FiltersSection id=\"recommended\" title={t(\"search_ui.quick_title\")}>\n          <FilterQuickPicks options={quickPicks} />\n        </FiltersSection>\n        <FiltersSection id=\"district\" title={t(\"search_ui.segment_district\")}>\n          <SearchableSelect\n            value={draft.district ?? \"\"}\n            onChange={(value) => onDraftChange({ district: value || undefined })}\n            options={[{ value: \"\", label: t(\"search_ui.any_district\") }, ...districtOptions]}\n            placeholder={t(\"search_ui.any_district\")}\n            searchPlaceholder={t(\"search_panel.search_subject\")}\n            className=\"h-11 rounded-xl\"\n          />\n        </FiltersSection>\n      </FiltersDialog>\n    </div>\n  );\n}\n\n/** Mobile search entry for the course directory, rendered inside the hero. */\nexport function CoursesSearchMobile({\n  draft,\n  onDraftChange,\n  onApply,\n  onClear,\n  subjectOptions,\n  defaultOverlayOpen,\n  className,\n}: CoursesSearchProps) {\n  const { t } = useTranslation();\n  const navigate = useNavigate();\n  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));\n\n  const levelOptions: OptionRow[] = COURSE_LEVEL_OPTIONS.map((level) => ({\n    value: level,\n    label: level,\n  }));\n  const districtOptions: OptionRow[] = HK_DISTRICTS.map((district) => ({\n    value: district,\n    label: district,\n  }));\n  const subjectRows: OptionRow[] = subjectOptions.map((subject) => ({\n    value: subject,\n    label: subject,\n  }));\n\n  const modeSegmentOptions = COURSE_MODE_OPTIONS.map((option) => ({\n    value: option.value,\n    label: coursesModeLabel(option.value, t),\n  }));\n\n  const overlayTabs: MobileSearchTab[] = [\n    {\n      id: \"tutors\",\n      label: t(\"search_ui.tab_tutors\"),\n      icon: <GraduationCap className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: false,\n      onSelect: () => {\n        setSearchSlideDirection(\"prev\");\n        void navigate({\n          to: \"/tutors\",\n          search: { q: draft.q, subject: draft.subject, mode: draft.mode, open: true },\n        });\n      },\n    },\n    {\n      id: \"courses\",\n      label: t(\"search_ui.tab_courses\"),\n      icon: <BookOpen className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: true,\n      onSelect: () => {},\n    },\n    {\n      id: \"cases\",\n      label: t(\"search_ui.tab_cases\"),\n      icon: <ClipboardList className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: false,\n      onSelect: () => {\n        setSearchSlideDirection(\"next\");\n        void navigate({ to: \"/tutor-requests\", search: { q: draft.q, open: true } });\n      },\n    },\n  ];\n\n  return (\n    <div className={className}>\n      <MobileSearchTrigger\n        label={t(\"search_ui.start_search\")}\n        onClick={() => setOverlayOpen(true)}\n      />\n\n      <MobileSearchOverlay\n        open={overlayOpen}\n        onOpenChange={setOverlayOpen}\n        tabs={overlayTabs}\n        clearLabel={t(\"search_ui.clear_all\")}\n        submitLabel={t(\"search_ui.show_courses_plain\")}\n        onClear={onClear}\n        onSubmit={() => {\n          onApply();\n          setOverlayOpen(false);\n        }}\n      >\n        <div className=\"space-y-6\">\n          <div>\n            <p className=\"mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]\">\n              {t(\"search_ui.panel_keyword_title\")}\n            </p>\n            <SearchBigInput\n              value={draft.q ?? \"\"}\n              onValueChange={(q) => onDraftChange({ q: q || undefined })}\n              onEnter={() => onApply()}\n              placeholder=\"Search course title, subject, keyword…\"\n              ariaLabel=\"Search courses\"\n            />\n          </div>\n\n          <div className=\"space-y-1.5\">\n            <PanelLabel>{t(\"search_ui.segment_level\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.level ?? \"\"}\n              onChange={(value) => onDraftChange({ level: value || undefined })}\n              options={levelOptions}\n              placeholder=\"Any level\"\n              searchPlaceholder={t(\"search_panel.search_category\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n\n          {subjectRows.length > 0 ? (\n            <div className=\"space-y-1\">\n              <PanelLabel>{t(\"search_ui.suggested_subjects\")}</PanelLabel>\n              <div className=\"-mx-2\">\n                {subjectRows.slice(0, 5).map((option) => (\n                  <SuggestedRow\n                    key={option.value}\n                    title={option.label}\n                    hint={t(\"search_ui.suggested_hint\")}\n                    onClick={() => {\n                      onApply({ subject: option.value });\n                      setOverlayOpen(false);\n                    }}\n                  />\n                ))}\n              </div>\n            </div>\n          ) : null}\n\n          <div className=\"space-y-2\">\n            <PanelLabel>{t(\"search_ui.segment_mode\")}</PanelLabel>\n            <Segmented\n              aria-label={t(\"search_ui.segment_mode\")}\n              value={draft.mode ?? \"\"}\n              onChange={(mode) => onDraftChange({ mode: mode || undefined })}\n              options={modeSegmentOptions}\n            />\n          </div>\n\n          <div className=\"space-y-1.5\">\n            <PanelLabel>{t(\"search_ui.segment_district\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.district ?? \"\"}\n              onChange={(value) => onDraftChange({ district: value || undefined })}\n              options={[{ value: \"\", label: t(\"search_ui.any_district\") }, ...districtOptions]}\n              placeholder={t(\"search_ui.any_district\")}\n              searchPlaceholder={t(\"search_panel.search_subject\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n        </div>\n      </MobileSearchOverlay>\n    </div>\n  );\n}\n\n/** Combined composition (kept for parity with the tutors search). */\nexport function CoursesSearch(props: CoursesSearchProps) {\n  const { className, ...rest } = props;\n  return (\n    <div className={className}>\n      <CoursesSearchBar {...rest} />\n      <CoursesSearchMobile {...rest} />\n    </div>\n  );\n}\n",
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/courses-search.tsx"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · GLM-5.3-Flash · 36.7s)

_Thinking:_

Wait — in the original courses-search, modeSegmentOptions used inline label logic with `option.value === "" ? mode_any : ...`. My `coursesModeLabel` handles ""/online/in_person/else → mode_open. COURSE_MODE_OPTIONS values — let me confirm what values exist (from queries): probably "", "online", "in_person", "open". Fine.

Note: original modeDisplay used `option.label` from COURSE_MODE_OPTIONS — I kept that logic as-is. Good.

Step 6 — cases-search.tsx split. Cases has no filters dialog — desktop row only SearchPillBar. Summary: q, category label, district.

Step 6 — split `cases-search.tsx`:

---

## User

Continue

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 105.6s)

_Thinking:_

Now step 6 — split cases-search.tsx. Cases-search currently has no FiltersDialog, no FiltersPillButton; just SearchPillBar + MobileSearchTrigger/Overlay. Very similar to tutors-mobile originally (but minus FiltersDialog).

The CasesSearch has segments: keyword, category, district. Summary needed: q, category, district label.

Compact summary hook for cases: `useCasesCompactSummary(draft)`.

CasesSearchBar: desktop row, but without FiltersDialog (no filters). CasesSearchMobile: trigger + overlay (same structure as tutors-mobile minus FiltersDialog). Combined: Course? Same combined TutorsSearch composition (keeps homepage combined unchanged — but that's TutorsSearch only; combined CasesSearch not used on homepage currently, but keep composition pattern consistent. The existing combined CasesSearch was not a thing; there's no combined in original for cases. Actually original CasesSearch had its own combined behavior inline; there's no separate CoursesSearchHome equivalent, but the new split exports Bar + Mobile separately. The homepage index.tsx uses TutorsSearch only — CasesSearch only used on /tutor-requests page. So combined optional.

For CasesSearchBar: just SearchPillBar row + trigger/overlay? Actually desktop row only has SearchPillBar and mobile overlay. No Filters dialog. In Courses, there's a Filters dialog because search has many options. Cases has less options; but still need Bar compact in directory pages.

Let me write CasesSearchBar and CasesSearchMobile: Bar includes SearchPillBar (segments: keyword, category, district). CasesSearchMobile includes MobileSearchTrigger + MobileSearchOverlay (same structure). Both same as before except no FiltersDialog.

Now compact summary hook for Cases:

```ts
export function useCasesCompactSummary(draft: CasesSearchState): string {
  const { t } = useTranslation();
  const parts = [
    draft.q?.trim() ?? "",
    draft.category ? categoryLabel(draft.category, t) : "",
    draft.district ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : t("search_ui.cases_placeholder"); // or custom key;
}
```

Add i18n keys needed.

Now write cases-search.tsx new content: one file reflecting split components + hook. CasesSearchBar props: draft, onDraftChange, onApply, onClear, className? (since no resultCount/allPrices). CasesSearchMobile similar.

Now write it.

Now step 6 — split `cases-search.tsx`:


**Tool: write**

**Input:**
```json
{
  "content": "import { ClipboardList, GraduationCap, BookOpen } from \"lucide-react\";\nimport { useNavigate } from \"@tanstack/react-router\";\nimport { useState } from \"react\";\nimport { useTranslation } from \"react-i18next\";\n\nimport { MobileSearchOverlay, type MobileSearchTab } from \"./mobile-search-overlay\";\nimport { setSearchSlideDirection } from \"./slide-direction\";\nimport { MobileSearchTrigger } from \"./mobile-search-trigger\";\nimport { SearchableSelect } from \"@/components/ui/searchable-select\";\nimport { CENTRE_MARKET_ENABLED } from \"@/lib/feature-flags\";\nimport { HK_DISTRICTS } from \"@/features/tutors/queries\";\n\nexport type CasesSearchState = {\n  q?: string;\n  category?: string;\n  district?: string;\n};\n\ntype CasesSearchProps = {\n  draft: CasesSearchState;\n  onDraftChange: (patch: Partial<CasesSearchState>) => void;\n  /** Apply the current draft (navigate). `override` merges values set in the same event. */\n  onApply: (override?: Partial<CasesSearchState>) => void;\n  onClear: () => void;\n  /** Open the mobile overlay on mount (used when hopping between search tabs). */\n  defaultOverlayOpen?: boolean;\n  className?: string;\n};\n\nconst caseCategoryLabel = (value: string, t: (key: string) => string) => {\n  if (value === \"Primary School\") return t(\"search_panel.category_primary_school\");\n  if (value === \"Junior Secondary\") return t(\"search_panel.category_junior_secondary\");\n  if (value === \"Admissions\") return t(\"search_panel.category_admissions\");\n  if (value === \"Other\") return t(\"search_ui.case_other\");\n  return value;\n};\n\n/** One-line summary for the compact nav pill while the full bar is retracted. */\nexport function useCasesCompactSummary(draft: CasesSearchState): string {\n  const { t } = useTranslation();\n  const parts = [\n    draft.q?.trim() ?? \"\",\n    draft.category ? caseCategoryLabel(draft.category, t) : \"\",\n    draft.district ?? \"\",\n  ].filter(Boolean);\n  return parts.length > 0 ? parts.join(\" · \") : t(\"search_ui.cases_placeholder\");\n}\n\n/**\n * Desktop Airbnb-style pill row (segment bar) for the case board,\n * hosted by StickySearchBar so it pins under the nav and retracts on scroll.\n */\nexport function CasesSearchBar({\n  draft,\n  onDraftChange,\n  onApply,\n  onClear,\n  className,\n}: Omit<CasesSearchProps, \"defaultOverlayOpen\">) {\n  const { t } = useTranslation();\n\n  const segments: PillSegment[] = [\n    {\n      id: \"keyword\",\n      label: t(\"search_ui.segment_keyword\"),\n      title: t(\"search_ui.panel_keyword_title\"),\n      display: draft.q?.trim() ? draft.q : t(\"search_ui.cases_placeholder\"),\n      filled: Boolean(draft.q?.trim()),\n      grow: \"flex-[1.3]\",\n      content: (\n        <KeywordPanelContent\n          value={draft.q ?? \"\"}\n          onValueChange={(q) => onDraftChange({ q: q || undefined })}\n          placeholder={t(\"search_ui.cases_placeholder\")}\n          ariaLabel={t(\"search_ui.cases_placeholder\")}\n        />\n      ),\n    },\n    {\n      id: \"category\",\n      label: t(\"search_ui.segment_curriculum\"),\n      display: draft.category ? caseCategoryLabel(draft.category, t) : t(\"search_ui.any_value\"),\n      filled: Boolean(draft.category),\n      options: CASE_CATEGORY_VALUES.map((value) => ({\n        value,\n        label: caseCategoryLabel(value, t),\n      })),\n      currentValue: draft.category,\n      searchPlaceholder: t(\"search_panel.search_category\"),\n      emptyText: t(\"search_panel.no_matches\"),\n      onSelect: (value) => onDraftChange({ category: value || undefined }),\n    },\n    {\n      id: \"district\",\n      label: t(\"search_ui.segment_district\"),\n      display: draft.district ?? t(\"search_ui.any_value\"),\n      filled: Boolean(draft.district),\n      options: HK_DISTRICTS.map((district) => ({\n        value: district,\n        label: district,\n      })),\n      currentValue: draft.district,\n      searchPlaceholder: t(\"search_panel.search_subject\"),\n      emptyText: t(\"search_panel.no_matches\"),\n      onSelect: (value) => onDraftChange({ district: value || undefined }),\n    },\n  ];\n\n  return (\n    <div className={className}>\n      <div className=\"hidden items-stretch gap-2 lg:flex\">\n        <SearchPillBar\n          segments={segments}\n          submitLabel={t(\"search_panel.search\")}\n          submitColor=\"blue\"\n          onSubmit={() => onApply()}\n          className=\"min-w-0 flex-1\"\n        />\n      </div>\n    </div>\n  );\n}\n\n/** Mobile search entry for the case board, rendered inside the hero. */\nexport function CasesSearchMobile({\n  draft,\n  onDraftChange,\n  onApply,\n  onClear,\n  defaultOverlayOpen,\n  className,\n}: CasesSearchProps) {\n  const { t } = useTranslation();\n  const navigate = useNavigate();\n  const [overlayOpen, setOverlayOpen] = useState(Boolean(defaultOverlayOpen));\n\n  const overlayTabs: MobileSearchTab[] = [\n    {\n      id: \"tutors\",\n      label: t(\"search_ui.tab_tutors\"),\n      icon: <GraduationCap className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: false,\n      onSelect: () => {\n        setSearchSlideDirection(\"prev\");\n        void navigate({\n          to: \"/tutors\",\n          search: { q: draft.q, mode: undefined, subject: undefined, open: true },\n        });\n      },\n    },\n    ...(CENTRE_MARKET_ENABLED\n      ? [\n          {\n            id: \"courses\",\n            label: t(\"search_ui.tab_courses\"),\n            icon: <BookOpen className=\"h-5 w-5\" aria-hidden=\"true\" />,\n            active: false,\n            onSelect: () => {\n              setSearchSlideDirection(\"prev\");\n              void navigate({\n                to: \"/courses\",\n                search: { q: draft.q, subject: undefined, mode: undefined, open: true },\n              });\n            },\n          },\n        ]\n      : []),\n    {\n      id: \"cases\",\n      label: t(\"search_ui.tab_cases\"),\n      icon: <ClipboardList className=\"h-5 w-5\" aria-hidden=\"true\" />,\n      active: true,\n      onSelect: () => {},\n    },\n  ];\n\n  return (\n    <div className={className}>\n      <MobileSearchTrigger\n        label={t(\"search_ui.start_search\")}\n        onClick={() => setOverlayOpen(true)}\n      />\n\n      <MobileSearchOverlay\n        open={overlayOpen}\n        onOpenChange={setOverlayOpen}\n        tabs={overlayTabs}\n        clearLabel={t(\"search_ui.clear_all\")}\n        submitLabel={t(\"search_panel.search\")}\n        onClear={onClear}\n        onSubmit={() => {\n          onApply();\n          setOverlayOpen(false);\n        }}\n      >\n        <div className=\"space-y-6\">\n          <div>\n            <p className=\"mb-2 text-xl font-bold tracking-tight text-[color:var(--ink)]\">\n              {t(\"search_ui.panel_keyword_title\")}\n            </p>\n            <SearchBigInput\n              value={draft.q ?? \"\"}\n              onValueChange={(q) => onDraftChange({ q: q || undefined })}\n              onEnter={() => onApply()}\n              placeholder={t(\"search_ui.cases_placeholder\")}\n              ariaLabel={t(\"search_ui.cases_placeholder\")}\n            />\n          </div>\n\n          <div className=\"space-y-1.5\">\n            <PanelLabel>{t(\"search_ui.segment_curriculum\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.category ?? \"\"}\n              onChange={(value) => onDraftChange({ category: value || undefined })}\n              options={[{ value: \"\", label: t(\"search_panel.any_category\") }, ...CASE_CATEGORY_VALUES.map((value) => ({ value, label: caseCategoryLabel(value, t) }))]}\n              placeholder={t(\"search_panel.any_category\")}\n              searchPlaceholder={t(\"search_panel.search_category\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n\n          {subjectOptions.length > 0 ? (\n            <div className=\"space-y-1\">\n              <PanelLabel>{t(\"search_ui.suggested_subjects\")}</PanelLabel>\n              <div className=\"-mx-2\">\n                {CASE_CATEGORY_VALUES.slice(0, 5).map((subject) => (\n                  <SuggestedRow\n                    key={subject}\n                    title={subject}\n                    hint={t(\"search_ui.suggested_hint\")}\n                    onClick={() => {\n                      onApply({ q: subject });\n                      setOverlayOpen(false);\n                    }}\n                  />\n                ))}\n              </div>\n            </div>\n          ) : null}\n\n          <div className=\"space-y-1.5\">\n            <PanelLabel>{t(\"search_ui.segment_district\")}</PanelLabel>\n            <SearchableSelect\n              value={draft.district ?? \"\"}\n              onChange={(value) => onDraftChange({ district: value || undefined })}\n              options={[{ value: \"\", label: t(\"search_ui.any_district\") }, ...HK_DISTRICTS.map((district) => ({ value: district, label: district }))]}\n              placeholder={t(\"search_ui.any_district\")}\n              searchPlaceholder={t(\"search_panel.search_subject\")}\n              className=\"h-12 rounded-2xl\"\n            />\n          </div>\n        </div>\n      </MobileSearchOverlay>\n    </div>\n  );\n}\n\n/** Combined composition (kept for parity with the tutors search). */\nexport function CasesSearch(props: CasesSearchProps) {\n  const { className, ...rest } = props;\n  return (\n    <div className={className}>\n      <CasesSearchBar {...rest} />\n      <CasesSearchMobile {...rest} />\n    </div>\n  );\n}\n\n/* Preserved original lists from cases-search.tsx. */\nconst CASE_CATEGORY_VALUES = [\n  \"IB\",\n  \"DSE\",\n  \"IGCSE\",\n  \"AP\",\n  \"A-Level\",\n  \"Primary School\",\n  \"Junior Secondary\",\n  \"Admissions\",\n  \"Other\",\n];",
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/components/search/cases-search.tsx"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 211.2s)

_Thinking:_

Step 7 — Restructure routes: tutors.index.tsx, courses.index.tsx, tutor-requests.index.tsx. Also add i18n keys. Then verify via build.

But before that, also need to adjust the homepage `index.tsx` to keep combined TutorsSearch unchanged (already is). Need to adjust all three directory pages.

Also need to add translations for compact pill expand key, summary fallback in each locale. Let me add i18n keys to en.json and zh-HK.json, then edit the routes.

First let me add the i18n keys needed:
- search_ui.compact_expand: probably label "Expand search" for compact pill
- search_ui.cases_placeholder (or similar) for cases fallback
- maybe existing keys already cover

But many fallback strings exist already: t("search_ui.search_tutors") (line 574); t("search_ui.show_courses_plain") (575); maybe need "cases_placeholder" key (line 588). It already: `"cases_placeholder": "Search subject, district, keyword…"` — good.

Compact pill aria label: `t("search_ui.expand_search")` not defined yet; add. Also maybe keep aria-label default.

But wait: currently I used `aria-label={t("search_ui.expand_search")}` in CompactSearchPill; that key does not exist in en.json. Need to add. Also in zh-HK.json maybe. Add keys:

In en.json after last search_ui key line 597: add:
```
"expand_search": "Expand search",
```

In zh-HK.json: add after search_ui section maybe; but zh.json might not have search_ui section fully; I should check and add if missing. Actually better to make CompactSearchPill not rely on a custom key; fallback to "Expand search" via fallback default mechanism? The t() function returns the key string if not found. So if we add "expand_search", it'll show. If not, it'll show the key itself. To avoid that, let me add key. Also use generic "Expand search" that's clear.

But maybe just remove the aria-label on CompactSearchPill — the button text already describes action. The aria-label can be omitted. The button has a child summary + search icon; click behavior handled. Remove the aria-label prop from CompactSearchPill to avoid missing key issue. In the file I wrote earlier: `<button type="button" onClick={expand} aria-label={t("search_ui.expand_search")}>` — I can remove the aria-label entirely. The button already has descriptive text. Also simplified: remove the import of useTranslation inside CompactSearchPill if not used? Actually CompactSearchPill already uses `const { t } = useTranslation();`. So need key.

Let me remove the aria-label line from CompactSearchPill. I'll edit that file again. I'll edit the file to remove the aria-label prop and maybe keep minimal aria-label or delete it.

Actually — the button type submit with onClick; usually buttons have implicit action. Removing aria-label may still be OK. Also the CompactPillSlot and SiteHeader centerSlot use CompactSearchPill; SiteHeader already provides context for expand via useSearchGroup, but CompactSearchPill currently calls `useSearchGroup().expand`. Wait — CompactSearchPill uses `const { expand } = useSearchGroup();` from context. That requires the context to be available. But CompactSearchPill is rendered inside SiteHeader (merged mode). The searchGroup context is provided by SearchGroupProvider wrapping the whole page. Since SiteHeader is a descendant of the provider (routes wrap provider around SiteHeader), it's available. But that means each page must wrap its content in the provider, which they do. CompactSearchPill expand calls the context expand → phase → compactExpanded. Good.

But CompactSearchPill also needs t() for compact pill text summary — it receives summary from route.

Now the aria-label is removed → simplify. I'll edit CompactSearchPill file to remove aria-label line. Let me do that after Step 7 perhaps.

Now edit the routes. I need to:

1. Wrap each page (tutors, courses, tutor-requests) in `<SearchGroupProvider>`.
2. `<SiteHeader merged centerSlot={<CompactSearchPill summary={compactSummary}/>}/>`.
3. `<section>` hero: bg-[color:var(--surface-header)]; remove `border-b` at `lg` (`lg:border-b-0`). Keep hero `border-b` on mobile always — so `lg:border-b-0` strips on lg only.
4. Remove existing `hidden lg:flex` row inside hero; instead place `TutorsSearchBar` inside `<StickySearchBar>` (directory page), or

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 53.5s)

_Thinking:_

Let me continue implementing the route changes. I need to:
1. Add SearchGroupProvider wrapping for all three directory pages
2. Add SiteHeader with merged and centerSlot props
3. Update hero sections to use new grey bg and remove lg border-b
4. Insert StickySearchBar + wrapped search components

Let me start with tutors.index.tsx.

Now step 7 — restructure routes. Let me edit `tutors.index.tsx`:



**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutors.index.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutors.index.tsx</path>
<type>file</type>
<content>
1: import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
2: import { useEffect, useMemo, useState } from "react";
3: import { useQuery } from "@tanstack/react-query";
4: import { useTranslation } from "react-i18next";
5: import { z } from "zod";
6: import { SearchX } from "lucide-react";
7: import { SiteHeader } from "@/components/layout/SiteHeader";
8: import { SiteFooter } from "@/components/layout/SiteFooter";
9: import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
10: import { Button } from "@/components/ui/button";
11: import { Skeleton } from "@/components/ui/skeleton";
12: import { TutorsSearch } from "@/components/search/tutors-search";
13: import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
14: import { TutorSaveButton } from "@/features/tutors/saved-tutors";
15: import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
16: import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
17: import {
18:   fetchPublishedTutors,
19:   getTutorCardHighlights,
20:   matchesLessonModeFilter,
21:   matchesStationFilter,
22:   type Tutor,
23: } from "@/features/tutors/queries";
24: import { matchesCategoryFilter, matchesSubjectQuery } from "@/features/tutors/subjects";
25: import { supabase } from "@/integrations/supabase/client";
26: 
27: const searchSchema = z.object({
28:   category: z.string().optional(),
29:   subject: z.string().optional(),
30:   station: z.string().optional(), // nearest MTR station to the student
31:   mode: z.string().optional(), // online | in_person | either
32:   gender: z.string().optional(), // male | female | other
33:   status: z.string().optional(), // uni_student | full_part_time_tutor | examiner
34:   min_price: z.coerce.number().int().min(0).optional(),
35:   max_price: z.coerce.number().int().min(0).optional(),
36:   sort: z.string().optional(), // "" | price_asc | price_desc
37:   q: z.string().optional(),
38:   open: z.preprocess(
39:     (value) => (value === "1" || value === "true" || value === true ? true : undefined),
40:     z.boolean().optional(),
41:   ), // transient: opens the mobile search overlay when hopping tabs
42: });
43: type SearchState = z.infer<typeof searchSchema>;
44: 
45: export const Route = createFileRoute("/tutors/")({
46:   validateSearch: (s) => searchSchema.parse(s),
47:   head: () => ({
48:     meta: [
49:       { title: "Find Verified Tutors in Hong Kong | MatchMax" },
50:       {
51:         name: "description",
52:         content:
53:           "Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
54:       },
55:       { name: "robots", content: "index, follow" },
56:       { property: "og:title", content: "Find Verified Tutors in Hong Kong | MatchMax" },
57:       {
58:         property: "og:description",
59:         content:
60:           "Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
61:       },
62:       { property: "og:url", content: "https://matchmax.hk/tutors" },
63:     ],
64:     links: [{ rel: "canonical", href: "https://matchmax.hk/tutors" }],
65:   }),
66:   component: TutorsDirectory,
67: });
68: 
69: function TutorsDirectory() {
70:   const { t } = useTranslation();
71:   const search = Route.useSearch();
72:   const navigate = useNavigate({ from: "/tutors/" });
73:   const [draft, setDraft] = useState<SearchState>(search);
74: 
75:   useEffect(() => {
76:     setDraft(search);
77:   }, [search]);
78: 
79:   const setDraftParam = (patch: Partial<SearchState>) => {
80:     setDraft((prev) => {
81:       const next: SearchState = { ...prev, ...patch };
82:       (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
83:         const v = next[k];
84:         if (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v)))
85:           delete next[k];
86:       });
87:       return next;
88:     });
89:   };
90: 
91:   const { data: tutors = [], isLoading } = useQuery({
92:     queryKey: ["tutors", "published"],
93:     queryFn: fetchPublishedTutors,
94:   });
95: 
96:   const { data: whatsappNumber = "" } = useQuery({
97:     queryKey: ["settings", "whatsapp_number"],
98:     queryFn: async () => {
99:       const { data, error } = await supabase
100:         .from("app_settings")
101:         .select("value")
102:         .eq("key", "whatsapp_number")
103:         .maybeSingle();
104:       if (error) throw error;
105:       const value = data?.value;
106:       return typeof value === "string" ? value : "";
107:     },
108:   });
109: 
110:   const categoryFilter = (draft.category ?? "").toLowerCase();
111: 
112:   const subjectFilter = (draft.subject ?? "").toLowerCase();
113:   const stationFilter = draft.station ?? "";
114:   const modeFilter = draft.mode ?? "";
115:   const genderFilter = draft.gender ?? "";
116:   const statusFilter = draft.status ?? "";
117:   const effectiveStationFilter = modeFilter === "in_person" ? stationFilter : "";
118: 
119:   const filtered = useMemo(() => {
120:     const query = (draft.q ?? "").trim().toLowerCase();
121:     const sort = draft.sort ?? "";
122: 
123:     const list = tutors.filter((tut) => {
124:       if (
125:         categoryFilter &&
126:         !matchesCategoryFilter(categoryFilter, tut.subjects, [
127:           ...tut.target_students,
128:           ...getTutorCardHighlights(tut),
129:         ])
130:       )
131:         return false;
132:       if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
133:         return false;
134:       if (draft.min_price !== undefined && tut.hourly_rate < draft.min_price) return false;
135:       if (draft.max_price !== undefined && tut.hourly_rate > draft.max_price) return false;
136:       if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
137:       if (!matchesStationFilter(effectiveStationFilter, tut.stations)) return false;
138:       if (genderFilter) {
139:         const g = (tut as unknown as { gender?: string | null }).gender ?? "";
140:         if (g !== genderFilter) return false;
141:       }
142:       if (statusFilter && (tut.tutor_status ?? "") !== statusFilter) return false;
143:       if (
144:         query &&
145:         !(
146:           tut.tutor_code.toLowerCase().includes(query) ||
147:           tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||
148:           getTutorCardHighlights(tut).some((highlight) => highlight.toLowerCase().includes(query))
149:         )
150:       )
151:         return false;
152:       return true;
153:     });
154: 
155:     return [...list].sort((a, b) => {
156:       if (sort === "price_asc")
157:         return a.hourly_rate - b.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
158:       if (sort === "price_desc")
159:         return b.hourly_rate - a.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
160:       return (
161:         (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
162:         a.hourly_rate - b.hourly_rate ||
163:         a.tutor_code.localeCompare(b.tutor_code)
164:       );
165:     });
166:   }, [
167:     tutors,
168:     categoryFilter,
169:     subjectFilter,
170:     effectiveStationFilter,
171:     modeFilter,
172:     genderFilter,
173:     statusFilter,
174:     draft.q,
175:     draft.min_price,
176:     draft.max_price,
177:     draft.sort,
178:   ]);
179: 
180:   const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
181:     useTutorCompare(tutors);
182: 
183:   const clearAll = () => {
184:     setDraft({});
185:     navigate({ search: {} as SearchState });
186:   };
187: 
188:   const openTutorDetail = (tutorCode: string) => {
189:     navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
190:   };
191: 
192:   const hotlineUrl = buildTutorWhatsAppUrl(whatsappNumber, "");
193: 
194:   const applySearch = (override?: Partial<SearchState>) => {
195:     const next = { ...draft, ...override };
196:     navigate({
197:       search: {
198:         ...next,
199:         station: next.mode === "in_person" ? next.station : undefined,
200:       },
201:     });
202:   };
203: 
204:   return (
205:     <div className="flex min-h-screen flex-col bg-background">
206:       <SiteHeader />
207:       <main className="flex-1">
208:         <section className="border-b border-border py-10 sm:py-12">
209:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
210:             <h1 className="text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
211:               Find verified tutors
212:             </h1>
213:             <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
214:               Start with a subject or tutor code, then narrow the list to the right fit.
215:             </p>
216:             <TutorsSearch
217:               className="mt-7"
218:               draft={draft}
219:               onDraftChange={setDraftParam}
220:               onApply={applySearch}
221:               onClear={clearAll}
222:               resultCount={filtered.length}
223:               allPrices={tutors.map((tutor) => tutor.hourly_rate)}
224:               defaultOverlayOpen={search.open === true}
225:               whatsappUrl={hotlineUrl || undefined}
226:             />
227:           </div>
228:         </section>
229:         <section className="py-12">
230:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
231:             <div className="mb-6 flex items-baseline justify-between">
232:               {isLoading ? (
233:                 <Skeleton className="h-4 w-28" />
234:               ) : (
235:                 <p className="text-sm text-muted-foreground">
236:                   <span className="font-bold text-foreground">{filtered.length}</span>{" "}
237:                   {filtered.length === 1 ? "tutor" : "tutors"} found
238:                 </p>
239:               )}
240:             </div>
241: 
242:             {isLoading && (
243:               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
244:                 {Array.from({ length: 6 }).map((_, i) => (
245:                   <Skeleton key={i} className="h-[23rem] rounded-[10px] border border-border" />
246:                 ))}
247:               </div>
248:             )}
249: 
250:             {!isLoading && filtered.length === 0 && (
251:               <div className="rounded-sm border border-border bg-card p-8 text-center sm:p-12">
252:                 <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]">
253:                   <SearchX
254:                     className="h-5 w-5 text-[color:var(--muted-foreground)]"
255:                     aria-hidden="true"
256:                   />
257:                 </div>
258:                 <h2 className="mt-4 text-xl font-bold tracking-tight text-[color:var(--ink)] sm:text-2xl">
259:                   {t("directory.empty_title")}
260:                 </h2>
261:                 <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
262:                   {t("directory.empty_desc")}
263:                 </p>
264:                 <div className="mt-6 flex flex-wrap justify-center gap-3">
265:                   <Button variant="outline" onClick={clearAll}>
266:                     {t("directory.empty_clear")}
267:                   </Button>
268:                   {hotlineUrl ? (
269:                     <Button asChild variant="ghost">
270:                       <a href={hotlineUrl} target="_blank" rel="noreferrer">
271:                         <WhatsAppIcon
272:                           className="mr-2 h-4 w-4 text-[color:var(--muted-foreground)]"
273:                           aria-hidden="true"
274:                         />
275:                         {t("directory.empty_whatsapp")}
276:                       </a>
277:                     </Button>
278:                   ) : null}
279:                   <Button asChild variant="solid" color="blue" className="font-bold">
280:                     <Link to="/tutor-requests" search={{ post: true }}>
281:                       {t("directory.empty_case")}
282:                     </Link>
283:                   </Button>
284:                 </div>
285:               </div>
286:             )}
287: 
288:             {!isLoading && filtered.length > 0 && (
289:               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
290:                 {filtered.map((tut: Tutor) => (
291:                   <PublicTutorCard
292:                     key={tut.id}
293:                     tutor={tut}
294:                     priceSuffix={t("featured.per_hour")}
295:                     onOpen={openTutorDetail}
296:                     onCompareToggle={() => toggleCompare(tut)}
297:                     compareSelected={compareIds.includes(tut.id)}
298:                     footerAction={
299:                       <>
300:                         <TutorSaveButton tutorId={tut.id} compact />
301:                         <Button
302:                           asChild
303:                           className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
304:                         >
305:                           <a
306:                             href={buildTutorWhatsAppUrl(whatsappNumber, tut.tutor_code)}
307:                             target="_blank"
308:                             rel="noreferrer"
309:                             onClick={(event) => event.stopPropagation()}
310:                           >
311:                             Request tutor
312:                           </a>
313:                         </Button>
314:                       </>
315:                     }
316:                   />
317:                 ))}
318:               </div>
319:             )}
320:           </div>
321:         </section>
322:       </main>
323:       <SiteFooter />
324:       {compareTutors.length > 0 && !compareOpen ? (
325:         <CompareBar
326:           selectedTutors={compareTutors}
327:           onOpenCompare={() => setCompareOpen(true)}
328:           onClear={clearCompare}
329:         />
330:       ) : null}
331:       <CompareDialog
332:         open={compareOpen}
333:         onOpenChange={setCompareOpen}
334:         tutors={compareTutors}
335:         whatsappNumber={whatsappNumber}
336:       />
337:     </div>
338:   );
339: }

(End of file - total 339 lines)
</content>
```

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 123.5s)

_Thinking:_

Now I need to restructure this file. Let me rewrite

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 207.2s)

_Thinking:_

Now I need to restructure tutors.index.tsx with the SearchGroupProvider, SiteHeader with merged, and StickySearchBar. Let me rewrite this file.

The key changes:
1. Import SearchGroupProvider from sticky-search-group
2. Wrap content in `<SearchGroupProvider>`
3. Add SiteHeader with merged={true} centerSlot={<CompactSearchPill summary={compactSummary}/>}
4. hero section: remove border-b at lg, add bg-[color:var(--surface-header)], keep mobile border-b: `lg:border-b-0`
5. After hero section, add `<StickySearchBar><container><TutorsSearchBar .../></container></StickySearchBar>`
6. Keep results section

I need to compute compactSummary from useTutorsCompactSummary hook inside the component.

Let me rewrite the whole TutorsDirectory component. I need to add imports for SearchGroupProvider, useTutorsCompactSummary, TutorsSearchBar.

Also need to keep original combined TutorsSearch for homepage usage? The current TutorsSearch usage on index.tsx homepage — I need to ensure homepage combined TutorsSearch still works. Currently it imports TutorsSearch from component — unchanged.

Let me write the new tutors.index.tsx.

Now let me rewrite the tutors directory page with the grouped header:



**Tool: write**

**Input:**
```json
{
  "content": "import { createFileRoute, Link, useNavigate } from \"@tanstack/react-router\";\nimport { useEffect, useMemo, useState } from \"react\";\nimport { useQuery } from \"@tanstack/react-query\";\nimport { useTranslation } from \"react-i18next\";\nimport { z } from \"zod\";\nimport { SearchX } from \"lucide-react\";\nimport { SiteHeader } from \"@/components/layout/SiteHeader\";\nimport { SiteFooter } from \"@/components/layout/SiteFooter\";\nimport { WhatsAppIcon } from \"@/components/layout/WhatsAppFloatButton\";\nimport { Button } from \"@/components/ui/button\";\nimport { Skeleton } from \"@/components/ui/skeleton\";\nimport { useSearchGroup, SearchGroupProvider } from \"@/components/search/sticky-search-group\";\nimport { TutorsSearch } from \"@/components/search/tutors-search\";\nimport { useTutorsCompactSummary } from \"@/components/search/tutors-search\";\nimport { PublicTutorCard } from \"@/features/tutors/public-tutor-card\";\nimport { TutorSaveButton } from \"@/features/tutors/saved-tutors\";\nimport { CompareBar, CompareDialog, useTutorCompare } from \"@/features/tutors/compare-tutors\";\nimport { buildTutorWhatsAppUrl } from \"@/features/tutors/tutor-display\";\nimport {\n  fetchPublishedTutors,\n  getTutorCardHighlights,\n  matchesLessonModeFilter,\n  matchesStationFilter,\n  type Tutor,\n} from \"@/features/tutors/queries\";\nimport { matchesCategoryFilter, matchesSubjectQuery } from \"@/features/tutors/subjects\";\nimport { supabase } from \"@/integrations/supabase/client\";\n\nconst searchSchema = z.object({\n  category: z.string().optional(),\n  subject: z.string().optional(),\n  station: z.string().optional(), // nearest MTR station to the student\n  mode: z.string().optional(), // online | in_person | either\n  gender: z.string().optional(), // male | female | other\n  status: z.string().optional(), // uni_student | full_part_time_tutor | examiner\n  min_price: z.coerce.number().int().min(0).optional(),\n  max_price: z.coerce.number().int().min(0).optional(),\n  sort: z.string().optional(), // \"\" | price_asc | price_desc\n  q: z.string().optional(),\n  open: z.preprocess(\n    (value) => (value === \"1\" || value === \"true\" || value === true ? true : undefined),\n    z.boolean().optional(),\n  ), // transient: opens the mobile search overlay when hopping tabs\n});\ntype SearchState = z.infer<typeof searchSchema>;\n\nexport const Route = createFileRoute(\"/tutors/\")({\n  validateSearch: (s) => searchSchema.parse(s),\n  head: () => ({\n    meta: [\n      { title: \"Find Verified Tutors in Hong Kong | MatchMax\" },\n      {\n        name: \"description\",\n        content:\n          \"Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.\",\n      },\n      { name: \"robots\", content: \"index, follow\" },\n      { property: \"og:title\", content: \"Find Verified Tutors in Hong Kong | MatchMax\" },\n      {\n        property: \"og:description\",\n        content:\n          \"Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.\",\n      },\n      { property: \"og:url\", content: \"https://matchmax.hk/tutors\" },\n    ],\n    links: [{ rel: \"canonical\", href: \"https://matchmax.hk/tutors\" }],\n  }),\n  component: TutorsDirectory,\n});\n\nfunction TutorsDirectory() {\n  const { t } = useTranslation();\n  const search = Route.useSearch();\n  const navigate = useNavigate({ from: \"/tutors/\" });\n  const [draft, setDraft] = useState<SearchState>(search);\n\n  useEffect(() => {\n    setDraft(search);\n  }, [search]);\n\n  const setDraftParam = (patch: Partial<SearchState>) => {\n    setDraft((prev) => {\n      const next: SearchState = { ...prev, ...patch };\n      (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {\n        const v = next[k];\n        if (v === \"\" || v === undefined || (typeof v === \"number\" && Number.isNaN(v)))\n          delete next[k];\n      });\n      return next;\n    });\n  };\n\n  const { data: tutors = [], isLoading } = useQuery({\n    queryKey: [\"tutors\", \"published\"],\n    queryFn: fetchPublishedTutors,\n  });\n\n  const { data: whatsappNumber = \"\" } = useQuery({\n    queryKey: [\"settings\", \"whatsapp_number\"],\n    queryFn: async () => {\n      const { data, error } = await supabase\n        .from(\"app_settings\")\n        .select(\"value\")\n        .eq(\"key\", \"whatsapp_number\")\n        .maybeSingle();\n      if (error) throw error;\n      const value = data?.value;\n      return typeof value === \"string\" ? value : \"\";\n    },\n  });\n\n  const categoryFilter = (draft.category ?? \"\").toLowerCase();\n\n  const subjectFilter = (draft.subject ?? \"\").toLowerCase();\n  const stationFilter = draft.station ?? \"\";\n  const modeFilter = draft.mode ?? \"\";\n  const genderFilter = draft.gender ?? \"\";\n  const statusFilter = draft.status ?? \"\";\n  const effectiveStationFilter = modeFilter === \"in_person\" ? stationFilter : \"\";\n\n  const filtered = useMemo(() => {\n    const query = (draft.q ?? \"\").trim().toLowerCase();\n    const sort = draft.sort ?? \"\";\n\n    const list = tutors.filter((tut) => {\n      if (\n        categoryFilter &&\n        !matchesCategoryFilter(categoryFilter, tut.subjects, [\n          ...tut.target_students,\n          ...getTutorCardHighlights(tut),\n        ])\n      )\n        return false;\n      if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))\n        return false;\n      if (draft.min_price !== undefined && tut.hourly_rate < draft.min_price) return false;\n      if (draft.max_price !== undefined && tut.hourly_rate > draft.max_price) return false;\n      if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;\n      if (!matchesStationFilter(effectiveStationFilter, tut.stations)) return false;\n      if (genderFilter) {\n        const g = (tut as unknown as { gender?: string | null }).gender ?? \"\";\n        if (g !== genderFilter) return false;\n      }\n      if (statusFilter && (tut.tutor_status ?? \"\") !== statusFilter) return false;\n      if (\n        query &&\n        !(\n          tut.tutor_code.toLowerCase().includes(query) ||\n          tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||\n          getTutorCardHighlights(tut).some((highlight) => highlight.toLowerCase().includes(query))\n        )\n      )\n        return false;\n      return true;\n    });\n\n    return [...list].sort((a, b) => {\n      if (sort === \"price_asc\")\n        return a.hourly_rate - b.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);\n      if (sort === \"price_desc\")\n        return b.hourly_rate - a.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);\n      return (\n        (b.experience_years ?? 0) - (a.experience_years ?? 0) ||\n        a.hourly_rate - b.hourly_rate ||\n        a.tutor_code.localeCompare(b.tutor_code)\n      );\n    });\n  }, [\n    tutors,\n    categoryFilter,\n    subjectFilter,\n    effectiveStationFilter,\n    modeFilter,\n    genderFilter,\n    statusFilter,\n    draft.q,\n    draft.min_price,\n    draft.max_price,\n    draft.sort,\n  ]);\n\n  const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =\n    useTutorCompare(tutors);\n\n  const clearAll = () => {\n    setDraft({});\n    navigate({ search: {} as SearchState });\n  };\n\n  const openTutorDetail = (tutorCode: string) => {\n    navigate({ to: \"/tutors/$tutorCode\", params: { tutorCode } });\n  };\n\n  const hotlineUrl = buildTutorWhatsAppUrl(whatsappNumber, \"\");\n\n  const applySearch = (override?: Partial<SearchState>) => {\n    const next = { ...draft, ...override };\n    navigate({\n      search: {\n        ...next,\n        station: next.mode === \"in_person\" ? next.station : undefined,\n      },\n    });\n  };\n\n  const compactSummary = useTutorsCompactSummary(draft);\n\n  return (\n    <SearchGroupProvider>\n      <div className=\"flex min-h-screen flex-col bg-background\">\n        <SiteHeader merged centerSlot={<CompactSearchPill summary={compactSummary} />} />\n        <main className=\"flex-1\">\n          <section\n            className=\"bg-[color:var(--surface-header)] pt-10 pb-6 sm:pt-12 sm:pb-8 lg:border-b-0 lg:border-0\"\n          >\n            <div className=\"mx-auto max-w-7xl px-4 sm:px-6\">\n              <h1 className=\"text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl\">\n                Find verified tutors\n              </h1>\n              <p className=\"mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base\">\n                Start with a subject or tutor code, then narrow the list to the right fit.\n              </p>\n              <TutorsSearch\n                className=\"mt-7\"\n                draft={draft}\n                onDraftChange={setDraftParam}\n                onApply={applySearch}\n                onClear={clearAll}\n                resultCount={filtered.length}\n                allPrices={tutors.map((tutor) => tutor.hourly_rate)}\n                defaultOverlayOpen={search.open === true}\n                whatsappUrl={hotlineUrl || undefined}\n              />\n            </div>\n          </section>\n          <section className=\"py-12\">\n            <div className=\"mx-auto max-w-7xl px-4 sm:px-6\">\n              <div className=\"mb-6 flex items-baseline justify-between\">\n                {isLoading ? (\n                  <Skeleton className=\"h-4 w-28\" />\n                ) : (\n                  <p className=\"text-sm text-muted-foreground\">\n                    <span className=\"font-bold text-foreground\">{filtered.length}</span>{\" \"}\n                    {filtered.length === 1 ? \"tutor\" : \"tutors\"} found\n                  </p>\n                )}\n              </div>\n\n              {isLoading && (\n                <div className=\"grid gap-6 md:grid-cols-2 lg:grid-cols-3\">\n                  {Array.from({ length: 6 }).map((_, i) => (\n                    <Skeleton key={i} className=\"h-[23rem] rounded-[10px] border border-border\" />\n                  ))}\n                </div>\n              )}\n\n              {!isLoading && filtered.length === 0 && (\n                <div className=\"rounded-sm border border-border bg-card p-8 text-center sm:p-12\">\n                  <div className=\"mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]\">\n                    <SearchX\n                      className=\"h-5 w-5 text-[color:var(--muted-foreground)]\"\n                      aria-hidden=\"true\"\n                    />\n                  </div>\n                  <h2 className=\"mt-4 text-xl font-bold tracking-tight text-[color:var(--ink)] sm:text-2xl\">\n                    {t(\"directory.empty_title\")}\n                  </h2>\n                  <p className=\"mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground\">\n                    {t(\"directory.empty_desc\")}\n                  </p>\n                  <div className=\"mt-6 flex flex-wrap justify-center gap-3\">\n                    <Button variant=\"outline\" onClick={clearAll}>\n                      {t(\"directory.empty_clear\")}\n                    </Button>\n                    {hotlineUrl ? (\n                      <Button asChild variant=\"ghost\">\n                        <a href={hotlineUrl} target=\"_blank\" rel=\"noreferrer\">\n                          <WhatsAppIcon\n                            className=\"mr-2 h-4 w-4 text-[color:var(--muted-foreground)]\"\n                            aria-hidden=\"true\"\n                          />\n                          {t(\"directory.empty_whatsapp\")}\n                        </a>\n                      </Button>\n                    ) : null}\n                    <Button asChild variant=\"solid\" color=\"blue\" className=\"font-bold\">\n                      <Link to=\"/tutor-requests\" search={{ post: true }}>\n                        {t(\"directory.empty_case\")}\n                      </Link>\n                    </Button>\n                  </div>\n                </div>\n              )}\n\n              {!isLoading && filtered.length > 0 && (\n                <div className=\"grid gap-6 md:grid-cols-2 lg:grid-cols-3\">\n                  {filtered.map((tut: Tutor) => (\n                    <PublicTutorCard\n                      key={tut.id}\n                      tutor={tut}\n                      priceSuffix={t(\"featured.per_hour\")}\n                      onOpen={openTutorDetail}\n                      onCompareToggle={() => toggleCompare(tut)}\n                      compareSelected={compareIds.includes(tut.id)}\n                      footerAction={\n                        <>\n                          <TutorSaveButton tutorId={tut.id} compact />\n                          <Button\n                            asChild\n                            className=\"h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]\"\n                          >\n                            <a\n                              href={buildTutorWhatsAppUrl(whatsappNumber, tut.tutor_code)}\n                              target=\"_blank\"\n                              rel=\"noreferrer\"\n                              onClick={(event) => event.stopPropagation()}\n                            >\n                              Request tutor\n                            </a>\n                          </Button>\n                        </>\n                      }\n                    />\n                  ))}\n                </div>\n              )}\n            </div>\n          </section>\n        </main>\n        <SiteFooter />\n        {compareTutors.length > 0 && !compareOpen ? (\n          <CompareBar\n            selectedTutors={compareTutors}\n            onOpenCompare={() => setCompareOpen(true)}\n            onClear={clearCompare}\n          />\n        ) : null}\n        <CompareDialog\n          open={compareOpen}\n          onOpenChange={setCompareOpen}\n          tutors={compareTutors}\n          whatsappNumber={whatsappNumber}\n        />\n      </div>\n    </SearchGroupProvider>\n  );\n}",
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/tutors.index.tsx"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 201.5s)

_Thinking:_

Now I need to edit SiteHeader to accept the new props (merged, centerSlot). Already did earlier. Also add i18n keys.

Now edit courses.index.tsx. Let me read it first and then rewrite.

Actually I already wrote the new courses-search and courses components. Now courses.index.tsx needs restructuring similarly. Let me read courses.index.tsx.

Now let me edit `courses.index.tsx` similarly:


---

## Assistant (Build · Nemotron 3.5 Lightning Free · 112.2s)

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 98.8s)

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 66.6s)

_Thinking:_

Let me read the current courses.index.tsx and then rewrite it.

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.index.tsx"
}
```

**Output:**
```
<path>/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/routes/courses.index.tsx</path>
<type>file</type>
<content>
1: import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
2: import { useEffect, useState } from "react";
3: import { useQuery } from "@tanstack/react-query";
4: import { z } from "zod";
5: import { Building2, Search } from "lucide-react";
6: import { SiteHeader } from "@/components/layout/SiteHeader";
7: import { SiteFooter } from "@/components/layout/SiteFooter";
8: import { EmptyState } from "@/components/business/empty-state";
9: import { Button } from "@/components/ui/button";
10: import { Skeleton } from "@/components/ui/skeleton";
11: import { CoursesSearch } from "@/components/search/courses-search";
12: import { CourseCard } from "@/features/courses/course-card";
13: import { useBusinessTracker } from "@/features/business/use-analytics";
14: import { fetchPublishedCourseSubjects, fetchPublishedCourses } from "@/features/courses/queries";
15: import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
16: 
17: const searchSchema = z.object({
18:   subject: z.string().optional(),
19:   level: z.string().optional(),
20:   mode: z.string().optional(),
21:   district: z.string().optional(),
22:   q: z.string().optional(),
23:   open: z.preprocess(
24:     (value) => (value === "1" || value === "true" || value === true ? true : undefined),
25:     z.boolean().optional(),
26:   ), // transient: opens the mobile search overlay when hopping tabs
27: });
28: type SearchState = z.infer<typeof searchSchema>;
29: 
30: export const Route = createFileRoute("/courses/")({
31:   beforeLoad: () => {
32:     if (!CENTRE_MARKET_ENABLED) throw notFound();
33:   },
34:   validateSearch: (s) => searchSchema.parse(s),
35:   head: () => ({
36:     meta: [
37:       { title: "Courses from Hong Kong Learning Centres & Tutors | MatchMax" },
38:       {
39:         name: "description",
40:         content:
41:           "Browse courses offered by verified tutoring businesses in Hong Kong — IB, DSE, IGCSE, AP, A-Level and more. Compare prices, schedules and lesson modes.",
42:       },
43:       { name: "robots", content: "index, follow" },
44:       { property: "og:title", content: "Courses | MatchMax" },
45:       { property: "og:url", content: "https://matchmax.hk/courses" },
46:     ],
47:     links: [{ rel: "canonical", href: "https://matchmax.hk/courses" }],
48:   }),
49:   component: CoursesDirectory,
50: });
51: 
52: function CoursesDirectory() {
53:   const search = Route.useSearch();
54:   const navigate = useNavigate({ from: "/courses/" });
55:   const [draft, setDraft] = useState<SearchState>(search);
56: 
57:   useEffect(() => {
58:     setDraft(search);
59:   }, [search]);
60: 
61:   const setDraftParam = (patch: Partial<SearchState>) => {
62:     setDraft((prev) => {
63:       const next: SearchState = { ...prev, ...patch };
64:       (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
65:         const v = next[k];
66:         if (v === "") delete next[k];
67:       });
68:       return next;
69:     });
70:   };
71: 
72:   const { data: courses, isLoading } = useQuery({
73:     queryKey: ["courses", "published", search],
74:     queryFn: () => fetchPublishedCourses(search),
75:   });
76: 
77:   const track = useBusinessTracker();
78:   useEffect(() => {
79:     if (!courses?.length) return;
80:     const orgIds = Array.from(
81:       new Set(courses.map((course) => course.organization?.id).filter(Boolean)),
82:     ) as string[];
83:     if (orgIds.length === 0) return;
84:     track(orgIds.map((organizationId) => ({ organizationId, type: "impression" as const })));
85:   }, [courses, track]);
86:   const { data: subjects } = useQuery({
87:     queryKey: ["courses", "published-subjects"],
88:     queryFn: fetchPublishedCourseSubjects,
89:   });
90: 
91:   const clearAll = () => {
92:     setDraft({});
93:     navigate({ search: {} as SearchState });
94:   };
95: 
96:   const results = courses ?? [];
97:   const hasActiveFilters = Object.values(search).some(Boolean);
98:   const subjectOptions = [
99:     { value: "", label: "Any subject" },
100:     ...(subjects ?? []).map((subject) => ({ value: subject, label: subject })),
101:   ];
102: 
103:   const handleSearch = (override?: Partial<SearchState>) => {
104:     navigate({ search: { ...draft, ...override } });
105:   };
106: 
107:   return (
108:     <div className="flex min-h-screen flex-col bg-background">
109:       <SiteHeader />
110:       <main className="flex-1">
111:         <section className="border-b border-border py-10 sm:py-12">
112:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
113:             <p className="text-sm font-semibold text-[color:var(--brand-link)]">Course directory</p>
114:             <h1 className="mt-2 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
115:               Find the right course
116:             </h1>
117:             <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
118:               Compare structured courses from verified education centres across Hong Kong.
119:             </p>
120: 
121:             <CoursesSearch
122:               className="mt-8"
123:               draft={draft}
124:               onDraftChange={setDraftParam}
125:               onApply={handleSearch}
126:               onClear={clearAll}
127:               subjectOptions={subjects ?? []}
128:               defaultOverlayOpen={search.open === true}
129:             />
130:           </div>
131:         </section>
132: 
133:         <section className="py-12">
134:           <div className="mx-auto max-w-7xl px-4 sm:px-6">
135:             <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
136:               {isLoading ? (
137:                 <Skeleton className="h-4 w-28" />
138:               ) : (
139:                 <p className="text-sm text-muted-foreground">
140:                   <span className="font-bold text-foreground">{results.length}</span>{" "}
141:                   {results.length === 1 ? "course" : "courses"} found
142:                 </p>
143:               )}
144:               {hasActiveFilters ? (
145:                 <Button variant="ghost" size="sm" onClick={clearAll}>
146:                   Clear filters
147:                 </Button>
148:               ) : null}
149:             </div>
150: 
151:             {isLoading && (
152:               <div className="flex flex-col gap-4">
153:                 {Array.from({ length: 5 }).map((_, i) => (
154:                   <Skeleton key={i} className="h-40 rounded-lg border border-border" />
155:                 ))}
156:               </div>
157:             )}
158: 
159:             {!isLoading && results.length === 0 && (
160:               <EmptyState
161:                 icon={Search}
162:                 title={
163:                   hasActiveFilters ? "No courses match these filters" : "No courses available yet"
164:                 }
165:                 description={
166:                   hasActiveFilters
167:                     ? "Try broadening your search or clear the filters to browse all published courses."
168:                     : "New courses from verified education centres will appear here."
169:                 }
170:                 action={
171:                   hasActiveFilters ? (
172:                     <Button variant="outline" onClick={clearAll}>
173:                       Clear filters
174:                     </Button>
175:                   ) : undefined
176:                 }
177:                 secondaryAction={
178:                   <Button asChild variant="ghost" prefix={<Building2 />}>
179:                     <Link to="/pricing">List your courses</Link>
180:                   </Button>
181:                 }
182:               />
183:             )}
184: 
185:             {!isLoading && results.length > 0 && (
186:               <div className="flex flex-col gap-4">
187:                 {results.map((course) => (
188:                   <CourseCard key={course.id} course={course} />
189:                 ))}
190:               </div>
191:             )}
192:           </div>
193:         </section>
194:       </main>
195:       <SiteFooter />
196:     </div>
197:   );
198: }

(End of file - total 198 lines)
</content>
```

---

## Assistant (Build · Nemotron 3.5 Lightning Free · 106.2s)

_Thinking:_

Now I need to rewrite courses.index.tsx with the grouped header pattern, same as tutors.

Key changes:
- Add imports for SearchGroupProvider, useCoursesCompactSummary, CoursesSearchBar
- Wrap in SearchGroupProvider
- SiteHeader merged with centerSlot
- Hero section bg surface-header, lg:border-b-0
- After hero, StickySearchBar + CoursesSearchBar
- Keep results section below

Let me rewrite the file.

Now rewrite courses.index.tsx with grouped header:


---

## Assistant (Build · Nemotron 3.5 Lightning Free · 28.3s)

---

