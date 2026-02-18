import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";
import { useOrg } from "../org/OrgProvider";

const cn = (...xs) => xs.filter(Boolean).join(" ");

export default function Products() {
  const { orgId, loadingOrg } = useOrg();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // product row or null

  const [form, setForm] = useState({
    sku: "",
    name: "",
    category_id: "",
    unit: "unit",
    cost: 0,
    price: 0,
    discount_percent: 0,
    tax_percent: 0,
    min_stock: 0,
    barcode: "",
    description: "",
    image_url: "",
    active: true,
  });

  // ---------- Load ----------
  useEffect(() => {
    if (loadingOrg) return;
    if (!orgId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingOrg, orgId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [catsRes, prodsRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name")
          .eq("org_id", orgId)
          .eq("active", true)
          .order("name", { ascending: true }),

        supabase
          .from("products")
          .select(
            `
            id, org_id, sku, name, unit, cost, price, discount_percent, tax_percent, min_stock,
            barcode, description, image_url, active, category_id,
            categories:category_id ( id, name )
          `,
          )
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
      ]);

      if (catsRes.error) throw catsRes.error;
      if (prodsRes.error) throw prodsRes.error;

      setCategories(catsRes.data || []);
      setProducts(prodsRes.data || []);
    } catch (e) {
      console.error(e);
      alert(e.message || "Error cargando productos");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Search ----------
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      [p.sku, p.name, p.barcode, p?.categories?.name]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s)),
    );
  }, [q, products]);

  // ---------- Modal helpers ----------
  function openCreate() {
    setEditing(null);
    setForm({
      sku: "",
      name: "",
      category_id: categories?.[0]?.id || "",
      unit: "unit",
      cost: 0,
      price: 0,
      discount_percent: 0,
      tax_percent: 0,
      min_stock: 0,
      barcode: "",
      description: "",
      image_url: "",
      active: true,
    });
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      sku: p.sku || "",
      name: p.name || "",
      category_id: p.category_id || "",
      unit: p.unit || "unit",
      cost: Number(p.cost || 0),
      price: Number(p.price || 0),
      discount_percent: Number(p.discount_percent || 0),
      tax_percent: Number(p.tax_percent || 0),
      min_stock: Number(p.min_stock || 0),
      barcode: p.barcode || "",
      description: p.description || "",
      image_url: p.image_url || "",
      active: !!p.active,
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  // ---------- Save ----------
  async function saveProduct(e) {
    e?.preventDefault?.();
    if (!orgId) return;

    const payload = {
      org_id: orgId,
      sku: String(form.sku || "").trim(),
      name: String(form.name || "").trim(),
      category_id: form.category_id || null,
      unit: String(form.unit || "unit").trim(),
      cost: Number(form.cost || 0),
      price: Number(form.price || 0),
      discount_percent: Number(form.discount_percent || 0),
      tax_percent: Number(form.tax_percent || 0),
      min_stock: Number(form.min_stock || 0),
      barcode: form.barcode ? String(form.barcode).trim() : null,
      description: form.description ? String(form.description).trim() : null,
      image_url: form.image_url ? String(form.image_url).trim() : null,
      active: !!form.active,
    };

    // Validaciones mínimas
    if (!payload.sku) return alert("SKU es requerido");
    if (!payload.name) return alert("Nombre es requerido");
    if (payload.discount_percent < 0 || payload.discount_percent > 100)
      return alert("Descuento debe ser 0-100");
    if (payload.tax_percent < 0 || payload.tax_percent > 100)
      return alert("Impuesto debe ser 0-100");

    setSaving(true);
    try {
      if (!editing) {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id)
          .eq("org_id", orgId);
        if (error) throw error;
      }

      setModalOpen(false);
      await loadAll();
    } catch (e) {
      console.error(e);
      alert(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI ----------
  return (
    <TableShell
      title="Productos"
      subtitle="Crea, edita y organiza productos. Ya conectado a Supabase ✅"
      right={
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por SKU, nombre, categoría, barcode..."
        />
      }
      actions={
        <button
          onClick={openCreate}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Nuevo producto
        </button>
      }
    >
      {loading || loadingOrg ? (
        <div className="text-sm text-slate-600">Cargando...</div>
      ) : rows.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left font-medium py-3 pr-4">SKU</th>
                <th className="text-left font-medium py-3 pr-4">Producto</th>
                <th className="text-left font-medium py-3 pr-4">Categoría</th>
                <th className="text-right font-medium py-3 pr-4">Precio</th>
                <th className="text-right font-medium py-3 pr-4">Desc.</th>
                <th className="text-right font-medium py-3 pr-4">Costo</th>
                <th className="text-right font-medium py-3 pr-4">Min</th>
                <th className="text-left font-medium py-3 pr-4">Estado</th>
                <th className="text-right font-medium py-3 pr-2"></th>
              </tr>
            </thead>

            <tbody className="text-slate-800">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-3 pr-4 font-medium text-slate-900">
                    {p.sku}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{p.name}</div>
                    {p.barcode ? (
                      <div className="text-xs text-slate-500">
                        Barcode: {p.barcode}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{p?.categories?.name || "—"}</td>
                  <td className="py-3 pr-4 text-right">
                    ${Number(p.price || 0).toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {Number(p.discount_percent || 0).toFixed(2)}%
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    ${Number(p.cost || 0).toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    {Number(p.min_stock || 0).toFixed(0)}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={p.active ? "ok" : "muted"}>
                      {p.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-lg">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">Productos</div>
                <div className="text-lg font-semibold text-slate-900">
                  {editing ? "Editar producto" : "Nuevo producto"}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="h-10 w-10 rounded-2xl hover:bg-slate-100 text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveProduct} className="p-5 space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <Field className="col-span-12 md:col-span-4" label="SKU *">
                  <Input
                    value={form.sku}
                    onChange={(v) => setForm((s) => ({ ...s, sku: v }))}
                  />
                </Field>

                <Field className="col-span-12 md:col-span-8" label="Nombre *">
                  <Input
                    value={form.name}
                    onChange={(v) => setForm((s) => ({ ...s, name: v }))}
                  />
                </Field>

                <Field className="col-span-12 md:col-span-6" label="Categoría">
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    value={form.category_id}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, category_id: e.target.value }))
                    }
                  >
                    <option value="">— Sin categoría —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field className="col-span-12 md:col-span-6" label="Unidad">
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, unit: e.target.value }))
                    }
                  >
                    <option value="unit">unit</option>
                    <option value="kg">kg</option>
                    <option value="lt">lt</option>
                    <option value="box">box</option>
                  </select>
                </Field>

                <Field className="col-span-12 md:col-span-4" label="Costo">
                  <Input
                    type="number"
                    value={form.cost}
                    onChange={(v) => setForm((s) => ({ ...s, cost: v }))}
                  />
                </Field>

                <Field className="col-span-12 md:col-span-4" label="Precio">
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(v) => setForm((s) => ({ ...s, price: v }))}
                  />
                </Field>

                <Field
                  className="col-span-12 md:col-span-4"
                  label="Descuento %"
                >
                  <Input
                    type="number"
                    value={form.discount_percent}
                    onChange={(v) =>
                      setForm((s) => ({ ...s, discount_percent: v }))
                    }
                  />
                </Field>

                <Field className="col-span-12 md:col-span-4" label="Impuesto %">
                  <Input
                    type="number"
                    value={form.tax_percent}
                    onChange={(v) => setForm((s) => ({ ...s, tax_percent: v }))}
                  />
                </Field>

                <Field
                  className="col-span-12 md:col-span-4"
                  label="Stock mínimo"
                >
                  <Input
                    type="number"
                    value={form.min_stock}
                    onChange={(v) => setForm((s) => ({ ...s, min_stock: v }))}
                  />
                </Field>

                <Field className="col-span-12 md:col-span-4" label="Barcode">
                  <Input
                    value={form.barcode}
                    onChange={(v) => setForm((s) => ({ ...s, barcode: v }))}
                  />
                </Field>

                <Field className="col-span-12" label="Descripción">
                  <textarea
                    className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    value={form.description}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, description: e.target.value }))
                    }
                  />
                </Field>

                <Field className="col-span-12" label="Image URL">
                  <Input
                    value={form.image_url}
                    onChange={(v) => setForm((s) => ({ ...s, image_url: v }))}
                  />
                </Field>

                <div className="col-span-12">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.active}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, active: e.target.checked }))
                      }
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        Activo
                      </div>
                      <div className="text-sm text-slate-600">
                        Se muestra/usa en operaciones y POS.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TableShell>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
      <div className="text-lg font-semibold text-slate-900">
        No hay productos
      </div>
      <div className="text-slate-600 mt-2">
        Crea tu primer producto para comenzar.
      </div>
      <button
        onClick={onCreate}
        className="mt-5 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Nuevo producto
      </button>
    </div>
  );
}

function Field({ label, className, children }) {
  return (
    <div className={className}>
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text" }) {
  return (
    <input
      type={type}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Badge({ children, tone = "ok" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs border",
        cls,
      )}
    >
      {children}
    </span>
  );
}
