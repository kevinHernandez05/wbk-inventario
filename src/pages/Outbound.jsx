import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";
import { Search } from "lucide-react";

const cn = (...xs) => xs.filter(Boolean).join(" ");

const OUT_REFERENCE_PRESETS = [
  { label: "Venta (VENTA)", value: "VENTA" },
  { label: "Merma (MERMA)", value: "MERMA" },
  { label: "Ajuste -", value: "AJUSTE-" },
  { label: "Devolución a proveedor", value: "DEV-PROV" },
  { label: "Transferencia enviada", value: "TR-OUT" },
  { label: "Otro (manual)", value: "" },
];

const REASON_TONES = {
  VENTA: "info",
  MERMA: "warn",
  "AJUSTE-": "warn",
  "DEV-PROV": "info",
  "TR-OUT": "info",
};

function fmtDate(ts) {
  try {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return ts;
  }
}

function shortOutId(id, created_at) {
  const base = String(id || "").slice(0, 4).toUpperCase();
  const d = created_at ? new Date(created_at) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `OUT-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${base}`;
}

export default function Outbound() {
  const { orgId, loadingOrg } = useOrg();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // modal pickers
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: "",
    reason: "Venta",
    referencePreset: "VENTA",
    reference: "VENTA",
    notes: "",
  });

  useEffect(() => {
    if (!orgId) return;
    loadRows();
    loadPickers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadPickers() {
    const [{ data: p }, { data: w }] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,sku")
        .eq("org_id", orgId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("warehouses")
        .select("id,name")
        .eq("org_id", orgId)
        .eq("active", true)
        .order("name"),
    ]);

    setProducts(p || []);
    setWarehouses(w || []);
  }

  async function loadRows() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventory_movements")
      .select(
        `
        id,
        created_at,
        type,
        quantity,
        reference,
        notes,
        product:products(id,name,sku),
        warehouse:warehouses(id,name)
      `
      )
      .eq("org_id", orgId)
      .eq("type", "out")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) console.error(error);
    setRows(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const sku = (r?.product?.sku || "").toLowerCase();
      const name = (r?.product?.name || "").toLowerCase();
      const ref = (r?.reference || "").toLowerCase();
      const wh = (r?.warehouse?.name || "").toLowerCase();
      const notes = (r?.notes || "").toLowerCase();
      return (
        sku.includes(s) ||
        name.includes(s) ||
        ref.includes(s) ||
        wh.includes(s) ||
        notes.includes(s) ||
        shortOutId(r.id, r.created_at).toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  function openModal() {
    setForm({
      product_id: "",
      warehouse_id: "",
      quantity: "",
      reason: "Venta",
      referencePreset: "VENTA",
      reference: "VENTA",
      notes: "",
    });
    setModalOpen(true);
  }

  async function saveOutbound(e) {
    e.preventDefault();

    if (!form.product_id || !form.warehouse_id || !form.quantity) {
      alert("Completa producto, almacén y cantidad.");
      return;
    }

    setSaving(true);

    const userRes = await supabase.auth.getUser();
    const userId = userRes?.data?.user?.id || null;

    // Guardamos "Motivo" dentro de notes por ahora (sin tocar DB)
    const mergedNotes = [
      form.reason ? `Motivo: ${form.reason}` : null,
      form.notes ? form.notes : null,
    ]
      .filter(Boolean)
      .join("\n");

    const cleanRef = (form.reference || "").trim();

    const { error } = await supabase.from("inventory_movements").insert({
      org_id: orgId,
      product_id: form.product_id,
      warehouse_id: form.warehouse_id,
      type: "out",
      quantity: Number(form.quantity),
      reference: cleanRef ? cleanRef : null,
      notes: mergedNotes || null,
      created_by: userId,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "No se pudo registrar la salida.");
      return;
    }

    setModalOpen(false);
    await loadRows();
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">Inventario</div>
          <h1 className="text-2xl font-semibold text-slate-900">Salidas</h1>
          <p className="mt-1 text-sm text-slate-600">Ventas, mermas y ajustes negativos.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="h-10 w-[320px] rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Buscar salida..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button
            onClick={openModal}
            className="h-10 px-4 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800"
          >
            Registrar salida
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-medium text-slate-900">Últimas salidas</div>
          <div className="text-xs text-slate-500">Mostrando {Math.min(50, rows.length)} registros</div>
        </div>

        {loadingOrg || loading ? (
          <div className="p-6 text-sm text-slate-600">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No hay salidas todavía.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-5">ID</th>
                  <th className="text-left py-3 px-5">Fecha</th>
                  <th className="text-left py-3 px-5">SKU</th>
                  <th className="text-left py-3 px-5">Producto</th>
                  <th className="text-right py-3 px-5">Cant.</th>
                  <th className="text-left py-3 px-5">Motivo</th>
                  <th className="text-left py-3 px-5">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const reason = extractMeta(r.notes, "Motivo") || "—";
                  const tone = REASON_TONES[r.reference] || (reason === "Venta" ? "info" : "warn");
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 px-5 font-semibold text-slate-900">
                        {shortOutId(r.id, r.created_at)}
                      </td>
                      <td className="py-3 px-5 text-slate-700">{fmtDate(r.created_at)}</td>
                      <td className="py-3 px-5 text-slate-700">{r?.product?.sku || "—"}</td>
                      <td className="py-3 px-5 text-slate-900">{r?.product?.name || "—"}</td>
                      <td className="py-3 px-5 text-right font-semibold text-slate-900">
                        {Number(r.quantity || 0)}
                      </td>
                      <td className="py-3 px-5">
                        <Badge tone={tone}>{reason}</Badge>
                      </td>
                      <td className="py-3 px-5 text-slate-700">{r.reference || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title="Registrar salida" onClose={() => setModalOpen(false)}>
          <form onSubmit={saveOutbound} className="space-y-4">
            <div className="space-y-4">
              {/* Producto */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Producto <span className="text-red-500">*</span>
                </label>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.product_id}
                  onChange={(e) => setForm((s) => ({ ...s, product_id: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Almacén */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Almacén <span className="text-red-500">*</span>
                </label>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.warehouse_id}
                  onChange={(e) => setForm((s) => ({ ...s, warehouse_id: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar almacén</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cantidad + Motivo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                    value={form.quantity}
                    onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Motivo</label>
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                    value={form.reason}
                    onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
                    placeholder="Venta, Merma, Ajuste..."
                  />
                </div>
              </div>

              {/* Referencias */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Tipo de referencia</label>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.referencePreset}
                  onChange={(e) => {
                    const preset = e.target.value;
                    setForm((s) => ({
                      ...s,
                      referencePreset: preset,
                      reference: preset,
                    }));
                  }}
                >
                  {OUT_REFERENCE_PRESETS.map((p) => (
                    <option key={p.label} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Referencia</label>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.reference}
                  onChange={(e) => setForm((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="Ej. VENTA-9001"
                />
              </div>

              {/* Notas */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Notas</label>
                <textarea
                  className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
            </div>

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
    </div>
  );
}

function Badge({ children, tone = "info" }) {
  const cls =
    tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-orange-200 bg-orange-50 text-orange-700";
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

// lee "Motivo: X" de notes
function extractMeta(notes, key) {
  if (!notes) return "";
  const lines = String(notes).split("\n");
  const match = lines.find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  if (!match) return "";
  return match.split(":").slice(1).join(":").trim();
}