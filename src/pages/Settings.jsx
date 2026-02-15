import { useState } from "react";
import TableShell from "../ui/TableShell";

export default function Settings() {
  const [form, setForm] = useState({
    businessName: "Inventario - Demo",
    currency: "USD",
    lowStockThreshold: 50,
    enableAlerts: true,
  });

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <TableShell
      title="Configuración"
      subtitle="Ajustes generales del sistema. (Fake)"
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Guardar cambios
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-6">
        <Section title="Negocio" className="col-span-12 lg:col-span-6">
          <Field label="Nombre del negocio">
            <Input value={form.businessName} onChange={(v) => set("businessName", v)} />
          </Field>

          <Field label="Moneda">
            <select
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            >
              <option value="USD">USD</option>
              <option value="DOP">DOP</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </Section>

        <Section title="Alertas" className="col-span-12 lg:col-span-6">
          <Field label="Threshold de bajo stock">
            <Input
              type="number"
              value={form.lowStockThreshold}
              onChange={(v) => set("lowStockThreshold", Number(v))}
            />
          </Field>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.enableAlerts}
              onChange={(e) => set("enableAlerts", e.target.checked)}
            />
            <div>
              <div className="text-sm font-medium text-slate-900">Habilitar alertas</div>
              <div className="text-sm text-slate-600">Muestra indicadores cuando hay bajo stock.</div>
            </div>
          </label>
        </Section>
      </div>
    </TableShell>
  );
}

function Section({ title, className, children }) {
  return (
    <div className={`${className} rounded-3xl border border-slate-200 bg-white p-5`}>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text" }) {
  return (
    <input
      type={type}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
