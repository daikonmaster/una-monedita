"use client";

import { useContext, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useStore, type Period } from "./store";
import { Icon } from "./Icon";
import { RangeModal } from "./modal-range";
import { DonutInner } from "./Donut";
import { fmt, fmtShort, fitFontSize } from "@/lib/format";
import type { BudgetLevel } from "@/lib/budget";

export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
// "Personalizado" no es una opción del selector: se abre desde la etiqueta de
// RangeNav (un segmento que abre un modal rompería la semántica de selección).
const PERIOD_ITEMS: { value: Period; label: string }[] = [
  { value: "Día", label: "Día" },
  { value: "Semana", label: "Semana" },
  { value: "Mes", label: "Mes" },
  { value: "Año", label: "Año" },
];

// Único estilo de selección de la app: marco de tinta, opción elegida invertida
// (todo el estilo vive en .seg de globals.css). El estado se comunica con
// inversión + peso + aria-checked, no solo con color.
// Patrón radio de ARIA: un solo tab stop (la opción elegida, o la primera si no
// hay ninguna) y las flechas mueven la selección.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  stretch = false,
}: {
  label: string;
  options: { value: T; label: string; dot?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  stretch?: boolean;
}) {
  const current = options.findIndex((o) => o.value === value);
  const tabStop = current >= 0 ? current : 0;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : -1;
    if (!step && jump < 0) return;
    e.preventDefault();
    const from = current >= 0 ? current : 0;
    const next = jump >= 0 ? jump : (from + step + options.length) % options.length;
    onChange(options[next].value);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={"seg" + (stretch ? " stretch" : "")}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="radio" aria-checked={on} tabIndex={i === tabStop ? 0 : -1} onClick={() => onChange(o.value)}>
            {o.dot && <span aria-hidden="true" className="dot" style={{ background: o.dot }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PeriodPills() {
  const { period, setPeriod } = useStore();
  return (
    <SegmentedControl<Period>
      label="Período"
      options={PERIOD_ITEMS}
      value={period === "Personalizado" ? null : period}
      onChange={setPeriod}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label = "Opciones",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return <SegmentedControl<T> label={label} options={options} value={value} onChange={onChange} stretch />;
}

export function MonthNav({ center = true }: { center?: boolean }) {
  const { month, year, navMonth } = useStore();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: center ? "center" : "flex-start" }}>
      <button className="icon-btn" onClick={() => navMonth(-1)} aria-label="Mes anterior">
        <Icon name="ChevronLeft" size={20} stroke={2.4} color="var(--text-2)" />
      </button>
      <div style={{ minWidth: 132, textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {MONTHS_FULL[month]} <span style={{ color: "var(--text-2)" }}>{year}</span>
      </div>
      <button className="icon-btn" onClick={() => navMonth(1)} aria-label="Mes siguiente">
        <Icon name="ChevronRight" size={20} stroke={2.4} color="var(--text-2)" />
      </button>
    </div>
  );
}

// Cabecera de navegación del Resumen: ‹ [etiqueta del rango ⌄] ›. Funciona para
// los períodos fijos y el rango personalizado; tocar la etiqueta abre el selector
// de rango.
export function RangeNav({ center = true }: { center?: boolean }) {
  const { rangeLabel, navRange } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: center ? "center" : "flex-start" }}>
      <button className="icon-btn" onClick={() => navRange(-1)} aria-label="Período anterior">
        <Icon name="ChevronLeft" size={20} stroke={2.4} color="var(--text-2)" />
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Elegir período, ${rangeLabel}`}
        style={{ minWidth: 132, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", border: "1.5px solid var(--ink)", background: "var(--surface)", cursor: "pointer", fontFamily: "var(--font-mono)", color: "var(--text)", padding: "0 12px" }}
      >
        {rangeLabel}
        <Icon name="ChevronDown" size={14} stroke={2.4} color="var(--text-2)" />
      </button>
      <button className="icon-btn" onClick={() => navRange(1)} aria-label="Período siguiente">
        <Icon name="ChevronRight" size={20} stroke={2.4} color="var(--text-2)" />
      </button>
      {open && <RangeModal onClose={() => setOpen(false)} />}
    </div>
  );
}

// Centro del donut: lo que suma el anillo (gastos o ingresos del foco), sin
// repetir el saldo: el Disponible vive en un solo lugar (Monedero / BalanceCard).
// La cifra se ajusta al hueco del anillo (DonutInner); si ni así entra legible,
// muestra la versión corta (€ 12k) y deja el monto completo para lectores de pantalla.
export function CenterBalance({ scale = 1 }: { scale?: number }) {
  const { totals, currency, focus, rangeLabel } = useStore();
  const avail = useContext(DonutInner) ?? 160;
  const isExpense = focus === "expense";
  const amount = isExpense ? totals.expense : totals.income;
  const fullText = fmt(amount, currency);
  const maxPx = 40 * scale;
  const fullSize = fitFontSize(fullText, avail, maxPx, 12, 0.5);
  const useShort = fullSize < 14;
  const shortText = fmtShort(amount, currency);
  const size = useShort ? fitFontSize(shortText, avail, maxPx, 12, 0.5) : fullSize;
  const caption = rangeLabel.toLowerCase();
  return (
    <div>
      <div className="eyebrow" style={{ color: "var(--text-2)" }}>{isExpense ? "Gastos" : "Ingresos"}</div>
      <div className="display" style={{ fontSize: size, lineHeight: 1.04, color: "var(--text)", marginTop: 2, whiteSpace: "nowrap" }}>
        {useShort ? (
          <>
            <span aria-hidden="true">{shortText}</span>
            <span className="sr-only">{fullText}</span>
          </>
        ) : (
          fullText
        )}
      </div>
      <div
        className="caption"
        style={{ marginTop: 4, fontSize: fitFontSize(caption, avail, 13, 11, 0.62), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {caption}
      </div>
    </div>
  );
}

// Estado de un presupuesto (ver lib/budget.ts): ok = violeta, near = violeta con
// trama (ver .track .fill.near), over = tinta llena. El texto del límite en
// "over" va como chip invertido (ver BudgetAmount).
export const BUDGET_TEXT: Record<BudgetLevel, string> = {
  ok: "var(--text)",
  near: "var(--violet)",
  over: "var(--text)",
};
export const BUDGET_FILL: Record<BudgetLevel, string> = {
  ok: "var(--violet)",
  near: "var(--violet)",
  over: "var(--ink)",
};

// Barra de avance contra el límite. `ratio` ya viene recortado a 0..1.
export function BudgetBar({ ratio, level, height = 5, style }: { ratio: number; level: BudgetLevel; height?: number; style?: CSSProperties }) {
  const width = ratio * 100 + "%";
  return (
    <div aria-hidden="true" className="track" style={{ height: Math.max(height, 8), ...style }}>
      <div className={"fill" + (level === "near" ? " near" : level === "over" ? " over" : "")} style={{ width }} />
    </div>
  );
}

// "€ 6,20 de € 30,00": lo gastado queda neutro; el límite se marca según el
// estado (violeta cerca del tope, chip invertido al superarlo).
export function BudgetAmount({ spent, limit, level, sep = "de", short = false }: { spent: number; limit: number; level: BudgetLevel; sep?: "de" | "/"; short?: boolean }) {
  const { currency } = useStore();
  const f = short ? fmtShort : fmt;
  return (
    <span className="num tnum" style={{ whiteSpace: "nowrap" }}>
      <span style={{ color: "var(--text)" }}>{f(spent, currency)}</span>
      <span style={{ color: "var(--text-2)" }}>{sep === "de" ? " de " : " / "}</span>
      <span style={level === "over" ? { background: "var(--ink)", color: "var(--paper)", padding: "0 4px" } : { color: BUDGET_TEXT[level] }}>{f(limit, currency)}</span>
    </span>
  );
}

export function ActionButton({ kind, onClick, size = 60 }: { kind: "expense" | "income"; onClick: () => void; size?: number }) {
  const expense = kind === "expense";
  return (
    <button
      onClick={onClick}
      aria-label={expense ? "Agregar gasto" : "Agregar ingreso"}
      className="fab-btn"
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        border: "1.5px solid var(--ink)",
        cursor: "pointer",
        background: expense ? "var(--violet)" : "var(--ink)",
        color: expense ? "var(--on-violet)" : "var(--paper)",
      }}
    >
      <Icon name={expense ? "Minus" : "Plus"} size={Math.round(size * 0.46)} stroke={3} color={expense ? "var(--on-violet)" : "var(--paper)"} />
    </button>
  );
}

// Aviso flotante: bloque invertido. Los errores no se cierran solos y llevan
// botón de cierre; los éxitos desaparecen a los pocos segundos (el store los limpia).
export function Toast({ desktop }: { desktop: boolean }) {
  const { notice, dismissNotice } = useStore();
  if (!notice) return null;
  const error = notice.kind === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className="is-inv"
      style={{
        position: "fixed",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: error ? "8px 6px 8px 14px" : "11px 16px",
        border: "1.5px solid var(--ink)",
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: 13,
        width: "max-content",
        maxWidth: "min(92vw, 420px)",
        ...(desktop
          ? { right: 24, bottom: 24 }
          : { left: "50%", transform: "translateX(-50%)", top: "calc(env(safe-area-inset-top) + 12px)" }),
      }}
    >
      <Icon name={error ? "CircleAlert" : "CircleCheck"} size={18} stroke={1.75} color="var(--paper)" />
      <span aria-hidden="true" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{error ? "ERROR" : "OK"}</span>
      <span style={{ lineHeight: 1.35 }}>{notice.text}</span>
      {error && (
        <button className="icon-btn" onClick={dismissNotice} aria-label="Cerrar aviso" style={{ flex: "0 0 auto" }}>
          <Icon name="X" size={18} stroke={1.75} color="var(--paper)" />
        </button>
      )}
    </div>
  );
}

export function StateView({
  kind,
  onRetry,
  title,
  message,
  action,
}: {
  kind: "loading" | "empty" | "error";
  onRetry?: () => void;
  title?: string;
  message?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  if (kind === "loading") {
    return (
      <div role="status" aria-label="Cargando" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16, height: "100%" }}>
        <div className="skeleton-donut" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "80%", maxWidth: 320 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }
  const map: Record<string, { icon: string; title: string; body: string }> = {
    empty: { icon: "Wallet", title: "Sin movimientos", body: "No hay movimientos en este período. Tocá − para cargar un gasto o + para un ingreso." },
    error: { icon: "CloudOff", title: "No se pudo cargar", body: "Hubo un problema al traer tus datos. Revisá la conexión e intentá de nuevo." },
  };
  const s = map[kind] || map.empty;
  const primaryAction = kind === "error" ? { label: "Reintentar", onClick: onRetry ?? (() => {}) } : action;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", gap: 16, textAlign: "center", height: "100%" }}>
      <div className="hatch" style={{ position: "relative", width: 72, height: 72, border: "1.5px solid var(--ink)", display: "grid", placeItems: "center", opacity: 0.9 }}>
        <div style={{ width: 44, height: 44, background: "var(--surface)", border: "1.5px solid var(--ink)", display: "grid", placeItems: "center" }}>
          <Icon name={s.icon} size={24} stroke={1.75} color="var(--text)" />
        </div>
      </div>
      <div className="display" style={{ fontSize: 28 }}>{title ?? s.title}</div>
      <div style={{ color: "var(--text-2)", fontSize: 14, maxWidth: 300, lineHeight: 1.5 }}>{message ?? s.body}</div>
      {primaryAction && (
        <button onClick={primaryAction.onClick} className="btn btn-primary" style={{ marginTop: 8 }}>
          {primaryAction.label}
        </button>
      )}
    </div>
  );
}
