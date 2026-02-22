import { useEffect, useMemo, useState } from "react";
import TableShell from "../ui/TableShell";
import { supabase } from "../lib/supabase";
import { useOrg } from "../org/OrgProvider";
import { FileDown, BarChart3 } from "lucide-react";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function fmtDate(ts) {
  try {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return ts;
  }
}

async function exportPdf({ title, subtitle, columns, rows }) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 18;

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(subtitle, margin, y);
    doc.setTextColor(0);
    y += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(columns.join("   |   "), margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lineHeight = 14;
  const pageHeight = doc.internal.pageSize.height;

  for (const r of rows) {
    const line = r.map((x) => (x === null || x === undefined ? "—" : String(x))).join("   |   ");

    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(line, margin, y);
    y += lineHeight;
  }

  const safe = title.replace(/[^\w\d\- ]+/g, "").replace(/\s+/g, "_");
  doc.save(`${safe}.pdf`);
}

export default function Reports() {
  const { orgId, loadingOrg } = useOrg();

  const [loading, setLoading] = useState(true);

  const [reportOpen, setReportOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  const [data, setData] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const reports = useMemo(
    () => [
      {
        key: "stock",
        title: "Stock por producto",
        desc: "Existencias calculadas por movimientos (in/out).",
        columns: ["SKU", "Producto", "Stock", "Min"],
        run: async () => {
          const { data, error } = await supabase.rpc("report_stock_by_product", { p_org: orgId });
          if (error) throw error;
          return (data || []).map((r) => [r.sku || "—", r.name || "—", Number(r.stock || 0), Number(r.min_stock || 0)]);
        },
      },
      {
        key: "low_stock",
        title: "Productos bajos",
        desc: "Stock <= mínimo definido en productos.",
        columns: ["SKU", "Producto", "Stock", "Min"],
        run: async () => {
          const { data, error } = await supabase.rpc("report_low_stock", { p_org: orgId });
          if (error) throw error;
          return (data || []).map((r) => [r.sku || "—", r.name || "—", Number(r.stock || 0), Number(r.min_stock || 0)]);
        },
      },
      {
        key: "movements_today",
        title: "Movimientos de hoy",
        desc: "Últimos movimientos del día (in/out).",
        columns: ["Fecha", "Tipo", "SKU", "Producto", "Cant.", "Ref"],
        run: async () => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);

          const { data, error } = await supabase
            .from("inventory_movements")
            .select(
              `
              id, created_at, type, quantity, reference,
              product:products(id,name,sku)
            `
            )
            .eq("org_id", orgId)
            .in("type", ["in", "out"])
            .gte("created_at", start.toISOString())
            .order("created_at", { ascending: false })
            .limit(200);

          if (error) throw error;

          return (data || []).map((m) => [
            fmtDate(m.created_at),
            m.type === "in" ? "Entrada" : "Salida",
            m?.product?.sku || "—",
            m?.product?.name || "—",
            Number(m.quantity || 0),
            m.reference || "—",
          ]);
        },
      },
    ],
    [orgId]
  );

  useEffect(() => {
    if (!orgId) return;
    setLoading(false);
  }, [orgId]);

  async function openReport(r) {
    setActiveReport(r);
    setReportOpen(true);
    setErrorMsg("");
    setData([]);

    try {
      const rows = await r.run();
      setData(rows || []);
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "No se pudo generar el reporte.");
    }
  }

  async function onExport() {
    if (!activeReport) return;
    await exportPdf({
      title: activeReport.title,
      subtitle: `${activeReport.desc} • Org: ${orgId}`,
      columns: activeReport.columns,
      rows: data,
    });
  }

  return (
    <TableShell
      title="Reportes"
      subtitle="Abrir un reporte en modal y exportarlo a PDF."
      right={
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          MVP: reportes básicos
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(loadingOrg || loading) ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Cargando...
          </div>
        ) : (
          reports.map((r) => (
            <button
              key={r.key}
              onClick={() => openReport(r)}
              className="text-left rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50 transition"
            >
              <div className="text-sm text-slate-500">Reporte</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{r.title}</div>
              <div className="mt-1 text-sm text-slate-600">{r.desc}</div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                Abrir <span className="text-slate-400">→</span>
              </div>
            </button>
          ))
        )}
      </div>

      {reportOpen && (
        <Modal
          title={activeReport?.title || "Reporte"}
          subtitle={activeReport?.desc}
          onClose={() => setReportOpen(false)}
          actions={
            <button
              onClick={onExport}
              disabled={!data?.length}
              className={cn(
                "h-10 px-4 rounded-2xl bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-2",
                (!data?.length) && "opacity-60"
              )}
            >
              <FileDown className="h-4 w-4" />
              Generar PDF
            </button>
          }
        >
          {errorMsg ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {errorMsg}
            </div>
          ) : data.length === 0 ? (
            <div className="text-sm text-slate-600">Generando reporte...</div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr className="border-b border-slate-200">
                    {activeReport.columns.map((c) => (
                      <th key={c} className="text-left font-medium py-3 pr-4">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {data.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      {row.map((cell, j) => (
                        <td key={j} className="py-3 pr-4">
                          {cell === null || cell === undefined || cell === "" ? "—" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </TableShell>
  );
}

function Modal({ title, subtitle, onClose, actions, children }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            {subtitle ? <div className="text-xs text-slate-500 mt-1">{subtitle}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            {actions}
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-2xl hover:bg-slate-100 flex items-center justify-center"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}