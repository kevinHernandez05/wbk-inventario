import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";
import TableShell from "../ui/TableShell";

const cn = (...xs) => xs.filter(Boolean).join(" ");

export default function Warehouses() {
  const { orgId, loadingOrg } = useOrg();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    location: "",
    is_primary: false,
    active: true,
  });

  useEffect(() => {
    if (!orgId) return;
    load();
  }, [orgId]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (!error) setWarehouses(data || []);
    else console.error(error);

    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      location: "",
      is_primary: false,
      active: true,
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code || "",
      location: row.location || "",
      is_primary: row.is_primary,
      active: row.active,
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();

    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      code: form.code,
      location: form.location,
      is_primary: form.is_primary,
      active: form.active,
    };

    if (!payload.name) return alert("Nombre requerido");

    // Si marcamos uno como principal, quitamos el flag de los demás
    if (payload.is_primary) {
      await supabase
        .from("warehouses")
        .update({ is_primary: false })
        .eq("org_id", orgId);
    }

    if (!editing) {
      await supabase.from("warehouses").insert(payload);
    } else {
      await supabase
        .from("warehouses")
        .update(payload)
        .eq("id", editing.id);
    }

    setModalOpen(false);
    load();
  }

  return (
    <TableShell
      title="Almacenes"
      subtitle="Gestiona ubicaciones físicas de inventario"
      actions={
        <button
          onClick={openCreate}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Nuevo almacén
        </button>
      }
    >
      {loading || loadingOrg ? (
        <div className="text-sm text-slate-600">Cargando...</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 pr-4">Nombre</th>
                <th className="text-left py-3 pr-4">Código</th>
                <th className="text-left py-3 pr-4">Ubicación</th>
                <th className="text-left py-3 pr-4">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-3 pr-4 font-medium">
                    {w.name}
                    {w.is_primary && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                        Principal
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{w.code || "—"}</td>
                  <td className="py-3 pr-4 text-slate-600">
                    {w.location || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs border",
                        w.active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {w.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => openEdit(w)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editing ? "Editar almacén" : "Nuevo almacén"}
            </h3>

            <form onSubmit={save} className="space-y-4">
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 px-3"
                placeholder="Nombre"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
              />

              <input
                className="w-full h-11 rounded-2xl border border-slate-200 px-3"
                placeholder="Código interno"
                value={form.code}
                onChange={(e) =>
                  setForm((s) => ({ ...s, code: e.target.value }))
                }
              />

              <input
                className="w-full h-11 rounded-2xl border border-slate-200 px-3"
                placeholder="Ubicación"
                value={form.location}
                onChange={(e) =>
                  setForm((s) => ({ ...s, location: e.target.value }))
                }
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, is_primary: e.target.checked }))
                  }
                />
                Almacén principal
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, active: e.target.checked }))
                  }
                />
                Activo
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-2xl"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TableShell>
  );
}
