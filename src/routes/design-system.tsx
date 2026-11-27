import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Inbox,
  Moon,
  MoreHorizontal,
  Plus,
  Sun,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { InitialAvatar } from "@/components/ui/initial-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { RadioCards } from "@/components/ui/radio-cards";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/features/theme/ThemeProvider";

/**
 * The MatchMax component library: one living page that renders the REAL
 * shared components in every variant, so the catalogue can never drift from
 * the site. Rules for each live in DESIGN.md. Internal reference, noindex.
 */
export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [{ title: "Design system | MatchMax" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: DesignSystemPage,
});

const SECTIONS = [
  ["colors", "Colours"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["inputs", "Text fields"],
  ["dropdowns", "Dropdowns"],
  ["choices", "Checkboxes, radios, switches"],
  ["badges", "Badges"],
  ["banners", "Banners"],
  ["cards", "Cards"],
  ["tables", "Tables"],
  ["tabs", "Tabs"],
  ["overlays", "Dialogs, menus, tooltips, toasts"],
  ["feedback", "Loading, empty, progress"],
  ["navigation", "Pagination, avatars"],
] as const;

function Section({
  id,
  title,
  use,
  avoid,
  children,
}: {
  id: string;
  title: string;
  use: string;
  avoid?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-10">
      <h2>{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        <span className="font-semibold text-[color:var(--foreground)]">Use for: </span>
        {use}
      </p>
      {avoid ? (
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          <span className="font-semibold text-[color:var(--foreground)]">Don't: </span>
          {avoid}
        </p>
      ) : null}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Swatch({ name, token, note }: { name: string; token: string; note: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-control)] border border-border">
      <div className="h-16" style={{ background: `var(${token})` }} />
      <div className="space-y-0.5 p-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{token}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function DesignSystemPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [shortPick, setShortPick] = useState("");
  const [longPick, setLongPick] = useState("");
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [radio, setRadio] = useState("online");
  const [card, setCard] = useState<string | null>("weekly");
  const [page, setPage] = useState(2);

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1536px] flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1>Design system</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The shared building blocks of MatchMax. Every example below is the real component the
              site uses. Rules live in DESIGN.md; when you need one of these, reuse it rather than
              styling a new one.
            </p>
          </div>
          <Button onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {isDark ? "Light mode" : "Dark mode"}
          </Button>
        </div>

        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-[color:var(--surface-hover)]"
            >
              {label}
            </a>
          ))}
        </nav>

        <Section
          id="colors"
          title="Colours"
          use="Ink for text, neutral surfaces for everything at rest, and Azure as the one accent for links, focus and the main call to action. Status colours only mean status."
          avoid="invent new hues or greys, colour whole panels, or use azure for decoration."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Swatch name="Ink" token="--ink" note="Text, neutral buttons" />
            <Swatch name="Azure" token="--brand-link" note="Links, focus, main CTA" />
            <Swatch name="Azure wash" token="--accent" note="Hover, info banners" />
            <Swatch name="Surface" token="--surface" note="Page and button fill" />
            <Swatch name="Card" token="--card" note="Cards, half a step off" />
            <Swatch name="Hairline" token="--border" note="Borders, dividers" />
            <Swatch name="Secondary ink" token="--muted-foreground" note="Supporting text" />
            <Swatch name="Success" token="--success" note="Done, paid, verified" />
            <Swatch name="Warning" token="--warning" note="Needs attention" />
            <Swatch name="Danger" token="--destructive" note="Errors, destructive" />
            <Swatch name="WhatsApp" token="--brand-whatsapp" note="WhatsApp actions only" />
            <Swatch name="Hover wash" token="--surface-hover" note="Row and item hover" />
          </div>
        </Section>

        <Section
          id="type"
          title="Typography"
          use="Plus Jakarta Sans for everything, headings included. Weights: 700 headings, 600 buttons and card titles, 500 labels, 400 body. Sentence case."
          avoid="add a third font, go above 700, use ALL CAPS, or letter-space Chinese text."
        >
          <div className="space-y-4">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
              }}
            >
              Display · 找到最合適的導師
            </p>
            <h1>Heading 1 · Page title 頁面標題</h1>
            <h2>Heading 2 · Section title</h2>
            <h3>Heading 3 · Card or panel title</h3>
            <p className="text-base">
              Body 16px · Running text for descriptions and explanations. 內文用 16px，行距 1.6。
            </p>
            <p className="text-sm text-muted-foreground">
              Small 14px secondary · Supporting lines, hints and metadata.
            </p>
            <p className="text-xs font-medium">Label 12px · Form labels, chips, table headers</p>
            <p className="text-sm">
              <a
                className="text-[color:var(--brand-link)] underline-offset-4 hover:underline"
                href="#type"
              >
                Text link
              </a>{" "}
              · Prices and changing numbers use{" "}
              <span className="font-semibold tabular-nums">HK$1,240.00</span>
            </p>
          </div>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          use="Neutral (default) for almost everything. Azure (solid blue) only for the one conversion action on a screen: find a tutor, post a request, join, pay, publish. Labels are a verb plus an object."
          avoid="put two azure buttons side by side, add shadows, or style a <button> by hand."
        >
          <Row label="Variants">
            <Button>Neutral (default)</Button>
            <Button variant="solid" color="blue">
              Find a tutor
            </Button>
            <Button variant="solid" color="neutral">
              Ink solid
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="soft" color="blue">
              Soft
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="Status colours (solid)">
            <Button variant="solid" color="green">
              Confirm lesson
            </Button>
            <Button variant="solid" color="amber">
              Review needed
            </Button>
            <Button variant="destructive">Delete listing</Button>
          </Row>
          <Row label="Sizes">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <Plus aria-hidden />
            </Button>
          </Row>
          <Row label="Shapes and states">
            <Button shape="pill">Pill</Button>
            <Button disabled>Disabled</Button>
            <Button variant="solid" color="blue" disabled>
              Disabled CTA
            </Button>
          </Row>
        </Section>

        <Section
          id="inputs"
          title="Text fields"
          use="Input for one line, Textarea for paragraphs. Every field has a visible Label; errors appear under the field and say how to fix it."
          avoid="use placeholder text as the only label, or show errors only in a toast."
        >
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ds-name">Your name</Label>
              <Input id="ds-name" placeholder="e.g. Chan Tai Man" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-email">Email</Label>
              <Input id="ds-email" aria-invalid defaultValue="chan@" />
              <p className="text-xs font-medium text-destructive">
                Enter an email like name@company.com
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ds-notes">What should the tutor know?</Label>
              <Textarea id="ds-notes" rows={3} placeholder="Goals, exam date, weak topics…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-disabled">Disabled</Label>
              <Input id="ds-disabled" disabled defaultValue="Can't edit" />
            </div>
          </div>
        </Section>

        <Section
          id="dropdowns"
          title="Dropdowns"
          use="Select for a short fixed list (up to about 10 options). Searchable select for long lists (subjects, schools, MTR stations). Dropdown menu for actions behind a button (Edit, Share, Delete)."
          avoid="use the browser's native <select>, or a Select for actions."
        >
          <div className="grid max-w-4xl gap-6 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Select (short list)</Label>
              <Select value={shortPick} onValueChange={setShortPick}>
                <SelectTrigger>
                  <SelectValue placeholder="Lesson mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="in_person">In person</SelectItem>
                  <SelectItem value="either">Either</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Searchable select (long list)</Label>
              <SearchableSelect
                value={longPick}
                onChange={setLongPick}
                options={[
                  "Mathematics",
                  "Physics",
                  "Chemistry",
                  "Biology",
                  "Economics",
                  "English Language",
                  "Chinese Language",
                  "History",
                ]}
                placeholder="Choose a subject"
                searchPlaceholder="Search subjects…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dropdown menu (actions)</Label>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      Actions <ChevronDown aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>Edit listing</DropdownMenuItem>
                    <DropdownMenuItem>Share link</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="choices"
          title="Checkboxes, radios, switches"
          use="Checkbox for agreeing or picking several; Radio for one of a few visible options; Radio cards when each option needs a description; Switch for a setting that takes effect immediately."
          avoid="use the browser's native checkbox, or a Switch for something that needs a Save button."
        >
          <Row label="Checkbox and switch">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />I agree
              to the Notes Terms
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={on} onCheckedChange={setOn} />
              Open for new students
            </label>
          </Row>
          <Row label="Radio group">
            <RadioGroup value={radio} onValueChange={setRadio} className="flex gap-4">
              {["online", "in_person"].map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={v} />
                  {v === "online" ? "Online" : "In person"}
                </label>
              ))}
            </RadioGroup>
          </Row>
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Radio cards</p>
            <RadioCards
              value={card}
              onValueChange={setCard}
              options={[
                { value: "weekly", label: "Weekly lessons", description: "Same slot every week" },
                { value: "flexible", label: "Flexible", description: "Book lesson by lesson" },
              ]}
            />
          </div>
        </Section>

        <Section
          id="badges"
          title="Badges"
          use="Short status or category marks: Verified, Paid, Pending, Full. One or two words, sentence case."
          avoid="use badges as buttons, or stack more than two on one item."
        >
          <Row label="Status">
            <Badge variant="info">New</Badge>
            <Badge variant="success">Paid</Badge>
            <Badge variant="warning">Pending review</Badge>
            <Badge variant="danger">Overdue</Badge>
          </Row>
          <Row label="Neutral">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </Row>
        </Section>

        <Section
          id="banners"
          title="Banners"
          use="A message about the whole page or form: info, success, warning or an error. Title in a few words, then one sentence on what to do."
          avoid="hand-roll yellow or green boxes (use these four), or show a banner for something a toast or inline message covers."
        >
          <div className="grid max-w-4xl gap-3">
            <Alert variant="info">
              <Info aria-hidden className="h-4 w-4" />
              <AlertTitle>Your profile is under review</AlertTitle>
              <AlertDescription>We'll email you within 2 working days.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              <AlertTitle>Payment received</AlertTitle>
              <AlertDescription>Your download is ready below.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTriangle aria-hidden className="h-4 w-4" />
              <AlertTitle>Add payout details</AlertTitle>
              <AlertDescription>You need them before listing a paid item.</AlertDescription>
            </Alert>
            <Alert variant="danger">
              <XCircle aria-hidden className="h-4 w-4" />
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>
                The file is over 200 MB. Compress it and try again.
              </AlertDescription>
            </Alert>
          </div>
        </Section>

        <Section
          id="cards"
          title="Cards"
          use="A self-contained group: a tutor, a listing, a summary. Hairline border, card fill, generous padding."
          avoid="put a card inside a card, add a resting shadow, or leave a 1 to 4px gap between cards."
        >
          <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>IB Biology HL notes</CardTitle>
                <CardDescription>Cell respiration · 24 pages</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-lg font-semibold tabular-nums">HK$120</span>
                <Button size="sm">View</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>This month</CardTitle>
                <CardDescription>Lessons logged</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">12</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section
          id="tables"
          title="Tables"
          use="Rows of comparable records (orders, reports, invoices). Console table on staff and account pages; right-align numbers and actions."
          avoid="hand-build a <table> with custom borders, or use a table for a single record."
        >
          <div className="max-w-4xl">
            <ConsoleTable minTableWidth="560px">
              <ConsoleTableHead>
                <tr>
                  <ConsoleTh>Order</ConsoleTh>
                  <ConsoleTh>Status</ConsoleTh>
                  <ConsoleTh align="right">Amount</ConsoleTh>
                  <ConsoleTh align="right">Actions</ConsoleTh>
                </tr>
              </ConsoleTableHead>
              <ConsoleTableBody>
                {[
                  ["MM-1042", "success", "Paid", "120.00"],
                  ["MM-1041", "warning", "Pending", "80.00"],
                  ["MM-1040", "danger", "Refunded", "45.00"],
                ].map(([id, tone, label, amount]) => (
                  <tr key={id}>
                    <ConsoleTd className="font-mono text-xs">{id}</ConsoleTd>
                    <ConsoleTd>
                      <Badge variant={tone as "success" | "warning" | "danger"}>{label}</Badge>
                    </ConsoleTd>
                    <ConsoleTd align="right" className="tabular-nums">
                      HK${amount}
                    </ConsoleTd>
                    <ConsoleTd align="right">
                      <Button size="sm" variant="ghost" aria-label="More">
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </ConsoleTd>
                  </tr>
                ))}
              </ConsoleTableBody>
            </ConsoleTable>
          </div>
        </Section>

        <Section
          id="tabs"
          title="Tabs"
          use="Switching between views of the same thing (Tutors | Marketplace, Upcoming | Past)."
          avoid="use tabs as navigation to other pages, or for more than about 5 options."
        >
          <Tabs defaultValue="upcoming" className="max-w-xl">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="pt-3 text-sm text-muted-foreground">
              3 lessons this week.
            </TabsContent>
            <TabsContent value="past" className="pt-3 text-sm text-muted-foreground">
              18 lessons so far.
            </TabsContent>
            <TabsContent value="cancelled" className="pt-3 text-sm text-muted-foreground">
              No cancelled lessons.
            </TabsContent>
          </Tabs>
        </Section>

        <Section
          id="overlays"
          title="Dialogs, menus, tooltips, toasts"
          use="Dialog for a focused task or a confirmation that names the consequence. Tooltip for a short hint on an icon. Toast for background work that finished (saved, copied), never the only confirmation of something important."
          avoid="use the browser's alert() / prompt() / confirm(), or put long content in a tooltip."
        >
          <Row label="Overlays">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this lesson?</DialogTitle>
                  <DialogDescription>
                    The tutor is notified and the slot opens for other students. This can't be
                    undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button>Keep lesson</Button>
                  <Button variant="destructive">Cancel lesson</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" aria-label="What is SCRC?">
                    <Info aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sexual Conviction Record Check</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button onClick={() => toast.success("Link copied")}>Show toast</Button>
          </Row>
        </Section>

        <Section
          id="feedback"
          title="Loading, empty, progress"
          use="Skeletons while content loads (same shape as the content). Empty states say why it's empty and offer one next step. Progress for multi-step forms and uploads."
          avoid="show a blank area or a spinner where a skeleton fits, or an empty state with no next step."
        >
          <div className="grid max-w-4xl gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Upload 60%</p>
              <Progress value={60} />
            </div>
            <div className="sm:col-span-2">
              <EmptyState
                icon={Inbox}
                title="No saved tutors yet"
                description="Tutors you save appear here."
                action={<Button size="sm">Browse tutors</Button>}
              />
            </div>
          </div>
        </Section>

        <Section
          id="navigation"
          title="Pagination, avatars"
          use="Pagination for long lists split into pages. Initial avatars when there's no photo; the colour comes from the account, so it stays the same everywhere."
        >
          <Row label="Pagination">
            <Pagination page={page} pageCount={8} onPageChange={setPage} />
          </Row>
          <Row label="Initial avatars">
            {["Chan Tai Man", "Wong Mei", "Lee Ka Ho"].map((n) => (
              <InitialAvatar key={n} stableId={n} name={n} className="h-10 w-10 text-sm" />
            ))}
          </Row>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}
