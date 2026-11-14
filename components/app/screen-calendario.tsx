"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore, type UICategory, type UITx } from "./store";
import { CatBubble, Icon } from "./Icon";
import { StateView, MonthNav, MONTHS_FULL } from "./ui";
import { signedColor } from "./balance";
import { useElementSize } from "./useElementSize";
import { fmt, fmtShort } from "@/lib/format";
import { addDays, startOfDay } from "@/lib/date-range";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function useIsWide(bp = 760) {
  const [w, setW] = useState(false);
  useEffect(() => {
    const on = () => setW(window.innerWidth > bp);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return w;
}

function DayRow({ x, cat, onClick }: { x: UITx; cat: UICategory; onClick: () => void }) {
  const { currency } = useStore();
  const inc = cat.type === "income";
  return (
    <button onClick={onClick} className="row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", minHeight: 44, width: "100%", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
      <CatBubble icon={cat.icon} color={cat.color} size={40} stroke={1.75} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{x.note || cat.name}</div>
        <div className="caption" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
      </div>
      <span className="amount" style={{ fontSize: 14, whiteSpace: "nowrap", flex: "0 0 auto", color: inc ? "var(--income)" : "var(--expense)" }}>
        {inc ? "+ " : "− "}
        {fmt(x.amount, currency)}
      </span>
    </button>
  );
}

export function Calendario() {
  const { transactions, byId, month, year, sim, setSim, openEntry, openEdit, mode, currency, balanceBefore } = useStore();
  const autoWide = useIsWide();
  const wide = mode ? mode === "desktop" : autoWide;

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.getFullYear() === year && t.date.getMonth() === month),
    [transactions, year, month]
  );
  const byDay = useMemo(() => {
    const m: Record<number, UITx[]> = {};
    monthTx.forEach((t) => {
      const d = t.date.getDate();
      (m[d] = m[d] || []).push(t);
    });
    return m;
  }, [monthTx]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const rows = Math.ceil((firstWeekday + daysInMonth) / 7);

  // Tamaño de celda para que la grilla completa entre sin scroll: se mide el alto
  // real del contenedor (ya sin cabecera ni nav) y se le resta lo que ocupan
  // MonthNav, el resumen del mes, la fila de días y un mínimo para el detalle.
  // (callback ref: se engancha aunque el primer render haya sido un estado de carga)
  const [boxRef, box] = useElementSize();
  const boxH = box.height;
  const gap = 1;
  const reserved = wide ? 250 : 320;
  const cellMax = wide ? 96 : 40;
  const cellPx = boxH ? Math.max(26, Math.min((boxH - reserved - (rows - 1) * gap) / rows, cellMax)) : 36;
  const gridMaxWidth = `${Math.round(cellPx * 7 + gap * 6 + 3)}px`;

  const monthKey = `${year}-${month}`;
  const firstWithTx = useMemo(
    () => Object.keys(byDay).map(Number).sort((a, b) => a - b)[0] || 1,
    [byDay]
  );
  const [picked, setPicked] = useState<{ key: string; day: number } | null>(null);
  const selDay = Math.min(picked && picked.key === monthKey ? picked.day : firstWithTx, daysInMonth);
  const setSel = (d: number) => setPicked({ key: monthKey, day: d });

  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  const dayTx = (byDay[selDay] || []).slice().sort((a, b) => b.amount - a.amount);
  let dInc = 0;
  let dExp = 0;
  dayTx.forEach((t) => {
    if (t.transfer) return;
    if (t.type === "income") dInc += t.amount;
    else dExp += t.amount;
  });
  let mInc = 0;
  let mExp = 0;
  monthTx.forEach((t) => {
    if (t.transfer) return;
    if (t.type === "income") mInc += t.amount;
    else mExp += t.amount;
  });
  const monthNet = mInc - mExp;
  // Saldo del mes y del día (null mientras el historial no esté listo). El mes en curso se cuenta hasta hoy, igual que el
  // "Disponible hoy" del Resumen; un mes pasado, al cierre; uno futuro, previsto.
  const tomorrow = addDays(startOfDay(today), 1);
  const monthIsFuture = new Date(year, month, 1).getTime() > today.getTime();
  const monthClosing = balanceBefore(isThisMonth ? tomorrow : new Date(year, month + 1, 1));
  const monthClosingLabel = isThisMonth ? "Disponible hoy" : monthIsFuture ? "Saldo previsto" : "Saldo al cierre";
  const dayNet = dInc - dExp;
  const dayClosing = balanceBefore(new Date(year, month, selDay + 1));
  const dayClosingLabel = new Date(year, month, selDay).getTime() > today.getTime() ? "Saldo previsto" : "Saldo al cierre";

  if (sim === "loading") return <StateView kind="loading" />;
  if (sim === "error") return <StateView kind="error" onRetry={() => setSim("normal")} />;

  function DayCell({ d }: { d: number }) {
    const txs = byDay[d] || [];
    const on = d === selDay;
    const isToday = isThisMonth && d === today.getDate();
    const cellNet = txs.reduce((n, t) => (t.transfer ? n : n + (t.type === "income" ? t.amount : -t.amount)), 0);
    const hasInc = txs.some((t) => !t.transfer && t.type === "income");
    const hasExp = txs.some((t) => !t.transfer && t.type !== "income");
    return (
      <button
        onClick={() => setSel(d)}
        className="cal-cell"
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          minWidth: 0,
          padding: wide ? 6 : 3,
          cursor: "pointer",
          fontFamily: "inherit",
          border: "none",
          background: "var(--surface)",
          color: txs.length ? "var(--text)" : "var(--text-2)",
          outline: on ? "3px solid var(--violet)" : "none",
          outlineOffset: -3,
          zIndex: on ? 1 : 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          textAlign: "left",
        }}
      >
        <span
          className="num"
          style={{
            fontSize: wide ? 13 : 12,
            lineHeight: 1.2,
            padding: isToday ? "0 4px" : 0,
            background: isToday ? "var(--ink)" : "transparent",
            color: isToday ? "var(--paper)" : "inherit",
          }}
        >
          {d}
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0, maxWidth: "100%" }}>
          {wide && cellNet !== 0 && (
            <span className="num tnum" style={{ fontSize: 11, lineHeight: 1.2, whiteSpace: "nowrap", color: signedColor(cellNet) }}>
              {cellNet < 0 ? "−" : "+"}
              {fmtShort(Math.abs(cellNet), currency)}
            </span>
          )}
          <span style={{ display: "flex", gap: 3, height: 6 }}>
            {hasInc && <span style={{ width: 6, height: 6, background: "var(--income)" }} />}
            {hasExp && <span style={{ width: 6, height: 6, background: "var(--expense)" }} />}
          </span>
        </span>
      </button>
    );
  }

  // Celdas vacías (fuera del mes): rellenan la grilla para que las hairlines cierren
  const trailing = rows * 7 - firstWeekday - daysInMonth;
  const blankCell = (k: string) => <div key={k} style={{ background: "var(--bg)", aspectRatio: "1 / 1" }} />;
  const grid = (
    <div style={{ width: "100%", maxWidth: gridMaxWidth, margin: "0 auto", border: "1.5px solid var(--ink)", background: "var(--surface)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1.5px solid var(--ink)" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="eyebrow" style={{ textAlign: "center", fontSize: 11, padding: "6px 0" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap, background: "var(--line)" }}>
        {Array.from({ length: firstWeekday }).map((_, i) => blankCell("b" + i))}
        {Array.from({ length: daysInMonth }).map((_, i) => (
          <DayCell key={i + 1} d={i + 1} />
        ))}
        {Array.from({ length: trailing }).map((_, i) => blankCell("t" + i))}
      </div>
    </div>
  );

  const summary = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <div className="card" style={{ flex: "1 1 140px", minWidth: 0, padding: "8px 12px" }}>
        <div className="eyebrow">Balance mensual</div>
        <div className="display" style={{ fontSize: 22, marginTop: 4, color: signedColor(monthNet) }}>{fmt(monthNet, currency, { sign: true })}</div>
      </div>
      {monthClosing !== null && (
        <div className="card" style={{ flex: "1 1 140px", minWidth: 0, padding: "8px 12px" }}>
          <div className="eyebrow">{monthClosingLabel}</div>
          <div className="display" style={{ fontSize: 22, marginTop: 4, color: monthClosing < 0 ? "var(--expense)" : "var(--text)" }}>{fmt(monthClosing, currency)}</div>
        </div>
      )}
    </div>
  );

  const dateObj = new Date(year, month, selDay);
  const detail = (
    <div style={{ display: "flex", flexDirection: "column", height: wide ? "100%" : "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="eyebrow">{WEEKDAYS_FULL[dateObj.getDay()]}</div>
          <div className="display" style={{ fontSize: 28, marginTop: 4, whiteSpace: "nowrap" }}>
            {selDay} de {MONTHS_FULL[month].toLowerCase()}
          </div>
        </div>
        <button
          onClick={() => openEntry("expense", new Date(year, month, selDay))}
          className="btn btn-primary fab-btn"
          aria-label="Agregar movimiento en este día"
          style={{ width: 44, padding: 0, flex: "0 0 auto" }}
        >
          <Icon name="Plus" size={22} stroke={1.75} color="var(--paper)" />
        </button>
      </div>

      {(dayTx.length > 0 || dayClosing !== null) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {dayTx.length > 0 && (
            <div className="card" style={{ flex: "1 1 120px", minWidth: 0, padding: "8px 12px" }}>
              <div className="eyebrow">Balance del día</div>
              <div className="amount tnum" style={{ fontSize: 16, color: signedColor(dayNet) }}>{fmt(dayNet, currency, { sign: true })}</div>
            </div>
          )}
          {dayClosing !== null && (
            <div className="card" style={{ flex: "1 1 120px", minWidth: 0, padding: "8px 12px" }}>
              <div className="eyebrow">{dayClosingLabel}</div>
              <div className="amount tnum" style={{ fontSize: 16, color: dayClosing < 0 ? "var(--expense)" : "var(--text)" }}>{fmt(dayClosing, currency)}</div>
            </div>
          )}
        </div>
      )}

      {dayTx.length > 0 ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {dInc > 0 && (
              <div className="card" style={{ flex: "1 1 120px", minWidth: 0, padding: "8px 12px" }}>
                <div className="eyebrow">Ingresos</div>
                <div className="amount tnum" style={{ fontSize: 16, color: "var(--income)" }}>{fmt(dInc, currency)}</div>
              </div>
            )}
            {dExp > 0 && (
              <div className="card" style={{ flex: "1 1 120px", minWidth: 0, padding: "8px 12px" }}>
                <div className="eyebrow">Gastos</div>
                <div className="amount tnum" style={{ fontSize: 16, color: "var(--expense)" }}>{fmt(dExp, currency)}</div>
              </div>
            )}
          </div>
          <div className="app-scroll" style={{ flex: wide ? 1 : "none", minHeight: 0, overflowY: wide ? "auto" : "visible" }}>
            <div style={{ border: "1.5px solid var(--ink)", background: "var(--surface)" }}>
              {dayTx.map((x) => {
                const c = x.cat ? byId[x.cat] : null;
                if (!c) return null;
                return <DayRow key={x.id} x={x} cat={c} onClick={() => openEdit(x)} />;
              })}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "32px 16px", gap: 16, flex: wide ? 1 : "none" }}>
          <div style={{ width: 60, height: 60, display: "grid", placeItems: "center", background: "var(--bg-2)", border: "1.5px solid var(--ink)" }}>
            <Icon name="CalendarDays" size={28} stroke={1.5} color="var(--text-2)" />
          </div>
          <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text-2)" }}>Sin movimientos este día</div>
          <button onClick={() => openEntry("expense", new Date(year, month, selDay))} className="btn">
            Agregar movimiento
          </button>
        </div>
      )}
    </div>
  );

  if (wide) {
    return (
      <div ref={boxRef} style={{ height: "100%", display: "flex", flexDirection: "column", padding: "24px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div className="sec-label">/03 — Calendario</div>
            <h1 className="display" style={{ fontSize: 56, margin: "8px 0 16px" }}>Calendario</h1>
          </div>
          <div style={{ marginBottom: 16 }}>
            <MonthNav center={false} />
          </div>
        </div>
        <div style={{ marginBottom: 16, maxWidth: 420 }}>{summary}</div>
        <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{grid}</div>
          <div className="card" style={{ width: 360, flex: "0 0 auto", padding: 16, display: "flex", flexDirection: "column" }}>
            {detail}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", padding: "4px 16px 0" }}>
      <div style={{ display: "flex", justifyContent: "center", margin: "2px 0 8px", flex: "0 0 auto" }}><MonthNav /></div>
      <div style={{ flex: "0 0 auto", marginBottom: 8 }}>{summary}</div>
      <div style={{ flex: "0 0 auto" }}>{grid}</div>
      <div style={{ height: 1, background: "var(--line)", margin: "16px 0", flex: "0 0 auto" }} />
      <div className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 16 }}>{detail}</div>
    </div>
  );
}
