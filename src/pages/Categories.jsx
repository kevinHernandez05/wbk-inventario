import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";
import TableShell from "../ui/TableShell";

const cn = (...xs) => xs.filter(Boolean).join(" ");

export default function Categories() {
  const { orgId, loadingOrg } = useOrg();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    if (!orgId) return;
    load();
  }, [orgId]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (!error) setCategories(data || []);
    else console.error(error);

    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", active: true });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name,
      description: row.description || "",
      active: row.active,
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();

    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      description: form.description,
      active: form.active,
    };

    if (!payload.name) return alert("Nombre requerido");

    if (!editing) {
      await supabase.from("categories").insert(payload);
    } else {
      await supabase
        .from("categories")
        .update(payload)
        .eq("id", editing.id);
    }

    setModalOpen(false);
    load();
  }

  return (
    <TableShell
      title="Categorías"
      subtitle="Organiza tus productos por categoría"
      actions={
        <button
          onClick={openCreate}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Nueva categoría
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
                <th className="text-left py-3 pr-4">Descripción</th>
                <th className="text-left py-3 pr-4">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-3 pr-4 font-medium">{c.name}</td>
                  <td className="py-3 pr-4 text-slate-600">
                    {c.description || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs border",
                        c.active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {c.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => openEdit(c)}
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
              {editing ? "Editar categoría" : "Nueva categoría"}
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

              <textarea
                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                placeholder="Descripción"
                value={form.description}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, active: e.target.checked }))
                  }
                />
                Activa
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
