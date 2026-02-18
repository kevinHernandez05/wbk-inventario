import { supabase } from "./supabase";

export async function bootstrapOrgIfNeeded() {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess?.session?.user;
  if (!user) throw new Error("No session");

  // 1) ¿ya tengo org_members?
  const { data: memberships, error: memErr } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (memErr) throw memErr;
  if (memberships?.length) return { orgId: memberships[0].org_id, role: memberships[0].role };

  // 2) Crear org (created_by se llena por trigger)
  const slug = `inventario-${user.id.slice(0, 8)}`;
  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .insert({ name: "Inventario Demo", slug })
    .select("id")
    .single();

  if (orgErr) throw orgErr;

  // 3) Bootstrap owner membership (policy especial)
  const { error: insErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: user.id, role: "owner" });

  if (insErr) throw insErr;

  return { orgId: org.id, role: "owner" };
}
