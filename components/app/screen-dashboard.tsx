"use client";

import { useStore, type TxType } from "./store";
import { CatBubble, Icon } from "./Icon";
import { Donut } from "./Donut";
import { PeriodPills, RangeNav, CenterBalance, StateView, BudgetAmount, BudgetBar } from "./ui";
import { Monedero, BalanceCard, PeriodSummary } from "./balance";
import { useElementSize } from "./useElementSize";
import { fmt, fmtShort } from "@/lib/format";
import { daysBetween, isFullMonthRange, rangeLabel as formatRangeLabel } from "@/lib/date-range";
import { budgetState } from "@/lib/budget";

// Tamaño del anillo entre min y max que entre en el contenedor: el anillo de
// 332px fijo no entraba en un iPhone chico (375×667).
function useFit(min: number, max: number) {
  const [ref, box] = useElementSize();
  const size = box.width ? Math.round(Math.max(min, Math.min(max, box.width - 24, box.height - 8))) : max;
  return [ref, size] as const;
}

function donutLabel(focus: TxType, breakdown: { name: string; pct: number }[]): string {
  const head = focus === "expense" ? "Gastos por categoría" : "Ingresos por categoría";
  return `${head}: ${breakdown.map((b) => `${b.name} ${Math.round(b.pct * 100)} %`).join(", ")}`;
}

function Ring({ size }: { size: number }) {
  const { breakdown, focus } = useStore();
  const ring = breakdown.slice(0, 8);
  const k = size / 332;
  const bubble = Math.round(46 * k);
  const R = size / 2 - bubble * 0.65;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      {ring.map((b, i) => {
        const ang = ((-90 + i * (360 / Math.max(ring.length, 1))) * Math.PI) / 180;
        const x = size / 2 + R * Math.cos(ang);
        const y = size / 2 + R * Math.sin(ang);
        return (
          <div key={b.cat} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <CatBubble icon={b.icon} color={b.color} size={bubble} stroke={2} title={b.name} />
            <div className="num" style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4 }}>
              <span className="sr-only">{b.name} </span>
              {Math.round(b.pct * 100)}%
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <Donut
          segments={breakdown.map((b) => ({ value: b.total, color: b.color, cat: b.cat }))}
          size={Math.round(196 * k)}
          thickness={Math.max(16, Math.round(22 * k))}
          label={donutLabel(focus, breakdown)}
        >
          <CenterBalance scale={0.92 * k} />
        </Donut>
      </div>
    </div>
  );
}

export function LegendList({ limit = 99, compact = false }: { limit?: number; compact?: boolean }) {
  const { breakdown, setScreen, currency, budgets, range, focus } = useStore();
  const showBudgets = focus === "expense" && isFullMonthRange(range);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {breakdown.slice(0, limit).map((b, i) => {
        const budget = showBudgets ? budgets.find((bd) => bd.categoryId === b.cat) : undefined;
        const state = budget && budget.limit > 0 ? budgetState(b.total, budget.limit, budget.alertAt80) : null;
        const over = state?.level === "over";
        const near = state?.level === "near";
        const pct = Math.round((state?.ratio ?? b.pct) * 100);
        const pctInner = (
          <>
            {pct}%
            {over && <span className="sr-only"> del presupuesto, superado</span>}
            {near && <span className="sr-only"> del presupuesto, cerca del límite</span>}
          </>
        );
        return (
          <button
            key={b.cat}
            onClick={() => setScreen("movimientos")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: compact ? "8px 4px" : "12px 4px",
              minHeight: 44,
              border: "none",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              width: "100%",
            }}
          >
            <CatBubble icon={b.icon} color={b.color} size={compact ? 34 : 40} stroke={2} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text)", minWidth: 0, overflowWrap: "anywhere" }}>{b.name}</span>
                <span style={{ fontSize: 13, flex: "0 0 auto" }}>
                  {budget && state ? (
                    <BudgetAmount spent={b.total} limit={budget.limit} level={state.level} />
                  ) : (
                    <span className="num tnum" style={{ color: "var(--text)", fontSize: 13 }}>{fmt(b.total, currency)}</span>
                  )}
                </span>
              </div>
              {state ? (
                <BudgetBar ratio={state.ratio} level={state.level} height={8} />
              ) : (
                <div className="track" style={{ height: 8 }}>
                  <div className="fill" style={{ width: b.pct * 100 + "%", background: b.color }} />
                </div>
              )}
            </div>
            {over || near ? (
              <span className={over ? "tag inv" : "tag"} style={{ flex: "0 0 auto" }}>{pctInner}</span>
            ) : (
              <span className="num" style={{ fontSize: 12, color: "var(--text-2)", minWidth: 40, textAlign: "right", flex: "0 0 auto" }}>{pctInner}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StatTile({ label, value, color = "var(--text)", icon }: { label: string; value: string; color?: string; icon?: string }) {
  return (
    <div className="card" style={{ flex: "1 1 130px", minWidth: 0 }}>
      <div className="eyebrow">{label}</div>
      <div className="display" style={{ fontSize: 24, color, marginTop: 8, display: "flex", alignItems: "center", gap: 8, overflowWrap: "anywhere" }}>
        {icon && <Icon name={icon} size={20} stroke={1.75} color={color} />}
        {value}
      </div>
    </div>
  );
}

// Comparativa contra el período anterior equivalente + promedio diario, y
// proyección a fin de mes cuando el rango elegido es el mes en curso. Todo
// sobre el monto del tipo (gasto/ingreso) en foco.
function ComparativeStats() {
  const { totals, prevTotals, prevRange, range, period, currency, focus } = useStore();
  const days = daysBetween(range.start, range.end);
  const isExpense = focus === "expense";
  const focusTotal = totals[focus];
  const prevFocusTotal = prevTotals[focus];

  // El promedio se calcula sobre los días YA transcurridos del rango, no sobre
  // su largo total: si no, en el mes en curso se divide por 31 desde el día 1 y
  // la proyección (promedio × 31) devuelve exactamente lo ya gastado.
  const now = new Date();
  const effectiveEnd = range.end > now ? now : range.end;
  const elapsedDays = Math.min(Math.max(daysBetween(range.start, effectiveEnd), 1), days);
  const avgPerDay = focusTotal / elapsedDays;

  const isCurrentMonth =
    range.start.getDate() === 1 &&
    range.start.getFullYear() === now.getFullYear() &&
    range.start.getMonth() === now.getMonth();
  const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projection = isCurrentMonth ? avgPerDay * daysInThisMonth : null;

  const deltaPct = prevFocusTotal > 0 ? ((focusTotal - prevFocusTotal) / prevFocusTotal) * 100 : null;
  // Para gasto, bajar es bueno (verde); para ingreso, subir es bueno (verde) — signo invertido.
  const good = deltaPct !== null && (isExpense ? deltaPct < 0 : deltaPct > 0);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {deltaPct !== null && (
        <StatTile
          label={`vs ${formatRangeLabel(prevRange, period)}`}
          color={good ? "var(--income)" : "var(--expense)"}
          icon={deltaPct < 0 ? "TrendingDown" : "TrendingUp"}
          value={`${Math.abs(Math.round(deltaPct))} % ${deltaPct < 0 ? "menos" : "más"}`}
        />
      )}
      <StatTile label="Promedio / día" value={fmt(avgPerDay, currency)} />
      {projection !== null && (
        <StatTile label={isExpense ? "Proyección fin de mes" : "Proyección de ingresos"} value={fmt(projection, currency)} />
      )}
    </div>
  );
}

function FitRing() {
  const [ref, size] = useFit(240, 332);
  return (
    <div ref={ref} className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", placeItems: "center" }}>
      <Ring size={size} />
    </div>
  );
}

export function DashboardMobile() {
  const { dashStyle, sim, setSim, breakdown, visibleTx, currency, budgets, range, focus, loadError, rangePending } = useStore();
  const showBudgets = focus === "expense" && isFullMonthRange(range);
  const showMonedero = !loadError && sim === "normal";
  const donutSegments = breakdown.map((b) => ({ value: b.total, color: b.color, cat: b.cat }));
  let body;
  if (loadError) body = <StateView kind="error" onRetry={() => window.location.reload()} />;
  else if (sim === "loading" || (rangePending && visibleTx.length === 0 && sim === "normal")) body = <StateView kind="loading" />;
  else if (sim === "error") body = <StateView kind="error" onRetry={() => setSim("normal")} />;
  else if (sim === "empty" || visibleTx.length === 0) body = <StateView kind="empty" />;
  else if (breakdown.length === 0) {
    body = (
      <StateView
        kind="empty"
        title={focus === "income" ? "Sin ingresos" : "Sin gastos"}
        message={
          focus === "income"
            ? "No registraste ingresos en este período. Tocá Gastos arriba o probá con otro rango."
            : "No registraste gastos en este período. Tocá Ingresos arriba o probá con otro rango."
        }
      />
    );
  } else if (dashStyle === "A") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <FitRing />
      </div>
    );
  } else if (dashStyle === "B") {
    body = (
      <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
        <div style={{ display: "grid", placeItems: "center", padding: "6px 0 12px" }}>
          <Donut segments={donutSegments} size={188} thickness={20} label={donutLabel(focus, breakdown)}>
            <CenterBalance scale={0.9} />
          </Donut>
        </div>
        <div style={{ padding: "0 16px 12px" }}>
          <LegendList limit={8} />
        </div>
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <ComparativeStats />
        </div>
      </div>
    );
  } else {
    body = (
      <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
        <div style={{ display: "grid", placeItems: "center", padding: "2px 0 10px" }}>
          <Donut segments={donutSegments} size={176} thickness={19} label={donutLabel(focus, breakdown)}>
            <CenterBalance scale={0.86} />
          </Donut>
        </div>
        <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {breakdown.slice(0, 8).map((b) => {
            const bud = showBudgets ? budgets.find((x) => x.categoryId === b.cat) : undefined;
            const state = bud && bud.limit > 0 ? budgetState(b.total, bud.limit, bud.alertAt80) : null;
            return (
              <div key={b.cat} className="card" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                <CatBubble icon={b.icon} color={b.color} size={34} stroke={2} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                  <div style={{ fontSize: 12 }}>
                    {bud && state ? (
                      <BudgetAmount spent={b.total} limit={bud.limit} level={state.level} sep="/" short />
                    ) : (
                      <span className="num tnum" style={{ color: "var(--text-2)", fontSize: 12 }}>{`${Math.round(b.pct * 100)}% · ${fmtShort(b.total, currency)}`}</span>
                    )}
                  </div>
                  {state && <BudgetBar ratio={state.ratio} level={state.level} height={4} style={{ marginTop: 4 }} />}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <ComparativeStats />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 16px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
        <PeriodPills />
        <RangeNav />
      </div>
      <div style={{ padding: "4px 16px 8px", flex: "0 0 auto" }}>
        <PeriodSummary />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
      {showMonedero && (
        <div style={{ borderTop: "1.5px solid var(--ink)", flex: "0 0 auto" }}>
          <Monedero />
        </div>
      )}
    </div>
  );
}

export function DashboardDesktop() {
  const { breakdown, sim, setSim, visibleTx, focus, loadError, rangePending } = useStore();
  let center;
  if (loadError) center = <StateView kind="error" onRetry={() => window.location.reload()} />;
  else if (sim === "loading" || (rangePending && visibleTx.length === 0 && sim === "normal")) center = <StateView kind="loading" />;
  else if (sim === "error") center = <StateView kind="error" onRetry={() => setSim("normal")} />;
  else if (sim === "empty" || visibleTx.length === 0) center = <StateView kind="empty" />;
  else if (breakdown.length === 0) {
    center = (
      <StateView
        kind="empty"
        title={focus === "income" ? "Sin ingresos" : "Sin gastos"}
        message={
          focus === "income"
            ? "No registraste ingresos en este período. Tocá Gastos arriba o probá con otro rango."
            : "No registraste gastos en este período. Tocá Ingresos arriba o probá con otro rango."
        }
      />
    );
  } else
    center = (
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow bracket" style={{ marginBottom: 16 }}>
          {focus === "expense" ? "Gastos por categoría" : "Ingresos por categoría"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
          <Donut segments={breakdown.map((b) => ({ value: b.total, color: b.color, cat: b.cat }))} size={300} thickness={32} label={donutLabel(focus, breakdown)}>
            <CenterBalance scale={1.28} />
          </Donut>
          <div style={{ width: 320, maxWidth: "100%", flex: "0 1 320px" }}>
            <LegendList limit={8} />
          </div>
        </div>
      </div>
    );
  const showStats = !(loadError || sim === "loading" || sim === "error" || sim === "empty" || visibleTx.length === 0 || breakdown.length === 0);
  const showBalance = !loadError && sim === "normal";
  return (
    <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 32px 40px", minHeight: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="sec-label">/01 — Resumen</div>
            <h1 className="display" style={{ fontSize: 56, margin: "8px 0 0" }}>Resumen</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <RangeNav center={false} />
            <PeriodPills />
          </div>
        </div>
        {showBalance && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap", padding: 8 }}>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}><BalanceCard /></div>
            <div style={{ flex: "2 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              <PeriodSummary large />
              {showStats && <ComparativeStats />}
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>{center}</div>
      </div>
    </div>
  );
}
