import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Package,
  Tags,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ListOrdered,
  Truck,
  BarChart3,
  Settings,
  Bell,
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ROUTES } from "../routes";

const cn = (...xs) => xs.filter(Boolean).join(" ");

export default function Sidebar() {
  // Rail siempre visible. Panel grande: hover o pinned.
  const [pinned, setPinned] = useState(true);
  const [hovering, setHovering] = useState(false);
  const expanded = pinned || hovering;

  const [openGroups, setOpenGroups] = useState({
    inventory: true,
    operations: true,
    management: false,
    insights: true,
    system: false,
  });

  const [profileOpen, setProfileOpen] = useState(false);

  const nav = useMemo(
    () => [
      {
        key: "home",
        label: "Inicio",
        items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: ROUTES.dashboard }],
      },
      {
        key: "inventory",
        label: "Inventario",
        collapsible: true,
        items: [
          { key: "products", label: "Productos", icon: Package, to: ROUTES.products },
          { key: "categories", label: "Categorías", icon: Tags, to: ROUTES.categories },
          { key: "warehouses", label: "Almacenes", icon: Warehouse, to: ROUTES.warehouses },
        ],
      },
      {
        key: "operations",
        label: "Operaciones",
        collapsible: true,
        items: [
          { key: "inbound", label: "Entradas", icon: ArrowDownToLine, to: ROUTES.inbound },
          { key: "outbound", label: "Salidas", icon: ArrowUpFromLine, to: ROUTES.outbound },
          { key: "movements", label: "Movimientos", icon: ListOrdered, to: ROUTES.movements },
        ],
      },
      {
        key: "management",
        label: "Gestión",
        collapsible: true,
        items: [
          { key: "suppliers", label: "Proveedores", icon: Truck, to: ROUTES.suppliers },
          { key: "purchase_orders", label: "Órdenes de compra", icon: Boxes, badge: "Soon", to: ROUTES.purchase_orders },
        ],
      },
      {
        key: "insights",
        label: "Insights",
        collapsible: true,
        items: [{ key: "reports", label: "Reportes", icon: BarChart3, to: ROUTES.reports }],
      },
      {
        key: "system",
        label: "Sistema",
        collapsible: true,
        items: [{ key: "settings", label: "Configuración", icon: Settings, to: ROUTES.settings }],
      },
    ],
    []
  );

  const railItems = useMemo(
    () => [
      { key: "dashboard", icon: LayoutDashboard, to: ROUTES.dashboard },
      { key: "products", icon: Package, to: ROUTES.products },
      { key: "movements", icon: ListOrdered, to: ROUTES.movements },
      { key: "reports", icon: BarChart3, to: ROUTES.reports },
      { key: "notifications", icon: Bell, to: ROUTES.settings }, // placeholder
      { key: "settings", icon: Settings, to: ROUTES.settings },
    ],
    []
  );

  const toggleGroup = (key) => setOpenGroups((s) => ({ ...s, [key]: !s[key] }));

  return (
    <aside className="flex h-screen sticky top-0">
      {/* Rail */}
      <div
        className="w-[72px] bg-slate-50 border-r border-slate-200 flex flex-col items-center py-4"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <NavLink
          to={ROUTES.dashboard}
          className="h-11 w-11 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center"
          title="Inventario"
        >
          <Boxes className="h-5 w-5" />
        </NavLink>

        <div className="mt-6 flex flex-col gap-2">
          {railItems.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.key}
                to={it.to}
                className={({ isActive }) =>
                  cn(
                    "h-11 w-11 rounded-2xl flex items-center justify-center transition",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-slate-100"
                  )
                }
                title={it.key}
              >
                <Icon className="h-5 w-5" />
              </NavLink>
            );
          })}
        </div>

        <div className="mt-auto w-full px-3 pb-3">
          <button
            onClick={() => setPinned((v) => !v)}
            className="w-full h-11 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center hover:bg-slate-50"
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {pinned ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>

          <div className="mt-3 relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="w-full h-11 rounded-2xl bg-slate-100 flex items-center justify-center hover:bg-slate-200"
              title="Perfil"
            >
              <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-700" />
              </div>
            </button>

            {profileOpen && (
              <div className="absolute left-[76px] bottom-0 w-72 rounded-2xl border border-slate-200 bg-white shadow-lg p-2">
                <div className="px-2 py-2">
                  <div className="text-sm font-semibold text-slate-900">Kevin</div>
                  <div className="text-xs text-slate-500">kevin@wbkrd.com</div>
                </div>
                <div className="h-px bg-slate-100 my-2" />
                <MenuItem icon={User} label="Ver perfil" />
                <MenuItem icon={Settings} label="Ajustes de cuenta" />
                <MenuItem icon={Bell} label="Notificaciones" />
                <div className="h-px bg-slate-100 my-2" />
                <MenuItem icon={LogOut} label="Cerrar sesión" danger />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel */}
      <div
        className={cn(
          "bg-white border-r border-slate-200 overflow-hidden transition-all duration-200",
          expanded ? "w-[320px]" : "w-0"
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="w-[320px]">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Inventario</div>
                <div className="text-xs text-slate-500">UI base (MVP)</div>
              </div>

              <button
                className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"
                onClick={() => setPinned(true)}
                title="Pin"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex gap-2 text-sm">
              <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white">Módulos</button>
              <button className="px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700">Aprender</button>
            </div>
          </div>

          <nav className="px-3 pb-6 overflow-y-auto h-[calc(100vh-140px)]">
            {nav.map((section) => {
              const isCollapsible = !!section.collapsible;
              const isOpen = openGroups[section.key] ?? true;

              return (
                <div key={section.key} className="mb-3">
                  <div className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {section.label}
                  </div>

                  <div className="space-y-1">
                    {isCollapsible ? (
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-800"
                        onClick={() => toggleGroup(section.key)}
                      >
                        <span className="text-sm font-medium">{section.label}</span>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                      </button>
                    ) : null}

                    <div className={cn(isCollapsible && !isOpen && "hidden")}>
                      {section.items.map((it) => (
                        <NavItem
                          key={it.key}
                          icon={it.icon}
                          label={it.label}
                          badge={it.badge}
                          to={it.to}
                          indent={isCollapsible}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon: Icon, label, badge, to, indent }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition",
          indent ? "ml-3" : "",
          isActive ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
        )
      }
      end={to === "/"} // para que dashboard solo active en "/"
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center",
              isActive ? "bg-white border border-slate-200" : "bg-transparent"
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium">{label}</span>

          {badge && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-white">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function MenuItem({ icon: Icon, label, danger }) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 text-sm",
        danger ? "text-red-600" : "text-slate-700"
      )}
    >
      <span className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
