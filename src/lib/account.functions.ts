import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: unknown, userId: string) {
  const roles: Array<"admin" | "super_admin"> = ["admin", "super_admin"];
  const client = supabase as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  for (const r of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: r });
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

export const provisionUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        displayName: z.string().trim().max(100).optional(),
        password: z.string().min(6).max(100).optional(),
        role: z.enum(["super_admin", "admin", "staff", "tutor", "parent"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Generate random password if omitted
    const password =
      data.password && data.password.length >= 6
        ? data.password
        : Math.random().toString(36).slice(-10) + "A1!";

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: data.displayName || data.email.split("@")[0],
      },
    });

    if (createError) throw new Error(createError.message);
    if (!newUser.user) throw new Error("Failed to create user account");

    const userId = newUser.user.id;
    const displayName = data.displayName || data.email.split("@")[0];

    // Ensure profile row is present with display name
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: data.email,
        display_name: displayName,
      },
      { onConflict: "id" },
    );

    // Assign initial role
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: userId,
        role: data.role,
      },
      { onConflict: "user_id,role" },
    );

    if (roleError) throw new Error(roleError.message);

    return { ok: true, userId, email: data.email };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: tutorError } = await supabaseAdmin
      .from("tutors")
      .delete()
      .eq("created_by", context.userId);
    if (tutorError) throw new Error(tutorError.message);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
