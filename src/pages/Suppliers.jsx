import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeSuppliers = [
  { id: "SUP-001", name: "Distribuidora Caribe", email: "ventas@caribe.do", phone: "809-555-1200", status: "Activo" },
  { id: "SUP-002", name: "MegaSupply RD", email: "hola@megasupply.do", phone: "829-555-4433", status: "Activo" },
  { id: "SUP-003", name: "Importadora Norte", email: "contacto@norte.do", phone: "849-555-9001", status: "Inactivo" },
];

export default function Suppliers() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeSuppliers;
    return fakeSuppliers.filter((x) =>
      [x.id, x.name, x.email, x.phone, x.status].some((v) => String(v).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Proveedores"
      subtitle="Lista de proveedores para compras y entradas. (Fake)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar proveedor..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Nuevo proveedor
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">ID</th>
              <th className="text-left font-medium py-3 pr-4">Nombre</th>
              <th className="text-left font-medium py-3 pr-4">Email</th>
              <th className="text-left font-medium py-3 pr-4">Teléfono</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{s.id}</td>
                <td className="py-3 pr-4">{s.name}</td>
                <td className="py-3 pr-4 text-slate-600">{s.email}</td>
                <td className="py-3 pr-4 text-slate-600">{s.phone}</td>
                <td className="py-3 pr-4">
                  <Badge tone={s.status === "Activo" ? "ok" : "muted"}>{s.status}</Badge>
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
