import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  sortFn_datetime,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  tableFeatures,
  useTable,
  createSortedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/business/empty-state";
import { CourseFormModal } from "@/features/business/course-form-modal";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import {
  getBusinessAnalytics,
  type BusinessAnalytics,
} from "@/features/business/business.functions";
import { courseModeLabel, formatCoursePrice, type Course } from "@/features/courses/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    datetime: sortFn_datetime,
  },
});

async function fetchMyCourses(orgId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Course[];
}

const dateFmt = new Intl.DateTimeFormat("en-HK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFmt.format(parsed);
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (sorted === "desc") return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />;
}

export function CoursesPanel({ onLimitReached }: { onLimitReached?: () => void }) {
  const { organization, usage } = useMyOrganization();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [duplicatingCourse, setDuplicatingCourse] = useState<Course | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [coursePendingDeletion, setCoursePendingDeletion] = useState<Course | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "posted", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  const orgId = organization?.id ?? null;
  const { data: courses, isLoading } = useQuery({
    queryKey: ["my-courses", orgId],
    queryFn: () => fetchMyCourses(orgId as string),
    enabled: !!orgId,
  });

  const analyticsFn = useServerFn(getBusinessAnalytics);
  const { data: analytics } = useQuery({
    queryKey: ["business-analytics", orgId],
    queryFn: () =>
      analyticsFn({ data: { organizationId: orgId as string } }) as Promise<BusinessAnalytics>,
    enabled: !!orgId,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["my-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["my-organization"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
    void queryClient.invalidateQueries({ queryKey: ["business-analytics"] });
  }, [queryClient]);

  const atLimit = useMemo(() => {
    if (!usage) return false;
    return usage.courseLimit !== null && usage.coursesUsed >= usage.courseLimit;
  }, [usage]);

  const data = courses ?? [];

  const handleTogglePublished = async (course: Course, next: boolean) => {
    const { error } = await supabase
      .from("courses")
      .update({ is_published: next })
      .eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Course published" : "Course unpublished");
    invalidate();
  };

  const handleDelete = async (course: Course) => {
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Course deleted");
    setCoursePendingDeletion(null);
    invalidate();
  };

  const handleBulkPublished = async (next: boolean) => {
    const ids = table.getFilteredSelectedRowModel().rows.map((row) => row.original.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("courses").update({ is_published: next }).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      next
        ? `${ids.length} ${ids.length === 1 ? "course" : "courses"} published`
        : `${ids.length} ${ids.length === 1 ? "course" : "courses"} unpublished`,
    );
    setRowSelection({});
    invalidate();
  };

  const handleBulkDelete = async () => {
    const ids = table.getFilteredSelectedRowModel().rows.map((row) => row.original.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("courses").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} ${ids.length === 1 ? "course" : "courses"} deleted`);
    setBulkDeleteOpen(false);
    setRowSelection({});
    invalidate();
  };

  const viewsByCourse = useMemo(
    () =>
      new Map<string, number>(
        (analytics?.courseViews ?? []).map((entry) => [entry.courseId, entry.views]),
      ),
    [analytics],
  );

  const columns = useMemo<ColumnDef<typeof TABLE_FEATURES, Course>[]>(() => {
    const def: ColumnDef<typeof TABLE_FEATURES, Course>[] = [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
            aria-label="Select all courses on this page"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.title}`}
          />
        ),
      },
      {
        accessorKey: "title",
        enableHiding: false,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-[color:var(--ink)]"
          >
            Course
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        filterFn: (row, _id, value: string) => {
          const q = value.toLowerCase();
          return (
            row.original.title.toLowerCase().includes(q) ||
            (row.original.subject ?? "").toLowerCase().includes(q)
          );
        },
        cell: ({ row }) => {
          const course = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                {course.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[course.level, courseModeLabel(course.mode), course.district]
                  .filter(Boolean)
                  .join(" · ")}
                {course.session_days.length > 0
                  ? ` · ${course.session_days
                      .map(
                        (code) =>
                          ({
                            sun: "Sun",
                            mon: "Mon",
                            tue: "Tue",
                            wed: "Wed",
                            thu: "Thu",
                            fri: "Fri",
                            sat: "Sat",
                          })[code] ?? code,
                      )
                      .join(", ")}`
                  : ""}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "is_published",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </span>
        ),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
              row.original.is_published
                ? "bg-emerald-50 text-emerald-700 ring-emerald-700/10"
                : "bg-gray-100 text-gray-600 ring-gray-500/10"
            }`}
          >
            {row.original.is_published ? "Published" : "Unpublished"}
          </span>
        ),
      },
      {
        accessorKey: "price",
        sortFn: (rowA, rowB, columnId) => {
          const first = (rowA.getValue(columnId) as number | null) ?? -1;
          const second = (rowB.getValue(columnId) as number | null) ?? -1;
          return first - second;
        },
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-[color:var(--ink)]"
          >
            Price
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-medium text-[color:var(--ink)]">
            {formatCoursePrice(row.original.price, row.original.currency) ?? "—"}
          </span>
        ),
      },
      {
        id: "views",
        enableSorting: true,
        accessorFn: (row) => viewsByCourse.get(row.id) ?? 0,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-[color:var(--ink)]"
          >
            Views
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {viewsByCourse.get(row.original.id) ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        id: "posted",
        sortFn: "datetime",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-[color:var(--ink)]"
          >
            Posted
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const course = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${course.title}`}>
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <a href={`/courses/${course.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      View public page
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingCourse(course);
                      setIsDuplicating(false);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setDuplicatingCourse(course);
                      setIsDuplicating(true);
                      setFormOpen(true);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void handleTogglePublished(course, !course.is_published)}
                  >
                    {course.is_published ? "Unpublish" : "Publish"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-500"
                    onClick={() => setCoursePendingDeletion(course)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
    return def;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewsByCourse]);

  const table = useTable({
    features: TABLE_FEATURES,
    data,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    initialState: { pagination: { pageIndex: 0, pageSize: 8 } },
  });

  const titleFilter = (table.getColumn("title")?.getFilterValue() as string) ?? "";
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const totalCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  if (!organization) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {usage?.courseLimit == null
            ? "Unlimited courses on your plan"
            : `${usage.coursesUsed} of ${usage.courseLimit} course slots used`}
        </p>
        <Button
          disabled={atLimit || organization.status === "suspended"}
          onClick={() => {
            setEditingCourse(null);
            setIsDuplicating(false);
            setFormOpen(true);
          }}
          className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New course
        </Button>
      </div>

      {atLimit && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          You've used all {usage?.courseLimit} course slots on the Business plan. Delete a course or
          upgrade to Enterprise for unlimited courses.
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 rounded-lg border border-border" />
          <Skeleton className="h-16 rounded-lg border border-border" />
          <Skeleton className="h-16 rounded-lg border border-border" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Post your first course and it will appear in the public courses directory once your account is activated."
            action={
              <Button
                onClick={() => setFormOpen(true)}
                className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Post your first course
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={titleFilter}
                onChange={(event) => table.getColumn("title")?.setFilterValue(event.target.value)}
                placeholder="Search courses..."
                className="h-9 w-56 pl-8 text-sm"
                aria-label="Search courses by title or subject"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCount} {totalCount === 1 ? "course" : "courses"}
            </p>
          </div>

          {selectedCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1FA8B6]/30 bg-[#1FA8B6]/5 px-4 py-2.5">
              <span className="text-sm font-medium text-[color:var(--ink)] tabular-nums">
                {selectedCount} selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleBulkPublished(true)}>
                  Publish
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleBulkPublished(false)}>
                  Unpublish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-[color:var(--ink)]"
                  onClick={() => table.resetRowSelection()}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-b border-border bg-muted/40 hover:bg-muted/40"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "h-9",
                          header.column.id === "select" && "w-10 pl-4",
                          header.column.id === "actions" && "w-12 pr-4",
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className="border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-muted/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "py-3",
                            cell.column.id === "select" && "pl-4",
                            cell.column.id === "actions" && "pr-4",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No courses match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/20 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                Page {table.state.pagination.pageIndex + 1} of {Math.max(pageCount, 1)}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
            <AlertDialogContent className="max-w-md rounded-lg border-border bg-card p-6">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete selected courses?</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedCount} {selectedCount === 1 ? "course" : "courses"} will be permanently
                  removed from your business account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-2 sm:justify-end">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void handleBulkDelete()}
                >
                  Delete courses
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <CourseFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingCourse(null);
            setDuplicatingCourse(null);
            setIsDuplicating(false);
          }
        }}
        organization={organization}
        course={isDuplicating ? duplicatingCourse : editingCourse}
        duplicate={isDuplicating}
        onSaved={() => {
          setFormOpen(false);
          setEditingCourse(null);
          setDuplicatingCourse(null);
          setIsDuplicating(false);
          invalidate();
          if (atLimit) onLimitReached?.();
        }}
      />
      <AlertDialog
        open={coursePendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open) setCoursePendingDeletion(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-lg border-border bg-card p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              {coursePendingDeletion
                ? `"${coursePendingDeletion.title}" will be permanently removed from your business account.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (coursePendingDeletion) void handleDelete(coursePendingDeletion);
              }}
            >
              Delete course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
