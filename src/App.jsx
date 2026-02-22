import { Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";

//Auth
import Auth from "./pages/Auth";
import RequireAuth from "./auth/RequireAuth";

// Org
import { OrgProvider } from "./org/OrgProvider";

// Profile & settings
import Profile from "./pages/Profile";
import AccountSettings from "./pages/AccountSettings";
import Alerts from "./pages/Alerts";

// Pages
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Movements from "./pages/Movements";
import Categories from "./pages/Categories";
import Warehouses from "./pages/Warehouses";
import Inbound from "./pages/Inbound";
import Outbound from "./pages/Outbound";
import Suppliers from "./pages/Suppliers";
import PurchaseOrders from "./pages/PurchaseOrders";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

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
    <Routes>
      <Route path="/auth" element={<Auth />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <OrgProvider>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/warehouses" element={<Warehouses />} />
                  <Route path="/inbound" element={<Inbound />} />
                  <Route path="/outbound" element={<Outbound />} />
                  <Route path="/movements" element={<Movements />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/purchase-orders" element={<PurchaseOrders />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />

                  <Route path="/profile" element={<Profile />} />
                  <Route path="/account-settings" element={<AccountSettings />} />
                  <Route path="/alerts" element={<Alerts />} />
                </Routes>
              </MainLayout>
            </OrgProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
