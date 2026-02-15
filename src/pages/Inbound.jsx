import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeInbound = [
  { id: "IN-2001", date: "2026-02-12 09:10", sku: "CC-355", product: "Coca-Cola 355ml", qty: 60, source: "Proveedor", ref: "OC-9001" },
  { id: "IN-2002", date: "2026-02-12 10:45", sku: "LE-1L", product: "Leche Entera 1L", qty: 24, source: "Ajuste +", ref: "AJUSTE+" },
];

export default function Inbound() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeInbound;
    return fakeInbound.filter((m) =>
      [m.id, m.sku, m.product, m.source, m.ref].some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Entradas"
      subtitle="Compras, devoluciones y ajustes positivos. (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar entrada..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Registrar entrada
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
              <th className="text-left font-medium py-3 pr-4">Origen</th>
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
                  <Badge tone="ok">{m.source}</Badge>
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

function Badge({ children, tone = "ok" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>{children}</span>;
}
