import { Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Movements from "./pages/Movements";

// placeholders rápidos (si aún no los creas)
const Placeholder = ({ title }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-6">
    <div className="text-sm text-slate-500">Inventario</div>
    <div className="text-2xl font-semibold text-slate-900">{title}</div>
    <div className="mt-2 text-slate-600">Pantalla en construcción (fake).</div>
  </div>
);

export default function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/movements" element={<Movements />} />

        {/* placeholders (creamos estas pages luego) */}
        <Route path="/categories" element={<Placeholder title="Categorías" />} />
        <Route path="/warehouses" element={<Placeholder title="Almacenes" />} />
        <Route path="/inbound" element={<Placeholder title="Entradas" />} />
        <Route path="/outbound" element={<Placeholder title="Salidas" />} />
        <Route path="/suppliers" element={<Placeholder title="Proveedores" />} />
        <Route path="/purchase-orders" element={<Placeholder title="Órdenes de compra" />} />
        <Route path="/reports" element={<Placeholder title="Reportes" />} />
        <Route path="/settings" element={<Placeholder title="Configuración" />} />

        {/* fallback */}
        <Route path="*" element={<Placeholder title="404" />} />
      </Routes>
    </MainLayout>
  );
}
