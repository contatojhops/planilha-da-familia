import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Cria uma conta de login de verdade para um membro (e-mail + senha
// provisória), sem precisar do fluxo de convite/link. Só admin da família.

const inputSchema = z.object({
  family_id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().trim().min(1),
  role: z.enum(["admin", "member", "viewer"]),
});

function randomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const createMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica (como o usuário chamador, sob RLS) se ele é admin da família
    const { data: membership } = await supabase
      .from("family_members")
      .select("role")
      .eq("family_id", data.family_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership || membership.role !== "admin") {
      throw new Error("Somente administradores podem fazer isso");
    }

    // Privilégio total só a partir daqui
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = randomPassword();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.display_name },
    });

    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário");
    }

    const { error: memberErr } = await supabaseAdmin
      .from("family_members")
      .insert({ family_id: data.family_id, user_id: created.user.id, role: data.role });

    if (memberErr) {
      throw new Error(memberErr.message);
    }

    return { ok: true as const, email: data.email, password };
  });
