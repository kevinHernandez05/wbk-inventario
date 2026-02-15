import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakePO = [
  { id: "OC-9001", date: "2026-02-12", supplier: "Distribuidora Caribe", total: 12850, status: "Recibida" },
  { id: "OC-9002", date: "2026-02-10", supplier: "MegaSupply RD", total: 7420, status: "Enviada" },
  { id: "OC-9003", date: "2026-02-08", supplier: "Importadora Norte", total: 3190, status: "Borrador" },
];

export default function PurchaseOrders() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakePO;
    return fakePO.filter((x) =>
      [x.id, x.date, x.supplier, x.status].some((v) => String(v).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Órdenes de compra"
      subtitle="Flujo simple: borrador → enviada → recibida. (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar orden..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Nueva orden
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Fecha</th>
              <th className="text-left font-medium py-3 pr-4">Proveedor</th>
              <th className="text-right font-medium py-3 pr-4">Total</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{o.id}</td>
                <td className="py-3 pr-4 text-slate-600">{o.date}</td>
                <td className="py-3 pr-4">{o.supplier}</td>
                <td className="py-3 pr-4 text-right font-semibold">${o.total.toLocaleString()}</td>
                <td className="py-3 pr-4">
                  <Badge tone={tone(o.status)}>{o.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}

function tone(status) {
  if (status === "Recibida") return "ok";
  if (status === "Enviada") return "info";
  return "muted";
}

function Badge({ children, tone = "ok" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>{children}</span>;
}
