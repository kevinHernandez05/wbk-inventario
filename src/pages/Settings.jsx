import { useEffect, useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";

const cn = (...xs) => xs.filter(Boolean).join(" ");

const DEFAULTS = {
  businessName: "Inventario",
  currency: "DOP",
  lowStockThreshold: 0,
  enableAlerts: true,
  timeZone: "America/Santo_Domingo",
  dateFormat: "YYYY-MM-DD",
  requireReferenceOnMovements: false,
  defaultWarehouseId: "",
};

export default function Settings() {
  const { orgId, loadingOrg } = useOrg();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouses, setWarehouses] = useState([]);

  const [form, setForm] = useState(DEFAULTS);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!orgId) return;
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function boot() {
    setLoading(true);
    await Promise.all([loadWarehouses(), loadSettings()]);
    setLoading(false);
  }

  async function loadWarehouses() {
    const { data, error } = await supabase
      .from("warehouses")
      .select("id,name")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("name");

    if (error) console.error(error);
    setWarehouses(data || []);
  }

  async function loadSettings() {
    // Intentamos cargar 1 row por org
    const { data, error } = await supabase
      .from("settings")
      .select(
        "org_id,business_name,currency,low_stock_threshold,enable_alerts,time_zone,date_format,require_reference_on_movements,default_warehouse_id"
      )
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    // Si no existe, creamos defaults (1 row)
    if (!data) {
      const userRes = await supabase.auth.getUser();
      const userId = userRes?.data?.user?.id || null;

      const { error: insErr } = await supabase.from("settings").insert({
        org_id: orgId,
        business_name: DEFAULTS.businessName,
        currency: DEFAULTS.currency,
        low_stock_threshold: DEFAULTS.lowStockThreshold,
        enable_alerts: DEFAULTS.enableAlerts,
        time_zone: DEFAULTS.timeZone,
        date_format: DEFAULTS.dateFormat,
        require_reference_on_movements: DEFAULTS.requireReferenceOnMovements,
        default_warehouse_id: null,
        created_by: userId,
      });

      if (insErr) console.error(insErr);

      setForm(DEFAULTS);
      return;
    }

    setForm({
      businessName: data.business_name ?? DEFAULTS.businessName,
      currency: data.currency ?? DEFAULTS.currency,
      lowStockThreshold: Number(data.low_stock_threshold ?? DEFAULTS.lowStockThreshold),
      enableAlerts: !!data.enable_alerts,
      timeZone: data.time_zone ?? DEFAULTS.timeZone,
      dateFormat: data.date_format ?? DEFAULTS.dateFormat,
      requireReferenceOnMovements: !!data.require_reference_on_movements,
      defaultWarehouseId: data.default_warehouse_id ?? "",
    });
  }

  async function save() {
    setSaving(true);

    const userRes = await supabase.auth.getUser();
    const userId = userRes?.data?.user?.id || null;

    const payload = {
      org_id: orgId,
      business_name: form.businessName.trim() || "Inventario",
      currency: form.currency,
      low_stock_threshold: Number(form.lowStockThreshold || 0),
      enable_alerts: !!form.enableAlerts,
      time_zone: form.timeZone,
      date_format: form.dateFormat,
      require_reference_on_movements: !!form.requireReferenceOnMovements,
      default_warehouse_id: form.defaultWarehouseId ? form.defaultWarehouseId : null,
      created_by: userId, // harmless en upsert
    };

    const { error } = await supabase
      .from("settings")
      .upsert(payload, { onConflict: "org_id" });

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "No se pudo guardar configuración.");
      return;
    }

    alert("Configuración guardada ✅");
  }

  const warehouseName = useMemo(() => {
    if (!form.defaultWarehouseId) return "—";
    return warehouses.find((w) => w.id === form.defaultWarehouseId)?.name || "—";
  }, [warehouses, form.defaultWarehouseId]);

  return (
    <TableShell
      title="Configuración"
      subtitle="Ajustes generales del sistema."
      actions={
        <button
          onClick={save}
          disabled={loadingOrg || loading || saving}
          className={cn(
            "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800",
            (loadingOrg || loading || saving) && "opacity-60"
          )}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      }
    >
      {(loadingOrg || loading) ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Cargando...
        </div>
      ) : (
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

            <Field label="Almacén por defecto">
              <select
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                value={form.defaultWarehouseId}
                onChange={(e) => set("defaultWarehouseId", e.target.value)}
              >
                <option value="">(Ninguno)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-xs text-slate-500">
                Actual: <span className="text-slate-700 font-medium">{warehouseName}</span>
              </div>
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
                <div className="text-sm text-slate-600">
                  Muestra indicadores cuando hay bajo stock.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.requireReferenceOnMovements}
                onChange={(e) => set("requireReferenceOnMovements", e.target.checked)}
              />
              <div>
                <div className="text-sm font-medium text-slate-900">Requerir referencia</div>
                <div className="text-sm text-slate-600">
                  Obliga a poner referencia al registrar entradas/salidas.
                </div>
              </div>
            </label>
          </Section>

          <Section title="Formato" className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Zona horaria">
                <Input value={form.timeZone} onChange={(v) => set("timeZone", v)} />
              </Field>

              <Field label="Formato de fecha">
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  value={form.dateFormat}
                  onChange={(e) => set("dateFormat", e.target.value)}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </Field>
            </div>
          </Section>
        </div>
      )}
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