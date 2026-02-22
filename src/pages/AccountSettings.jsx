// src/pages/AccountSettings.jsx
import { useEffect, useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { KeyRound, User2, Mail, Save, LogOut } from "lucide-react";

const cn = (...xs) => xs.filter(Boolean).join(" ");

export default function AccountSettings() {
  const { user } = useAuth();

  const email = user?.email || "—";
  const userId = user?.id || null;

  const initialName = useMemo(() => {
    const md = user?.user_metadata || {};
    return md.full_name || md.name || (user?.email ? user.email.split("@")[0] : "");
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [profile, setProfile] = useState({
    displayName: initialName,
  });

  const [pwd, setPwd] = useState({
    next: "",
    confirm: "",
  });

  useEffect(() => {
    setProfile({ displayName: initialName });
  }, [initialName]);

  function toast(msg) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(""), 1400);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!userId) return;

    const name = String(profile.displayName || "").trim();
    if (!name) {
      toast("Pon un nombre válido");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    setLoading(false);

    if (error) {
      console.error(error);
      toast(error.message || "No se pudo guardar");
      return;
    }

    toast("Guardado ✅");
  }

  async function changePassword(e) {
    e.preventDefault();

    const next = String(pwd.next || "");
    const confirm = String(pwd.confirm || "");

    if (next.length < 8) {
      toast("La contraseña debe tener 8+ caracteres");
      return;
    }
    if (next !== confirm) {
      toast("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: next,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      toast(error.message || "No se pudo cambiar la contraseña");
      return;
    }

    setPwd({ next: "", confirm: "" });
    toast("Contraseña actualizada ✅");
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error cerrando sesión");
    }
  }

  return (
    <TableShell
      title="Ajustes de cuenta"
      subtitle="Configura tu perfil y seguridad. (MVP)"
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
        {/* Perfil */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader
            icon={User2}
            title="Perfil"
            right={savedMsg ? <span className="text-xs text-slate-500">{savedMsg}</span> : null}
          />

          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <Field label="Nombre para mostrar">
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                value={profile.displayName}
                onChange={(e) => setProfile((s) => ({ ...s, displayName: e.target.value }))}
                placeholder="Ej. Kevin"
              />
            </Field>

            <Field label="Email (solo lectura en MVP)">
              <div className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="truncate">{email}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Para cambiar el email en este MVP, contacta a un agente en <span className="font-medium">wbkrd.com</span>.
              </p>
            </Field>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "h-10 px-4 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800 inline-flex items-center gap-2",
                  loading && "opacity-60"
                )}
              >
                <Save className="h-4 w-4" />
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Card>

        {/* Seguridad */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader icon={KeyRound} title="Seguridad" />

          <form onSubmit={changePassword} className="mt-4 space-y-4">
            <Field label="Nueva contraseña">
              <input
                type="password"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                value={pwd.next}
                onChange={(e) => setPwd((s) => ({ ...s, next: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirmar contraseña">
              <input
                type="password"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                value={pwd.confirm}
                onChange={(e) => setPwd((s) => ({ ...s, confirm: e.target.value }))}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
            </Field>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Si olvidaste tu contraseña, en este MVP se maneja por soporte:{" "}
              <span className="font-medium text-slate-900">contacta a un agente en wbkrd.com</span>.
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "h-10 px-4 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800 inline-flex items-center gap-2",
                  loading && "opacity-60"
                )}
              >
                <KeyRound className="h-4 w-4" />
                {loading ? "Actualizando..." : "Cambiar contraseña"}
              </button>
            </div>
          </form>
        </Card>

        {/* Nota MVP */}
        <Card className="col-span-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Nota del MVP</div>
            <div className="mt-1 text-sm text-slate-600">
              Este módulo está pensado para controlar el acceso a data sensible. Por ahora, todo lo
              “administrativo” (crear usuarios, reset, cambios de email) se maneja manualmente por soporte.
            </div>
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

function Field({ label, children }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      {children}
    </div>
  );
}