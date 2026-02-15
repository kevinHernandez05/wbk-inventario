import TableShell from "../ui/TableShell";

export default function Reports() {
  return (
    <TableShell
      title="Reportes"
      subtitle="Reportes rápidos para operar el inventario. (Fake)"
      actions={
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
          Generar reporte
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-4">
        <ReportCard
          title="Bajo stock"
          desc="Productos por debajo del mínimo."
          tag="Operación"
          col="col-span-12 md:col-span-6"
        />
        <ReportCard
          title="Kardex por rango"
          desc="Movimientos por fecha y producto."
          tag="Auditoría"
          col="col-span-12 md:col-span-6"
        />
        <ReportCard
          title="Valorización"
          desc="Costo total estimado del inventario."
          tag="Finanzas"
          col="col-span-12 md:col-span-6"
        />
        <ReportCard
          title="Rotación"
          desc="Productos más/menos movidos."
          tag="Insights"
          col="col-span-12 md:col-span-6"
        />
      </div>
    </TableShell>
  );
}

function ReportCard({ title, desc, tag, col }) {
  return (
    <div className={`${col} rounded-3xl border border-slate-200 bg-slate-50 p-5`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <span className="text-[11px] rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">
          {tag}
        </span>
      </div>
      <div className="mt-2 text-sm text-slate-600">{desc}</div>

      <div className="mt-4 h-28 rounded-2xl border border-slate-200 bg-white" />
      <button className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Abrir
      </button>
    </div>
  );
}
