import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Forbidden: super admin only");
}

/** Return current viewer's admin identity + super-admin flag. */
export const getMyAdminIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, email, full_name, admin_code")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId),
    ]);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    return {
      id: context.userId,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      admin_code: profile?.admin_code ?? null,
      is_admin: roleSet.has("admin") || roleSet.has("super_admin"),
      is_super_admin: roleSet.has("super_admin"),
    };
  });

/** Super admin: create a new admin account with email + password. */
export const createAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        email: z.string().email().max(200),
        password: z.string().min(6).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase().trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const userId = created.user!.id;

    // Mint an admin_code + upsert profile with approved status
    const { data: codeRow } = await supabaseAdmin.rpc("gen_admin_code");
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        status: "approved",
        admin_code: codeRow as unknown as string,
      })
      .eq("id", userId);

    // Grant admin role
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, admin_code")
      .eq("id", userId)
      .single();

    return p;
  });

/** Super admin: list all admin accounts. */
export const listAdminAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin"]);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (!ids.length) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, admin_code, created_at")
      .in("id", ids)
      .order("created_at", { ascending: true });
    const superIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "super_admin").map((r: any) => r.user_id),
    );
    return (profiles ?? []).map((p: any) => ({ ...p, is_super_admin: superIds.has(p.id) }));
  });

/** Super admin: delete an admin (cannot delete self or another super admin). */
export const deleteAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((roles ?? []).some((r: any) => r.role === "super_admin"))
      throw new Error("Cannot delete another super admin");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Super admin: reset password for another admin. */
export const resetAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * PUBLIC: given an admin identifier (admin_code like ADM-XXXXXX or email),
 * return the email address to use for password sign-in. Does not reveal
 * whether an arbitrary email exists — always returns the input email if
 * it isn't an admin code, letting Supabase Auth handle the auth failure
 * uniformly.
 */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ identifier: z.string().trim().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    // Email path — return as-is.
    if (raw.includes("@")) return { email: raw.toLowerCase() };
    // Admin code path — normalize
    const code = raw.toUpperCase().startsWith("ADM-") ? raw.toUpperCase() : `ADM-${raw.toUpperCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("admin_code", code)
      .maybeSingle();
    if (!p?.email) throw new Error("No admin found with that ID");
    return { email: p.email };
  });
