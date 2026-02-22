import { useEffect, useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function money(n) {
  try {
    return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(n || 0));
  } catch {
    return `RD$ ${Number(n || 0)}`;
  }
}

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

function shortPOId(id, created_at) {
  const base = String(id || "").slice(0, 4).toUpperCase();
  const d = created_at ? new Date(created_at) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `PO-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${base}`;
}

function statusLabel(s) {
  const x = String(s || "");
  if (x === "draft") return "Borrador";
  if (x === "sent") return "Enviada";
  if (x === "received") return "Recibida";
  if (x === "cancelled") return "Cancelada";
  return x || "—";
}

function statusValue(ui) {
  if (ui === "Borrador") return "draft";
  if (ui === "Enviada") return "sent";
  if (ui === "Recibida") return "received";
  if (ui === "Cancelada") return "cancelled";
  return "draft";
}

export default function PurchaseOrders() {
  const { orgId, loadingOrg } = useOrg();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Todos");

  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState([]);

  const [suppliers, setSuppliers] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    reference: "",
    status: "Borrador",
  });

  useEffect(() => {
    if (!orgId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadAll() {
    await Promise.all([loadSuppliers(), loadPOs()]);
  }

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id,name,active,created_at")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("name");

    if (error) console.error(error);
    setSuppliers(data || []);
  }

  async function loadPOs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("purchase_orders")
      .select(
        `
        id,
        created_at,
        status,
        reference,
        supplier: suppliers(id,name)
      `
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) console.error(error);

    const rows =
      (data || []).map((po) => ({
        raw_id: po.id,
        id: shortPOId(po.id, po.created_at),
        date: fmtDate(po.created_at),
        supplier: po?.supplier?.name || "—",
        status: statusLabel(po.status),
        status_raw: po.status,
        ref: po.reference || "—",
        items: "—", // placeholder hasta que agreguemos items
        total: "—", // placeholder hasta que agreguemos costos
      })) || [];

    setPos(rows);
    setLoading(false);
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let data = pos;

    if (status !== "Todos") {
      data = data.filter((x) => x.status === status);
    }

    if (!s) return data;

    return data.filter((x) =>
      [x.id, x.supplier, x.status, x.ref].some((v) => String(v || "").toLowerCase().includes(s))
    );
  }, [q, status, pos]);

  function openModal() {
    setForm({
      supplier_id: "",
      reference: "",
      status: "Borrador",
    });
    setModalOpen(true);
  }

  async function savePO(e) {
    e.preventDefault();
    if (!form.supplier_id) {
      alert("Selecciona un proveedor.");
      return;
    }

    setSaving(true);

    const userRes = await supabase.auth.getUser();
    const userId = userRes?.data?.user?.id || null;

    const payload = {
      org_id: orgId,
      supplier_id: form.supplier_id,
      reference: form.reference.trim() || null,
      status: statusValue(form.status),
      created_by: userId,
    };

    const { error } = await supabase.from("purchase_orders").insert(payload);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "No se pudo crear la orden.");
      return;
    }

    setModalOpen(false);
    await loadPOs();
  }

  return (
    <TableShell
      title="Órdenes de compra"
      subtitle={loadingOrg || loading ? "Cargando órdenes..." : "Flujo de compras: borrador → enviada → recibida."}
      right={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="text-slate-500">Estado</span>
            <select
              className="bg-transparent outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>Todos</option>
              <option>Borrador</option>
              <option>Enviada</option>
              <option>Recibida</option>
              <option>Cancelada</option>
            </select>
          </div>

          <SearchInput value={q} onChange={setQ} placeholder="Buscar por proveedor, estado, referencia..." />
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={loadPOs}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Refrescar
          </button>
          <button
            onClick={openModal}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Nueva orden
          </button>
        </div>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Fecha</th>
              <th className="text-left font-medium py-3 pr-4">Proveedor</th>
              <th className="text-right font-medium py-3 pr-4">Items</th>
              <th className="text-right font-medium py-3 pr-4">Total</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
              <th className="text-left font-medium py-3 pr-4">Referencia</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {(loadingOrg || loading) && (
              <tr>
                <td colSpan={7} className="py-6 pr-4 text-slate-600">
                  Cargando...
                </td>
              </tr>
            )}

            {!loadingOrg && !loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 pr-4 text-slate-600">
                  No hay órdenes todavía.
                </td>
              </tr>
            )}

            {!loadingOrg &&
              !loading &&
              rows.map((po) => (
                <tr key={po.raw_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-900">{po.id}</td>
                  <td className="py-3 pr-4 text-slate-600">{po.date}</td>
                  <td className="py-3 pr-4">{po.supplier}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-slate-700">{po.items}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-slate-700">{po.total}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge>{po.status}</StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{po.ref}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title="Nueva orden de compra" onClose={() => setModalOpen(false)}>
          <form onSubmit={savePO} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Proveedor <span className="text-red-500">*</span>
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                value={form.supplier_id}
                onChange={(e) => setForm((s) => ({ ...s, supplier_id: e.target.value }))}
                required
              >
                <option value="">Seleccionar proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Referencia</label>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.reference}
                  onChange={(e) => setForm((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="OC-9004"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Estado</label>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-slate-200"
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                >
                  <option>Borrador</option>
                  <option>Enviada</option>
                  <option>Recibida</option>
                  <option>Cancelada</option>
                </select>
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
    </TableShell>
  );
}

function StatusBadge({ children }) {
  const s = String(children || "");
  const cls =
    s === "Borrador"
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : s === "Enviada"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : s === "Recibida"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>
      {children}
    </span>
  );
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