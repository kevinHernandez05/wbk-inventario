import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";
import { useNavigate } from "react-router-dom";
import { dashboardFake } from "../ui/fakeData";

const cn = (...xs) => xs.filter(Boolean).join(" ");

async function exportDashboardPdf({ orgId, kpis, topProducts }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Dashboard - Inventario", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Org: ${orgId}`, margin, y);
  y += 14;
  doc.text(`Generado: ${new Date().toISOString()}`, margin, y);
  doc.setTextColor(0);
  y += 22;

  const lines = [
    ["Stock total", String(Number(kpis.stockTotal || 0))],
    ["Productos bajos", String(Number(kpis.lowStock || 0))],
    ["Valor inventario", String(kpis.inventoryValueFormatted || "")],
    ["Movimientos hoy", String(Number(kpis.movementsToday || 0))],
  ];

  doc.setFont("helvetica", "bold");
  doc.text("KPIs", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  for (const [k, v] of lines) {
    doc.text(`${k}: ${v}`, margin, y);
    y += 14;
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Top productos (stock)", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  if (!topProducts?.length) {
    doc.text("—", margin, y);
  } else {
    for (const p of topProducts) {
      doc.text(`${p.sku || "—"} | ${p.name || "—"} | ${Number(p.qty || 0)}`, margin, y);
      y += 14;
    }
  }

  doc.save("dashboard_inventario.pdf");
}

/**
 * Normaliza un objeto con valores (a,b,c) a porcentajes que sumen 100.
 * Si todo es 0, devuelve 0,0,0
 */
function toPct3(a, b, c) {
  const A = Number(a || 0);
  const B = Number(b || 0);
  const C = Number(c || 0);
  const sum = A + B + C;
  if (!sum) return { w: 0, t: 0, r: 0 };
  return {
    w: Math.round((A / sum) * 100),
    t: Math.round((B / sum) * 100),
    r: Math.max(0, 100 - Math.round((A / sum) * 100) - Math.round((B / sum) * 100)),
  };
}

export default function Dashboard() {
  const { orgId, loadingOrg } = useOrg();
  const nav = useNavigate();

  // mantenemos los charts fake como base visual
  const d = dashboardFake;

  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState({
    stockTotal: 0,
    lowStock: 0,
    inventoryValue: 0,
    movementsToday: 0,
  });

  const [topProducts, setTopProducts] = useState([]);

  // ✅ nuevos: supply + health reales
  const [supplyBars, setSupplyBars] = useState(d.supply.bars);
  const [supplyTotal, setSupplyTotal] = useState(d.supply.total);

  const [health, setHealth] = useState({
    overall: d.health.overall,
    over: d.health.over,
    under: d.health.under,
  });

  const money = useMemo(
    () =>
      new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        maximumFractionDigits: 2,
      }),
    []
  );

  useEffect(() => {
    if (!orgId) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadDashboard() {
    setLoading(true);

    const [
      { data: kData, error: kErr },
      { data: tData, error: tErr },
      { data: sData, error: sErr },
      { data: hData, error: hErr },
    ] = await Promise.all([
      supabase.rpc("dashboard_kpis", { p_org: orgId }),
      supabase.rpc("dashboard_top_products", { p_org: orgId, p_limit: 5 }),
      supabase.rpc("dashboard_supply", { p_org: orgId }),
      supabase.rpc("dashboard_health", { p_org: orgId }),
    ]);

    if (kErr) console.error(kErr);
    if (tErr) console.error(tErr);
    if (sErr) console.error(sErr);
    if (hErr) console.error(hErr);

    const k = (kData && kData[0]) || null;

    setKpis({
      stockTotal: Number(k?.stock_total || 0),
      lowStock: Number(k?.low_stock_count || 0),
      inventoryValue: Number(k?.inventory_value || 0),
      movementsToday: Number(k?.movements_today || 0),
    });

    setTopProducts(
      (tData || []).map((x) => ({
        sku: x.sku,
        name: x.name,
        qty: Number(x.qty || 0),
      }))
    );

    /**
     * Supply:
     * Soporta 2 formas comunes:
     * A) rows con {month, warehouse, in_transport, retail}
     * B) rows con {month, inbound, outbound} -> lo mapeamos a 3 segmentos
     */
    if (Array.isArray(sData) && sData.length) {
      const normalized = sData.slice(0, 6).map((row) => {
        if ("warehouse" in row || "in_transport" in row || "retail" in row) {
          const pct = toPct3(row.warehouse, row.in_transport, row.retail);
          return { w: pct.w, t: pct.t, r: pct.r, month: row.month };
        }
        // fallback inbound/outbound
        const pct = toPct3(row.inbound, row.outbound, 0);
        return { w: pct.w, t: pct.t, r: pct.r, month: row.month };
      });

      setSupplyBars(normalized.map((x) => ({ w: x.w, t: x.t, r: x.r })));

      // total “bonito” arriba: suma de valores crudos si existen, si no, usa movementsToday * algo
      const total =
        sData.reduce((acc, row) => {
          const a = Number(row.warehouse ?? row.inbound ?? 0);
          const b = Number(row.in_transport ?? row.outbound ?? 0);
          const c = Number(row.retail ?? 0);
          return acc + a + b + c;
        }, 0) || 0;

      setSupplyTotal(total || d.supply.total);
    } else {
      // si no hay data, mantenemos fake visual
      setSupplyBars(d.supply.bars);
      setSupplyTotal(d.supply.total);
    }

    /**
     * Health:
     * esperamos algo como { overall, over, under } (en %)
     * o { overall_ok_pct, over_pct, under_pct }
     */
    const h = (hData && hData[0]) || null;
    if (h) {
      setHealth({
        overall: Number(h.overall ?? h.overall_ok_pct ?? d.health.overall),
        over: Number(h.over ?? h.over_pct ?? d.health.over),
        under: Number(h.under ?? h.under_pct ?? d.health.under),
      });
    }

    setLoading(false);
  }

  const computed = useMemo(() => {
    return {
      ...kpis,
      inventoryValueFormatted: money.format(kpis.inventoryValue || 0),
    };
  }, [kpis, money]);

  async function onExport() {
    await exportDashboardPdf({ orgId, kpis: computed, topProducts });
  }

  // Para mantener tu look de 3 barras abajo
  const healthBars = useMemo(() => {
    return [
      { label: "Healthy", note: "Stock estable", height: Math.max(0, Math.min(100, health.overall)), base: "bg-cyan-500/80", hatched: false },
      { label: "Watchlist", note: "Revisar rotación", height: Math.max(0, Math.min(100, health.over)), base: "bg-emerald-500/70", hatched: true },
      { label: "Risk", note: "Bajo stock", height: Math.max(0, Math.min(100, health.under)), base: "bg-sky-500/70", hatched: false },
    ];
  }, [health]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">Inventario</div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Vista rápida del estado de tu inventario</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Exportar
          </button>

          <button
            onClick={() => nav("/inbound")}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Nuevo movimiento
          </button>
        </div>
      </div>

      <KpiRow loading={loadingOrg || loading} kpis={computed} topProducts={topProducts} />

      {/* Grid: SOLO Supply + Inventory Health (mismo estilo del mock) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Supply */}
        <Card className="col-span-12 lg:col-span-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Supply</div>
              <div className="mt-1 text-4xl font-semibold text-slate-900">
                {loadingOrg || loading ? "—" : supplyTotal}
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <span className="inline-flex h-5 w-1.5 rounded-full bg-emerald-500/90" />
              <span className="inline-flex h-5 w-1.5 rounded-full bg-emerald-500/70" />
              <span className="inline-flex h-5 w-1.5 rounded-full bg-emerald-500/50" />
            </div>
          </div>

          <div className="mt-5">
            <FakeStackedBars data={supplyBars} />
            <div className="mt-4">
              <Legend
                items={[
                  { label: "Warehouse", swatch: "bg-slate-900" },
                  { label: "In Transport", swatch: "bg-sky-500" },
                  { label: "Retail", swatch: "bg-teal-500" },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Inventory health */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader title="Inventory Health" />

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Overall Health" value={loadingOrg || loading ? d.health.overall : health.overall} />
            <Stat label="Overcapacity" value={loadingOrg || loading ? d.health.over : health.over} />
            <Stat label="Undercapacity" value={loadingOrg || loading ? d.health.under : health.under} />
          </div>

          <div className="mt-6">
            <InventoryHealthBars data={healthBars} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- UI bits ---------------- */

function Card({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ title }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      <button className="h-9 w-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400">
        <Info className="h-4 w-4" />
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
      <div className="text-2xl font-semibold text-slate-900">{Number(value || 0)}%</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

/* ---------------- Fake charts (SIN CAMBIAR TU LOOK) ---------------- */

function FakeStackedBars({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="h-36 flex items-end gap-2">
        {(data || []).map((b, idx) => (
          <div key={idx} className="flex-1 flex flex-col justify-end">
            <div className="w-full rounded-lg overflow-hidden border border-slate-200 bg-white">
              <div className="flex flex-col h-28">
                <div className="bg-slate-900" style={{ height: `${b.w}%` }} />
                <div className="bg-sky-500" style={{ height: `${b.t}%` }} />
                <div className="bg-teal-500" style={{ height: `${b.r}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-xs text-slate-400">
        <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span>
      </div>
    </div>
  );
}

function InventoryHealthBars({ data }) {
  return (
    <div className="grid grid-cols-3 gap-5">
      {(data || []).map((b, idx) => (
        <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="h-40 w-full rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-end">
            <div className="w-full relative" style={{ height: `${b.height}%` }}>
              <div className={cn("absolute inset-0", b.base)} />
              {b.hatched ? (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(255,255,255,0.0) 0px, rgba(255,255,255,0.0) 6px, rgba(255,255,255,0.65) 6px, rgba(255,255,255,0.65) 10px)",
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-3 text-sm font-medium text-slate-700">{b.label}</div>
          <div className="text-xs text-slate-500">{b.note}</div>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", it.swatch)} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function KpiRow({ loading, kpis, topProducts }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Stock total" value={loading ? "—" : Number(kpis.stockTotal || 0).toLocaleString()} sub="Unidades en sistema" />
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Productos bajos" value={loading ? "—" : Number(kpis.lowStock || 0)} sub="Bajo stock mínimo" />
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Valor inventario" value={loading ? "—" : (kpis.inventoryValueFormatted || "—")} sub="Costo estimado" />
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Movimientos hoy" value={loading ? "—" : Number(kpis.movementsToday || 0)} sub="Entradas + Salidas" />

      <div className="col-span-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="text-sm font-medium text-slate-700">Top productos (stock)</div>

          {loading ? (
            <div className="mt-3 text-sm text-slate-600">Cargando...</div>
          ) : topProducts?.length ? (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {topProducts.map((p) => (
                <div key={`${p.sku}-${p.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{p.sku || "—"}</div>
                  <div className="mt-3 text-2xl font-semibold text-slate-900">{Number(p.qty || 0)}</div>
                  <div className="text-xs text-slate-500">unidades</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600">No hay productos todavía.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, className }) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] ${className || ""}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{sub}</div>
    </div>
  );
}