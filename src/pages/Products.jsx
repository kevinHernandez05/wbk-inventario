import { useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import SearchInput from "../ui/SearchInput";

const fakeProducts = [
  { sku: "CC-355", name: "Coca-Cola 355ml", category: "Bebidas", cost: 20, price: 35, stock: 420, min: 50 },
  { sku: "AG-500", name: "Agua 500ml", category: "Bebidas", cost: 10, price: 20, stock: 380, min: 60 },
  { sku: "LY-100", name: "Papas Lays", category: "Snacks", cost: 25, price: 45, stock: 310, min: 40 },
  { sku: "PB-001", name: "Pan Bimbo", category: "Panadería", cost: 55, price: 85, stock: 35, min: 50 },
  { sku: "LE-1L", name: "Leche Entera 1L", category: "Lácteos", cost: 60, price: 95, stock: 120, min: 30 },
];

export default function Products() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fakeProducts;
    return fakeProducts.filter((p) =>
      [p.sku, p.name, p.category].some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <TableShell
      title="Productos"
      subtitle="Crea, edita y organiza tus productos. (Fake por ahora)"
      right={<SearchInput value={q} onChange={setQ} placeholder="Buscar por SKU, nombre, categoría..." />}
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Nuevo producto
        </button>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium py-3 pr-4">SKU</th>
              <th className="text-left font-medium py-3 pr-4">Producto</th>
              <th className="text-left font-medium py-3 pr-4">Categoría</th>
              <th className="text-right font-medium py-3 pr-4">Costo</th>
              <th className="text-right font-medium py-3 pr-4">Precio</th>
              <th className="text-right font-medium py-3 pr-4">Stock</th>
              <th className="text-left font-medium py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((p) => {
              const low = p.stock < p.min;
              return (
                <tr key={p.sku} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-900">{p.sku}</td>
                  <td className="py-3 pr-4">{p.name}</td>
                  <td className="py-3 pr-4">{p.category}</td>
                  <td className="py-3 pr-4 text-right">${p.cost}</td>
                  <td className="py-3 pr-4 text-right">${p.price}</td>
                  <td className="py-3 pr-4 text-right">{p.stock}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${
                      low ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}>
                      {low ? "Bajo stock" : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}
