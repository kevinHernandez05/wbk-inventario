import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast?.open) return;
    const t = setTimeout(() => onClose?.(), toast.duration ?? 3200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast?.open) return null;

  const tone =
    toast.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : toast.type === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-white text-slate-800";

  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div
        className={cn(
          "w-[360px] max-w-[90vw] rounded-2xl border shadow-sm px-4 py-3",
          tone,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-60" />
          </div>

          <div className="flex-1">
            <div className="text-sm font-semibold">
              {toast.title || "Aviso"}
            </div>
            {toast.message ? (
              <div className="mt-0.5 text-sm opacity-90">{toast.message}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl hover:bg-black/5 flex items-center justify-center"
            aria-label="Close toast"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function sanitizeAuthError(err) {
  const raw = (err?.message || "").toLowerCase();

  if (raw.includes("invalid login credentials")) {
    return {
      title: "Credenciales incorrectas",
      message: "Verifica tu email y contraseña e inténtalo de nuevo.",
    };
  }

  if (raw.includes("email not confirmed")) {
    return {
      title: "Email no confirmado",
      message: "Contacta a un agente de WBKRD para habilitar tu acceso.",
    };
  }

  return {
    title: "No se pudo iniciar sesión",
    message: err?.message || "Inténtalo de nuevo.",
  };
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState({ open: false });

  const contactEmail = "support@wbkrd.com"; 
  const contactMailto = useMemo(
    () =>
      `mailto:${contactEmail}?subject=Acceso%20a%20Inventario%20(MVP)&body=Hola%20WBKRD,%0A%0ANecesito%20acceso%20a%20Inventario%20(MVP).%0A%0AMi%20correo:%20${encodeURIComponent(
        email || "",
      )}%0A%0AGracias.`,
    [email],
  );

  useEffect(() => {
    if (loading) return;
    if (user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      setToast({
        open: true,
        type: "success",
        title: "Bienvenido",
        message: "Entrando a Inventario…",
        duration: 1400,
      });

      navigate("/", { replace: true });
    } catch (err) {
      const nice = sanitizeAuthError(err);
      setToast({
        open: true,
        type: "error",
        title: nice.title,
        message: nice.message,
        duration: 3200,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toast toast={toast} onClose={() => setToast({ open: false })} />

      <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
        <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: Form */}
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-semibold">
                  I
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Inventario
                </div>
              </div>

              <div className="mt-10">
                <h1 className="text-3xl font-semibold text-slate-900">
                  Iniciar sesión
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Ingresa tus credenciales para acceder al sistema.
                </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={onSubmit}>
                <Field label="Email">
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Enter your mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </Field>

                <Field label="Password">
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </Field>

                <button
                  disabled={busy}
                  className={cn(
                    "w-full h-11 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800",
                    busy && "opacity-60",
                  )}
                >
                  {busy ? "Entrando..." : "Entrar"}
                </button>

                <div className="pt-2 text-sm text-slate-600">
                  ¿Sin cuenta o olvidaste la clave?{" "}
                  <a
                    className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                    href={contactMailto}
                  >
                    Contacta un agente de WBKRD
                  </a>
                  .
                </div>

                <div className="text-xs text-slate-500">
                  Creado por{" "}
                  <a href="https://www.wbkrd.com/">Working by Kevo</a> @ 2025
                </div>
              </form>
            </div>

            <RightArt />
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {children}
    </div>
  );
}

function RightArt() {
  return (
    <div className="relative overflow-hidden bg-[#0E4B57] text-white p-10 hidden md:block">
      <div className="absolute inset-0 opacity-15">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-md bg-white/20"
            style={{
              width: 10 + (i % 4) * 6,
              height: 10 + (i % 4) * 6,
              left: `${(i * 17) % 90}%`,
              top: `${(i * 29) % 90}%`,
              opacity: 0.15 + (i % 5) * 0.03,
            }}
          />
        ))}
      </div>

      <div className="relative">
        {/* SVG products illustration */}
        <div className="mx-auto mt-8 w-full max-w-sm">
          <div className="rounded-3xl bg-white/10 border border-white/15 p-6">
            <InventorySvg />
            <div className="mt-5 text-center">
              <div className="text-xl font-semibold">Inventory, but clean.</div>
              <div className="mt-2 text-sm text-white/80">
                Administra tus productos, almacenes y movimientos rapido y sin
                dolor.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventorySvg() {
  return (
    <svg viewBox="0 0 520 220" className="w-full h-auto">
      {/* main box */}
      <g opacity="0.95">
        <path
          d="M115 70 L210 35 L405 70 L310 105 Z"
          fill="white"
          opacity="0.18"
        />
        <path
          d="M115 70 L310 105 L310 190 L115 155 Z"
          fill="white"
          opacity="0.12"
        />
        <path
          d="M310 105 L405 70 L405 155 L310 190 Z"
          fill="white"
          opacity="0.16"
        />
        <path
          d="M115 70 L210 35 L405 70 L310 105 Z"
          fill="none"
          stroke="white"
          opacity="0.35"
          strokeWidth="2"
        />
        <path
          d="M115 70 L310 105 L310 190 L115 155 Z"
          fill="none"
          stroke="white"
          opacity="0.25"
          strokeWidth="2"
        />
        <path
          d="M310 105 L405 70 L405 155 L310 190 Z"
          fill="none"
          stroke="white"
          opacity="0.25"
          strokeWidth="2"
        />
      </g>

      <g transform="translate(140 120)" opacity="0.9">
        <rect
          x="0"
          y="0"
          width="130"
          height="45"
          rx="10"
          fill="white"
          opacity="0.14"
        />
        {Array.from({ length: 18 }).map((_, i) => (
          <rect
            key={i}
            x={12 + i * 6}
            y={10}
            width={(i % 3) + 1}
            height={25}
            fill="white"
            opacity="0.6"
          />
        ))}
      </g>

      <g transform="translate(340 120)">
        <path
          d="M0 20 Q0 0 20 0 H95 Q115 0 115 20 V65 Q115 85 95 85 H20 Q0 85 0 65 Z"
          fill="white"
          opacity="0.14"
          stroke="white"
          strokeWidth="2"
          strokeOpacity="0.25"
        />
        <circle cx="22" cy="24" r="6" fill="white" opacity="0.45" />
        <text
          x="48"
          y="52"
          fill="white"
          opacity="0.85"
          fontSize="22"
          fontWeight="700"
        >
          -10%
        </text>
      </g>

      <path
        d="M70 200 C 130 180, 180 210, 240 190 S 350 160, 450 190"
        fill="none"
        stroke="white"
        strokeWidth="3"
        opacity="0.25"
        strokeLinecap="round"
      />

      {/* dots */}
      {[
        [70, 200],
        [240, 190],
        [450, 190],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6" fill="white" opacity="0.35" />
      ))}
    </svg>
  );
}
