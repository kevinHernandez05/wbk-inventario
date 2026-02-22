import { useEffect, useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";

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

function shortMoveId(type, id, created_at) {
  const base = String(id || "").slice(0, 4).toUpperCase();
  const d = created_at ? new Date(created_at) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const prefix = type === "in" ? "IN" : type === "out" ? "OUT" : "MOV";
  return `${prefix}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${base}`;
}

function typeLabel(type) {
  if (type === "in") return "Entrada";
  if (type === "out") return "Salida";
  if (type === "transfer") return "Transfer";
  return type || "—";
}

function badgeCls(type) {
  return type === "in"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-sky-200 bg-sky-50 text-sky-700";
}

function shortUser(u) {
  if (!u) return "—";
  const s = String(u);
  return s.length <= 10 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export default function Movements() {
  const { orgId, loadingOrg } = useOrg();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [moves, setMoves] = useState([]);

  useEffect(() => {
    if (!orgId) return;
    loadMoves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadMoves() {
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
        created_by,
        product:products(id,name,sku),
        warehouse:warehouses(id,name)
      `
      )
      .eq("org_id", orgId)
      .in("type", ["in", "out"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) console.error(error);

    const rows =
      (data || []).map((r) => ({
        id: shortMoveId(r.type, r.id, r.created_at),
        raw_id: r.id,
        date: fmtDate(r.created_at),
        type: typeLabel(r.type),
        type_raw: r.type,
        sku: r?.product?.sku || "—",
        product: r?.product?.name || "—",
        qty: Number(r.quantity || 0),
        qtySigned: r.type === "out" ? -Number(r.quantity || 0) : Number(r.quantity || 0),
        ref: r.reference || "—",
        user: shortUser(r.created_by),
        created_by: r.created_by || null,
      })) || [];

    setMoves(rows);
    setLoading(false);
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return moves;
    return moves.filter((m) =>
      [m.id, m.type, m.sku, m.product, m.ref, m.user, m.created_by].some((x) =>
        String(x || "").toLowerCase().includes(s)
      )
    );
  }, [q, moves]);

  return (
    <TableShell
      title="Movimientos"
      subtitle={loadingOrg || loading ? "Cargando historial..." : "Historial tipo Kardex: entradas/salidas/ajustes."}
      right={
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por producto, SKU, tipo, referencia..."
        />
      }
      actions={
        <button
          onClick={loadMoves}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          title="Refrescar"
        >
          Refrescar
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Fecha</th>
              <th className="text-left font-medium py-3 pr-4">Tipo</th>
              <th className="text-left font-medium py-3 pr-4">SKU</th>
              <th className="text-left font-medium py-3 pr-4">Producto</th>
              <th className="text-right font-medium py-3 pr-4">Cant.</th>
              <th className="text-left font-medium py-3 pr-4">Referencia</th>
              <th className="text-left font-medium py-3 pr-4">Usuario</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {(loadingOrg || loading) && (
              <tr>
                <td colSpan={8} className="py-6 pr-4 text-slate-600">
                  Cargando...
                </td>
              </tr>
            )}

            {!loadingOrg && !loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 pr-4 text-slate-600">
                  No hay movimientos todavía.
                </td>
              </tr>
            )}

            {!loadingOrg &&
              !loading &&
              rows.map((m) => (
                <tr key={m.raw_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-900">{m.id}</td>
                  <td className="py-3 pr-4 text-slate-600">{m.date}</td>

                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${badgeCls(
                        m.type_raw
                      )}`}
                    >
                      {m.type}
                    </span>
                  </td>

                  <td className="py-3 pr-4">{m.sku}</td>
                  <td className="py-3 pr-4">{m.product}</td>

                  <td
                    className={`py-3 pr-4 text-right font-semibold ${
                      m.qtySigned < 0 ? "text-sky-700" : "text-emerald-700"
                    }`}
                    title={m.qtySigned < 0 ? "Salida" : "Entrada"}
                  >
                    {m.qtySigned < 0 ? "−" : "+"}
                    {Math.abs(m.qty)}
                  </td>

                  <td className="py-3 pr-4 text-slate-600">{m.ref}</td>
                  <td className="py-3 pr-4 text-slate-600">{m.user}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}