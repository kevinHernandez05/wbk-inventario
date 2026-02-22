import { useEffect, useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function shortSupId(id) {
  const base = String(id || "").slice(0, 4).toUpperCase();
  return `SUP-${base}`;
}

export default function Suppliers() {
  const { orgId, loadingOrg } = useOrg();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);

  // modal (simple, create-only por ahora)
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    active: true,
  });

  useEffect(() => {
    if (!orgId) return;
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadSuppliers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("id,name,email,phone,active,created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) console.error(error);

    const rows =
      (data || []).map((s) => ({
        id: shortSupId(s.id),
        raw_id: s.id,
        name: s.name || "—",
        email: s.email || "—",
        phone: s.phone || "—",
        status: s.active ? "Activo" : "Inactivo",
        active: !!s.active,
      })) || [];

    setSuppliers(rows);
    setLoading(false);
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return suppliers;
    return suppliers.filter((x) =>
      [x.id, x.name, x.email, x.phone, x.status].some((v) =>
        String(v || "").toLowerCase().includes(s)
      )
    );
  }, [q, suppliers]);

  function openModal() {
    setForm({ name: "", email: "", phone: "", active: true });
    setModalOpen(true);
  }

  async function saveSupplier(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Nombre es requerido.");
      return;
    }

    setSaving(true);

    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      active: !!form.active,
    };

    const { error } = await supabase.from("suppliers").insert(payload);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "No se pudo crear el proveedor.");
      return;
    }

    setModalOpen(false);
    await loadSuppliers();
  }

  return (
    <TableShell
      title="Proveedores"
      subtitle={loadingOrg || loading ? "Cargando proveedores..." : "Lista de proveedores para compras y entradas."}
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar proveedor..." />}
      actions={
        <button
          onClick={openModal}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Nuevo proveedor
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Nombre</th>
              <th className="text-left font-medium py-3 pr-4">Email</th>
              <th className="text-left font-medium py-3 pr-4">Teléfono</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {(loadingOrg || loading) && (
              <tr>
                <td colSpan={5} className="py-6 pr-4 text-slate-600">
                  Cargando...
                </td>
              </tr>
            )}

            {!loadingOrg && !loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 pr-4 text-slate-600">
                  No hay proveedores todavía.
                </td>
              </tr>
            )}

            {!loadingOrg &&
              !loading &&
              rows.map((s) => (
                <tr key={s.raw_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-900">{s.id}</td>
                  <td className="py-3 pr-4">{s.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{s.email}</td>
                  <td className="py-3 pr-4 text-slate-600">{s.phone}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={s.active ? "ok" : "muted"}>{s.status}</Badge>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title="Nuevo proveedor" onClose={() => setModalOpen(false)}>
          <form onSubmit={saveSupplier} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Ej. Distribuidora Caribe"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="ventas@proveedor.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="809-555-0000"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))}
              />
              Activo
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-10 px-4 rounded-2xl border border-slate-200 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  "h-10 px-4 rounded-2xl bg-slate-900 text-white text-sm font-medium",
                  saving && "opacity-60"
                )}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </TableShell>
  );
}

function Badge({ children, tone = "ok" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>{children}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}