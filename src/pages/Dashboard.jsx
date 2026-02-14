import { Info, TrendingDown, Sparkles } from "lucide-react";
import { dashboardFake } from "../ui/fakeData";
import { kpiFake } from "../ui/fakeKpis";

const cn = (...xs) => xs.filter(Boolean).join(" ");

export default function Dashboard() {
  const d = dashboardFake;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">Inventario</div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Vista rápida del estado de tu inventario
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Exportar
          </button>
          <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
            Nuevo movimiento
          </button>
        </div>
      </div>

      <KpiRow />

      {/* Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Card 1: Gauge */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader title="Supplier on Time Delivery" />
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            <Gauge value={d.onTimeDelivery.value} />
            <div className="flex items-center gap-3">
              <Pill icon={TrendingDown} text={`Trend`} />
              <Pill text={`Goal ${d.onTimeDelivery.goal}`} danger />
            </div>
          </div>
        </Card>

        {/* Card 2: Supply bars */}
        <Card className="col-span-12 lg:col-span-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Supply</div>
              <div className="mt-1 text-4xl font-semibold text-slate-900">
                {d.supply.total}
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <span className="inline-flex h-5 w-1.5 rounded-full bg-emerald-500/90" />
              <span className="inline-flex h-5 w-1.5 rounded-full bg-emerald-500/70" />
              <span className="inline-flex h-5 w-1.5 rounded-full bg-emerald-500/50" />
            </div>
          </div>

          <div className="mt-5">
            <FakeStackedBars data={d.supply.bars} />
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

        {/* Card 3: Previous vs Current + forecast */}
        <Card className="col-span-12 lg:col-span-6">
          <div className="flex items-start justify-between">
            <div className="flex gap-12">
              <Metric label="Previous" value={d.forecast.previous} />
              <Metric label="Current" value={d.forecast.current} />
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="inline-flex h-5 w-1 rounded-full bg-orange-500/90" />
              <span className="inline-flex h-5 w-1 rounded-full bg-orange-500/60" />
              <span className="inline-flex h-5 w-1 rounded-full bg-orange-500/40" />
            </div>
          </div>

          <div className="mt-5">
            <FakeBars data={d.forecast.bars} />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">AI Forecast</div>
              <div className="text-sm text-slate-600 mt-0.5">
                Rising demand forecasts indicates an increase in fulfillment capacity would be needed.
              </div>
            </div>
          </div>
        </Card>

        {/* Card 4: Inventory health */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader title="Inventory Health" />

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Overall Health" value={d.health.overall} />
            <Stat label="Overcapacity" value={d.health.over} />
            <Stat label="Undercapacity" value={d.health.under} />
          </div>

          <div className="mt-6">
            <InventoryHealthBars data={d.health.bars} />
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

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-5xl font-semibold text-slate-900">{value}%</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}%</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function Pill({ icon: Icon, text, danger }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
        danger
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-white text-slate-700"
      )}
    >
      {Icon ? <Icon className={cn("h-4 w-4", danger ? "text-red-600" : "text-slate-600")} /> : null}
      <span className="font-medium">{text}</span>
    </div>
  );
}

/* ---------------- Fake charts ---------------- */

function Gauge({ value = 87 }) {
  // Semicírculo con conic-gradient + máscara
  // Mapeo 0..100 -> 0..180deg aprox, pero con conic queda fácil:
  const deg = Math.max(0, Math.min(100, value)) * 1.8;

  return (
    <div className="relative h-56 w-56">
      {/* Base ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#22c55e 0deg, #06b6d4 ${deg}deg, #e2e8f0 ${deg}deg, #e2e8f0 360deg)`,
        }}
      />
      {/* Mask to make it a ring */}
      <div className="absolute inset-4 rounded-full bg-white" />

      {/* Mask bottom half to look like semi gauge */}
      <div className="absolute left-0 right-0 bottom-0 h-1/2 bg-white" />

      {/* Value */}
      <div className="absolute inset-0 flex items-center justify-center pt-12">
        <div className="text-5xl font-semibold text-slate-900">
          {value}
          <span className="text-2xl text-slate-700">%</span>
        </div>
      </div>
    </div>
  );
}

function FakeStackedBars({ data }) {
  // data: [{ w, t, r }] en %
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="h-36 flex items-end gap-2">
        {data.map((b, idx) => (
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
        <span>May</span>
        <span>Jun</span>
        <span>Jul</span>
        <span>Aug</span>
        <span>Sep</span>
        <span>Oct</span>
      </div>
    </div>
  );
}

function FakeBars({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="h-36 flex items-end gap-2">
        {data.map((h, idx) => (
          <div key={idx} className="flex-1">
            <div className="h-28 w-full rounded-lg bg-white border border-slate-200 flex items-end overflow-hidden">
              <div
                className="w-full bg-cyan-500/70"
                style={{ height: `${h}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-xs text-slate-400">
        <span>May</span>
        <span>Jun</span>
        <span>Jul</span>
        <span>Aug</span>
        <span>Sep</span>
        <span>Oct</span>
      </div>
    </div>
  );
}

function InventoryHealthBars({ data }) {
  // 3 barras tipo tu referencia (con una con rayitas)
  return (
    <div className="grid grid-cols-3 gap-5">
      {data.map((b, idx) => (
        <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="h-40 w-full rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-end">
            <div className="w-full relative" style={{ height: `${b.height}%` }}>
              <div className={cn("absolute inset-0", b.base)} />
              {b.hatched ? (
                <div className="absolute inset-0 opacity-40"
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

function KpiRow() {
  const k = kpiFake;

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  return (
    <div className="grid grid-cols-12 gap-4">
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Stock total" value={k.stockTotal.toLocaleString()} sub="Unidades en sistema" />
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Productos bajos" value={k.lowStock} sub="Bajo stock mínimo" />
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Valor inventario" value={money.format(k.inventoryValue)} sub="Costo estimado" />
      <KpiCard className="col-span-12 sm:col-span-6 lg:col-span-3" label="Movimientos hoy" value={k.movementsToday} sub="Entradas + Salidas" />

      <div className="col-span-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="text-sm font-medium text-slate-700">Top productos (stock)</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {k.topProducts.map((p) => (
              <div key={p.sku} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                <div className="text-xs text-slate-500 mt-1">{p.sku}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-900">{p.qty}</div>
                <div className="text-xs text-slate-500">unidades</div>
              </div>
            ))}
          </div>
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

