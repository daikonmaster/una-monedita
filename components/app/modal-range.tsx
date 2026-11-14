"use client";

import { useState, type CSSProperties } from "react";
import { useStore } from "./store";
import { Sheet, SheetHeader } from "./Sheet";
import {
  type DateRange,
  rangeFor,
  shiftRange,
  addDays,
  toISO,
  parseDate,
} from "@/lib/date-range";

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 8px",
  fontWeight: 700,
};

function shortcuts(): { label: string; range: DateRange }[] {
  const now = new Date();
  const mes = rangeFor("Mes", now);
  const semana = rangeFor("Semana", now);
  return [
    { label: "Hoy", range: rangeFor("Día", now) },
    { label: "Ayer", range: rangeFor("Día", addDays(now, -1)) },
    { label: "Esta semana", range: semana },
    { label: "Semana pasada", range: shiftRange(semana, "Semana", -1) },
    { label: "Este mes", range: mes },
    { label: "Mes pasado", range: shiftRange(mes, "Mes", -1) },
    { label: "Últimos 7 días", range: { start: addDays(now, -6), end: now } },
    { label: "Últimos 30 días", range: { start: addDays(now, -29), end: now } },
    { label: "Este año", range: rangeFor("Año", now) },
  ];
}

// Cuerpo del selector de rango (atajos + fechas). Se usa dentro de RangeModal y
// como vista interna del sheet de Filtros (nunca dos sheets apilados).
export function RangePicker({ onDone }: { onDone: () => void }) {
  const { range, setRange } = useStore();
  const [start, setStart] = useState(toISO(range.start));
  const [end, setEnd] = useState(toISO(range.end));

  function apply(r: DateRange) {
    setRange(r.start, r.end);
    onDone();
  }

  function applyCustom() {
    setRange(parseDate(start), parseDate(end));
    onDone();
  }

  return (
    <div
      className="app-scroll"
      style={{
        padding: "8px 20px calc(20px + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
      }}
    >
      <div>
        <div className="eyebrow bracket" style={{ marginBottom: 8 }}>Atajos</div>
        <div className="card" style={{ padding: 0 }}>
          {shortcuts().map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => apply(s.range)}
              style={{
                display: "block",
                width: "100%",
                minHeight: 44,
                padding: "0 16px",
                border: "none",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
                background: "transparent",
                color: "var(--text)",
                fontWeight: 500,
                fontSize: 13,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="eyebrow bracket" style={{ marginBottom: 8 }}>Rango personalizado</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" aria-label="Desde" className="field" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
          <span style={{ color: "var(--text-2)", fontWeight: 700 }} aria-hidden="true">–</span>
          <input type="date" aria-label="Hasta" className="field" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <button onClick={applyCustom} className="btn btn-primary btn-block">
        Aplicar
      </button>
    </div>
  );
}

export function RangeModal({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="Elegir período" onClose={onClose} style={{ maxHeight: "94dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <SheetHeader title="Elegir período" onClose={onClose} />
      <RangePicker onDone={onClose} />
    </Sheet>
  );
}
