import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeOutbound = [
  { id: "OUT-3001", date: "2026-02-12 11:05", sku: "PB-001", product: "Pan Bimbo", qty: 10, reason: "Venta", ref: "VENTA" },
  { id: "OUT-3002", date: "2026-02-12 12:18", sku: "LY-100", product: "Papas Lays", qty: 8, reason: "Venta", ref: "VENTA" },
  { id: "OUT-3003", date: "2026-02-12 14:22", sku: "AG-500", product: "Agua 500ml", qty: 6, reason: "Merma", ref: "MERMA" },
];

export default function Outbound() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeOutbound;
    return fakeOutbound.filter((m) =>
      [m.id, m.sku, m.product, m.reason, m.ref].some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Salidas"
      subtitle="Ventas, mermas y ajustes negativos. (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar salida..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Registrar salida
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Fecha</th>
              <th className="text-left font-medium py-3 pr-4">SKU</th>
              <th className="text-left font-medium py-3 pr-4">Producto</th>
              <th className="text-right font-medium py-3 pr-4">Cant.</th>
              <th className="text-left font-medium py-3 pr-4">Motivo</th>
              <th className="text-left font-medium py-3 pr-4">Referencia</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{m.id}</td>
                <td className="py-3 pr-4 text-slate-600">{m.date}</td>
                <td className="py-3 pr-4">{m.sku}</td>
                <td className="py-3 pr-4">{m.product}</td>
                <td className="py-3 pr-4 text-right font-semibold">{m.qty}</td>
                <td className="py-3 pr-4">
                  <Badge tone={m.reason === "Venta" ? "info" : "warn"}>{m.reason}</Badge>
                </td>
                <td className="py-3 pr-4 text-slate-600">{m.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}

function Badge({ children, tone = "info" }) {
  const cls =
    tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-orange-200 bg-orange-50 text-orange-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>{children}</span>;
}
