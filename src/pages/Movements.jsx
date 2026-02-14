import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeMoves = [
  { id: "M-1001", date: "2026-02-12 10:22", type: "Entrada", sku: "CC-355", product: "Coca-Cola 355ml", qty: 60, ref: "OC-9001", user: "Kevin" },
  { id: "M-1002", date: "2026-02-12 11:05", type: "Salida", sku: "PB-001", product: "Pan Bimbo", qty: 10, ref: "VENTA", user: "Kevin" },
  { id: "M-1003", date: "2026-02-12 12:18", type: "Salida", sku: "LY-100", product: "Papas Lays", qty: 8, ref: "VENTA", user: "Kevin" },
  { id: "M-1004", date: "2026-02-12 13:40", type: "Entrada", sku: "LE-1L", product: "Leche Entera 1L", qty: 24, ref: "AJUSTE+", user: "Kevin" },
];

export default function Movements() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeMoves;
    return fakeMoves.filter((m) =>
      [m.id, m.type, m.sku, m.product, m.ref, m.user].some((x) =>
        String(x).toLowerCase().includes(s)
      )
    );
  }, [q]);

  return (
    <TableShell
      title="Movimientos"
      subtitle="Historial tipo Kardex: entradas/salidas/ajustes. (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar por producto, SKU, tipo, referencia..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Nuevo movimiento
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
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{m.id}</td>
                <td className="py-3 pr-4 text-slate-600">{m.date}</td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${
                    m.type === "Entrada"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-sky-200 bg-sky-50 text-sky-700"
                  }`}>
                    {m.type}
                  </span>
                </td>
                <td className="py-3 pr-4">{m.sku}</td>
                <td className="py-3 pr-4">{m.product}</td>
                <td className="py-3 pr-4 text-right font-semibold">{m.qty}</td>
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
