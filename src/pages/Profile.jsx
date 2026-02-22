// src/pages/Profile.jsx
import { useMemo, useState } from "react";
import { Copy, LogOut, Shield, User2, Building2 } from "lucide-react";
import TableShell from "../ui/TableShell";
import { useAuth } from "../auth/AuthProvider";
import { useOrg } from "../org/OrgProvider";
import { supabase } from "../lib/supabase";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function fmtDate(ts) {
  try {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(+d)) return String(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return String(ts);
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    return true;
  } catch {
    return false;
  }
}

export default function Profile() {
  const { user } = useAuth();
  const { orgId, loadingOrg } = useOrg();

  const [copied, setCopied] = useState("");

  const email = user?.email || "—";
  const userId = user?.id || "—";

  const displayName = useMemo(() => {
    const md = user?.user_metadata || {};
    return md.full_name || md.name || (user?.email ? user.email.split("@")[0] : "Usuario");
  }, [user]);

  const createdAt = user?.created_at ? fmtDate(user.created_at) : "—";
  const lastSignIn = user?.last_sign_in_at ? fmtDate(user.last_sign_in_at) : "—";

  const initials = useMemo(() => getInitials(displayName || email), [displayName, email]);

  async function onCopy(label, value) {
    const ok = await copyToClipboard(value);
    setCopied(ok ? label : "Error copiando");
    setTimeout(() => setCopied(""), 1200);
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
      // RequireAuth / AuthProvider se encargan de redirigir
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error cerrando sesión");
    }
  }

  return (
    <TableShell
      title="Perfil"
      subtitle="Información de tu cuenta y sesión. (MVP)"
      actions={
        <button
          onClick={logout}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 inline-flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Card: User */}
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader
            icon={User2}
            title="Cuenta"
            right={copied ? <span className="text-xs text-slate-500">{copied}</span> : null}
          />

          <div className="mt-4 flex items-start gap-4">
            <div className="h-14 w-14 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-600 text-white flex items-center justify-center font-semibold shadow-sm">
              {initials}
            </div>

            <div className="flex-1">
              <div className="text-lg font-semibold text-slate-900">{displayName}</div>
              <div className="text-sm text-slate-600">{email}</div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow
                  label="User ID"
                  value={userId}
                  onCopy={() => onCopy("Copiado: User ID", userId)}
                />
                <InfoRow label="Creado" value={createdAt} />
                <InfoRow label="Último login" value={lastSignIn} />
                <InfoRow label="Rol" value="Usuario (MVP)" />
              </div>
            </div>
          </div>
        </Card>

        {/* Card: Org */}
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader icon={Building2} title="Organización activa" />
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Org ID</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 break-all">
                {loadingOrg ? "Cargando..." : orgId || "—"}
              </div>

              <div className="mt-3">
                <button
                  disabled={!orgId}
                  onClick={() => onCopy("Copiado: Org ID", orgId)}
                  className={cn(
                    "h-10 px-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2",
                    !orgId && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Copy className="h-4 w-4" />
                  Copiar Org ID
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">Tip</div>
              <div className="mt-1 text-sm text-slate-600">
                En este MVP, el Org ID define el scope de toda la data (productos, almacenes,
                movimientos, etc.).
              </div>
            </div>
          </div>
        </Card>

        {/* Card: Security */}
        <Card className="col-span-12">
          <CardHeader icon={Shield} title="Seguridad" />
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <MiniStat
              title="Row Level Security"
              value="ON"
              note="Protege datos por org/miembro"
              tone="ok"
            />
            <MiniStat
              title="Acceso"
              value="Solo email/password"
              note="Sin social login (por ahora)"
              tone="muted"
            />
            <MiniStat
              title="Soporte"
              value="wbkrd.com"
              note="Contacto para cuentas/recuperación"
              tone="muted"
            />
          </div>
        </Card>
      </div>
    </TableShell>
  );
}

/* ---------------- UI bits ---------------- */

function Card({ className, children }) {
  return (
    <div className={cn("rounded-3xl border border-slate-200 bg-white p-5", className)}>
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, right }) {
  return (
    <div className="flex items-center justify-between">
      <div className="inline-flex items-center gap-2">
        {Icon ? (
          <span className="h-9 w-9 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="text-sm font-semibold text-slate-900">{title}</div>
      </div>
      {right ? right : null}
    </div>
  );
}

function InfoRow({ label, value, onCopy }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900 break-all">{value || "—"}</div>
        {onCopy ? (
          <button
            onClick={onCopy}
            className="h-9 w-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-500"
            title={`Copiar ${label}`}
          >
            <Copy className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ title, value, note, tone = "muted" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className={cn("mt-3 inline-flex items-center rounded-full px-2 py-1 text-xs border", cls)}>
        {value}
      </div>
      <div className="mt-3 text-sm text-slate-600">{note}</div>
    </div>
  );
}

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "U";
  const clean = String(nameOrEmail).trim();
  if (clean.includes("@")) return clean[0].toUpperCase();
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
  return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase() || "U";
}