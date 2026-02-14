export default function TableShell({ title, subtitle, actions, children, right }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">Inventario</div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-slate-600 mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {actions}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        {children}
      </div>
    </div>
  );
}
