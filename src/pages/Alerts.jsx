// src/pages/Alerts.jsx
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Boxes, RefreshCcw, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function fmtDate(d) {
  try {
    if (!d) return "—";
    const x = new Date(d);
    if (Number.isNaN(+x)) return String(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  } catch {
    return String(d);
  }
}

function num(n) {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return 0;
  return v;
}

export default function Alerts() {
  const { orgId, loadingOrg } = useOrg();

  const [activeTab, setActiveTab] = useState("low"); // low | exp | over
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [low, setLow] = useState([]);
  const [exp, setExp] = useState([]);
  const [over, setOver] = useState([]);

  useEffect(() => {
    if (!orgId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadAll() {
    setLoading(true);

    const [a, b, c] = await Promise.all([
      supabase.rpc("alert_low_stock", { p_org: orgId }),
      supabase.rpc("alerts_expiring", { p_org: orgId }),
      supabase.rpc("alerts_overstock", { p_org: orgId }),
    ]);

    if (a.error) console.error(a.error);
    if (b.error) console.error(b.error);
    if (c.error) console.error(c.error);

    setLow(a.data || []);
    setExp(b.data || []);
    setOver(c.data || []);

    setLoading(false);
  }

  const counts = useMemo(
    () => ({
      low: low.length,
      exp: exp.length,
      over: over.length,
    }),
    [low, exp, over]
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();

    const base =
      activeTab === "low" ? low : activeTab === "exp" ? exp : over;

    if (!s) return base;

    return base.filter((r) => {
      const parts = [
        r?.sku,
        r?.name,
        r?.expiration_date,
        r?.days_left,
        r?.stock,
        r?.min_stock,
        r?.max_stock,
      ]
        .filter((x) => x !== undefined && x !== null)
        .map((x) => String(x).toLowerCase());

      return parts.some((x) => x.includes(s));
    });
  }, [activeTab, q, low, exp, over]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">Sistema</div>
          <h1 className="text-2xl font-semibold text-slate-900">Alertas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Bajo stock, productos por vencer y overstock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="h-10 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 inline-flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-12 gap-4">
        <KpiCard
          className="col-span-12 sm:col-span-4"
          icon={AlertTriangle}
          label="Bajo stock"
          value={loadingOrg || loading ? "—" : String(counts.low)}
          sub="Productos por debajo del mínimo"
        />
        <KpiCard
          className="col-span-12 sm:col-span-4"
          icon={CalendarClock}
          label="Por vencer"
          value={loadingOrg || loading ? "—" : String(counts.exp)}
          sub="En los próximos 30 días"
        />
        <KpiCard
          className="col-span-12 sm:col-span-4"
          icon={Boxes}
          label="Overstock"
          value={loadingOrg || loading ? "—" : String(counts.over)}
          sub="Por encima del máximo"
        />
      </div>

      {/* Tabs + Search */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Tab
              active={activeTab === "low"}
              onClick={() => setActiveTab("low")}
              label="Bajo stock"
              badge={counts.low}
            />
            <Tab
              active={activeTab === "exp"}
              onClick={() => setActiveTab("exp")}
              label="Por vencer"
              badge={counts.exp}
            />
            <Tab
              active={activeTab === "over"}
              onClick={() => setActiveTab("over")}
              label="Overstock"
              badge={counts.over}
            />
          </div>

          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="h-10 w-[320px] max-w-[78vw] rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Buscar por SKU, producto..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Body */}
        {loadingOrg || loading ? (
          <div className="p-6 text-sm text-slate-600">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            No hay alertas en este momento.
          </div>
        ) : (
          <div className="overflow-auto">
            {activeTab === "low" ? (
              <LowStockTable rows={rows} />
            ) : activeTab === "exp" ? (
              <ExpiringTable rows={rows} />
            ) : (
              <OverstockTable rows={rows} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- UI ---------------- */

function KpiCard({ icon: Icon, label, value, sub, className }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
          <div className="mt-1 text-sm text-slate-600">{sub}</div>
        </div>
        <div className="h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-10 px-3 rounded-2xl text-sm font-medium border inline-flex items-center gap-2",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "text-[11px] px-2 py-0.5 rounded-full",
          active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
        )}
      >
        {badge ?? 0}
      </span>
    </button>
  );
}

/* ---------------- Tables ---------------- */

function LowStockTable({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-slate-500">
        <tr className="border-b border-slate-100">
          <th className="text-left py-3 px-5">SKU</th>
          <th className="text-left py-3 px-5">Producto</th>
          <th className="text-right py-3 px-5">Stock</th>
          <th className="text-right py-3 px-5">Mínimo</th>
          <th className="text-left py-3 px-5">Severidad</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const stock = num(r.stock);
          const min = num(r.min_stock);
          const diff = min - stock;

          const tone =
            diff >= 20 ? "danger" : diff >= 5 ? "warn" : "muted";

          return (
            <tr key={r.product_id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-3 px-5 text-slate-700">{r.sku || "—"}</td>
              <td className="py-3 px-5 text-slate-900 font-medium">{r.name || "—"}</td>
              <td className="py-3 px-5 text-right font-semibold text-slate-900">
                {stock.toLocaleString()}
              </td>
              <td className="py-3 px-5 text-right text-slate-700">
                {min.toLocaleString()}
              </td>
              <td className="py-3 px-5">
                <Badge tone={tone}>
                  {tone === "danger" ? "Crítico" : tone === "warn" ? "Atención" : "Bajo"}
                </Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExpiringTable({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-slate-500">
        <tr className="border-b border-slate-100">
          <th className="text-left py-3 px-5">SKU</th>
          <th className="text-left py-3 px-5">Producto</th>
          <th className="text-left py-3 px-5">Vence</th>
          <th className="text-right py-3 px-5">Días</th>
          <th className="text-left py-3 px-5">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const days = Number(r.days_left ?? 0);
          const tone = days <= 3 ? "danger" : days <= 10 ? "warn" : "muted";

          return (
            <tr key={r.product_id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-3 px-5 text-slate-700">{r.sku || "—"}</td>
              <td className="py-3 px-5 text-slate-900 font-medium">{r.name || "—"}</td>
              <td className="py-3 px-5 text-slate-700">{fmtDate(r.expiration_date)}</td>
              <td className="py-3 px-5 text-right font-semibold text-slate-900">
                {Number.isFinite(days) ? days : "—"}
              </td>
              <td className="py-3 px-5">
                <Badge tone={tone}>
                  {days <= 0 ? "Vencido" : days <= 3 ? "Urgente" : days <= 10 ? "Pronto" : "Pendiente"}
                </Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OverstockTable({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-slate-500">
        <tr className="border-b border-slate-100">
          <th className="text-left py-3 px-5">SKU</th>
          <th className="text-left py-3 px-5">Producto</th>
          <th className="text-right py-3 px-5">Stock</th>
          <th className="text-right py-3 px-5">Máximo</th>
          <th className="text-left py-3 px-5">Nota</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const stock = num(r.stock);
          const max = num(r.max_stock);
          const extra = stock - max;

          const tone = extra >= 20 ? "warn" : "muted";

          return (
            <tr key={r.product_id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-3 px-5 text-slate-700">{r.sku || "—"}</td>
              <td className="py-3 px-5 text-slate-900 font-medium">{r.name || "—"}</td>
              <td className="py-3 px-5 text-right font-semibold text-slate-900">
                {stock.toLocaleString()}
              </td>
              <td className="py-3 px-5 text-right text-slate-700">
                {max.toLocaleString()}
              </td>
              <td className="py-3 px-5">
                <Badge tone={tone}>
                  {extra > 0 ? `+${extra.toLocaleString()} sobre el máximo` : "—"}
                </Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Badge({ children, tone = "muted" }) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs border", cls)}>
      {children}
    </span>
  );
}