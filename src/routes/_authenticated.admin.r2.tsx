import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/useAuth";
import {
  deleteTutorProfileImage,
  listTutorProfileImages,
  setDefaultTutorProfileImage,
  uploadTutorProfileImage,
  type R2TutorImage,
} from "@/features/tutors/r2.functions";

export const Route = createFileRoute("/_authenticated/admin/r2")({
  head: () => ({
    meta: [
      { title: "R2 images — MatchMax admin" },
      { name: "description", content: "Manage tutor profile images stored in Cloudflare R2." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminR2Images,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function AdminR2Images() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasAnyRole, loading } = useAuth();
  const listFn = useServerFn(listTutorProfileImages);
  const uploadFn = useServerFn(uploadTutorProfileImage);
  const deleteFn = useServerFn(deleteTutorProfileImage);
  const setDefaultFn = useServerFn(setDefaultTutorProfileImage);

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const {
    data: images = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "r2", "tutor-images", "dashboard"],
    queryFn: () => listFn({ data: { limit: 200 } }) as Promise<R2TutorImage[]>,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const base64Data = await fileToBase64(file);
      return uploadFn({
        data: {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data,
        },
      }) as Promise<{ key: string; url: string }>;
    },
    onSuccess: async () => {
      toast.success("Image uploaded to R2");
      await queryClient.invalidateQueries({ queryKey: ["admin", "r2", "tutor-images"] });
      await refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (key: string) => {
      return deleteFn({ data: { key } });
    },
    onSuccess: async () => {
      toast.success("Image deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "r2", "tutor-images"] });
      await refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setDefault = useMutation({
    mutationFn: async ({ key, gender }: { key: string; gender: "male" | "female" }) => {
      return setDefaultFn({ data: { key, gender } });
    },
    onSuccess: async (_, { gender }) => {
      toast.success(
        gender === "male"
          ? "Default male profile image updated"
          : "Default female profile image updated",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "r2", "tutor-images"] });
      await queryClient.invalidateQueries({ queryKey: ["tutors"] });
      await refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onFilePick: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    upload.mutate(file);
  };

  const onCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied");
    } catch {
      toast.error("Unable to copy URL");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                R2 tutor images
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload and manage profile pictures used across tutor cards.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-4 text-sm font-bold text-white hover:bg-[color:var(--brand-royal)]">
                {upload.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload image
                <input type="file" accept="image/*" className="hidden" onChange={onFilePick} />
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => void refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-8">
            {isLoading ? (
              <div aria-label="Loading images" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <Skeleton className="h-44 w-full rounded-none" />
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-destructive/30 bg-card p-10 text-center text-sm text-destructive">
                {(error as Error)?.message || "Failed to load images from R2."}
              </div>
            ) : images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No images in the configured R2 prefix yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {images.map((item) => (
                  <article
                    key={item.key}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <img src={item.url} alt={item.key} className="h-44 w-full object-cover" />
                    <div className="space-y-2 p-3">
                      <p
                        className="truncate text-xs font-semibold text-foreground"
                        title={item.key}
                      >
                        {item.key}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.size ? `${Math.round(item.size / 1024)} KB` : "—"}
                        {item.lastModified
                          ? ` · ${new Date(item.lastModified).toLocaleString()}`
                          : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => void onCopyUrl(item.url)}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Copy URL
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-8" asChild>
                          <a href={item.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Open
                          </a>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          disabled={setDefault.isPending}
                          onClick={() => setDefault.mutate({ key: item.key, gender: "male" })}
                        >
                          Male default
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          disabled={setDefault.isPending}
                          onClick={() => setDefault.mutate({ key: item.key, gender: "female" })}
                        >
                          Female default
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (!confirm("Delete this image from R2?")) return;
                            remove.mutate(item.key);
                          }}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
