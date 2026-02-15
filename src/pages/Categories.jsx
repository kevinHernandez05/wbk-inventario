import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeCategories = [
  { id: "CAT-001", name: "Bebidas", products: 24, status: "Activa" },
  { id: "CAT-002", name: "Snacks", products: 18, status: "Activa" },
  { id: "CAT-003", name: "Panadería", products: 9, status: "Activa" },
  { id: "CAT-004", name: "Lácteos", products: 12, status: "Activa" },
  { id: "CAT-005", name: "Limpieza", products: 7, status: "Inactiva" },
];

export default function Categories() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeCategories;
    return fakeCategories.filter((c) =>
      [c.id, c.name, c.status].some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Categorías"
      subtitle="Organiza tus productos por categoría. (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar categoría..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Nueva categoría
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Nombre</th>
              <th className="text-right font-medium py-3 pr-4">Productos</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{c.id}</td>
                <td className="py-3 pr-4">{c.name}</td>
                <td className="py-3 pr-4 text-right font-semibold">{c.products}</td>
                <td className="py-3 pr-4">
                  <Badge tone={c.status === "Activa" ? "ok" : "muted"}>
                    {c.status}
                  </Badge>
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

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>
      {children}
    </span>
  );
}
