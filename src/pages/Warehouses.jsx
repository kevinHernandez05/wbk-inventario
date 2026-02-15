import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeWarehouses = [
  { id: "WH-001", name: "Almacén Principal", location: "Santo Domingo", bins: 12, status: "Activo" },
  { id: "WH-002", name: "Sucursal Naco", location: "Distrito Nacional", bins: 8, status: "Activo" },
  { id: "WH-003", name: "Backroom", location: "Zona Colonial", bins: 5, status: "Activo" },
  { id: "WH-004", name: "Depósito Temporal", location: "Bávaro", bins: 3, status: "Inactivo" },
];

export default function Warehouses() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeWarehouses;
    return fakeWarehouses.filter((w) =>
      [w.id, w.name, w.location, w.status].some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Almacenes"
      subtitle="Ubicaciones donde vives el inventario (puedes empezar con 1). (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar almacén..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Nuevo almacén
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Nombre</th>
              <th className="text-left font-medium py-3 pr-4">Ubicación</th>
              <th className="text-right font-medium py-3 pr-4">Bins</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{w.id}</td>
                <td className="py-3 pr-4">{w.name}</td>
                <td className="py-3 pr-4 text-slate-600">{w.location}</td>
                <td className="py-3 pr-4 text-right font-semibold">{w.bins}</td>
                <td className="py-3 pr-4">
                  <Badge tone={w.status === "Activo" ? "ok" : "muted"}>{w.status}</Badge>
                </td>
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
