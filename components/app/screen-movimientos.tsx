"use client";

import { useMemo, useState } from "react";
import { useStore, type UIBudget, type UICategory, type UITx } from "./store";
import { CatBubble, Icon } from "./Icon";
import { StateView, MONTHS, RangeNav, BudgetAmount, BudgetBar } from "./ui";
import { FiltrosModal } from "./modal-filtros";
import { fmt } from "@/lib/format";
import { budgetState, type BudgetLevel } from "@/lib/budget";
import { isFullMonthRange } from "@/lib/date-range";
import { applyTxFilter, sumTotals, activeFilterCount, EMPTY_TX_FILTER } from "@/lib/tx-filter";

function fmtDate(d: Date) {
  return d.getDate() + " " + MONTHS[d.getMonth()].toLowerCase();
}

function Row({ x, cat }: { x: UITx; cat: UICategory }) {
  const { openEdit, currency } = useStore();
  const inc = cat.type === "income";
  return (
    <button
      onClick={() => openEdit(x)}
      className="row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        minHeight: 44,
        width: "100%",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
      }}
    >
      <span className="dot" style={{ background: cat.color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{x.note || cat.name}</div>
        <div className="caption" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fmtDate(x.date)}
          {!inc && x.pay && ` · ${x.pay}`}
        </div>
      </div>
      <span className="amount" style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: 14, color: inc ? "var(--income)" : "var(--expense)" }}>
        {inc ? "+ " : "− "}
        {fmt(x.amount, currency)}
      </span>
    </button>
  );
}

interface Group {
  cat: UICategory;
  items: UITx[];
  total: number;
}

const BUDGET_STATUS: Record<BudgetLevel, string> = {
  ok: "dentro del presupuesto",
  near: "cerca del límite",
  over: "presupuesto superado",
};

// Avance de una categoría de gasto contra su presupuesto mensual. Va siempre
// visible en la tarjeta (abierta o cerrada); solo el límite lleva el color del estado.
function BudgetBlock({ spent, budget }: { spent: number; budget: UIBudget }) {
  const { ratio, level } = budgetState(spent, budget.limit, budget.alertAt80);
  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span className="eyebrow">Presupuesto</span>
        {level === "over" && (
          <span className="tag inv" aria-hidden="true">
            Superado
          </span>
        )}
        {level === "near" && (
          <span className="tag" aria-hidden="true">
            Cerca
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        <BudgetAmount spent={spent} limit={budget.limit} level={level} />
        <span className="sr-only">, {BUDGET_STATUS[level]}</span>
      </div>
      <BudgetBar ratio={ratio} level={level} />
    </div>
  );
}

function GroupCard({ g, budget }: { g: Group; budget?: UIBudget }) {
  const [open, setOpen] = useState(false);
  const { currency } = useStore();
  // categoría con presupuesto pero sin gasto en el mes: se muestra igual (con su
  // barra en cero) pero no hay nada que desplegar
  const empty = g.items.length === 0;
  const headStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    minHeight: 44,
    width: "100%",
    textAlign: "left",
    borderBottom: open ? "1.5px solid var(--ink)" : "none",
  } as const;
  const head = (
    <>
      <CatBubble icon={g.cat.icon} color={g.cat.color} size={40} stroke={1.75} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.cat.name}</div>
        <div className="caption" style={{ fontSize: 12 }}>
          {empty ? "Sin movimientos" : `${g.items.length} ${g.items.length === 1 ? "movimiento" : "movimientos"}`}
        </div>
      </div>
      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
        <div className="amount" style={{ whiteSpace: "nowrap", color: g.cat.type === "income" ? "var(--income)" : "var(--expense)" }}>
          {g.cat.type === "income" ? "+ " : "− "}
          {fmt(g.total, currency)}
        </div>
      </div>
      {!empty && <Icon name={open ? "ChevronUp" : "ChevronDown"} size={18} stroke={1.75} color="var(--text-2)" />}
    </>
  );
  return (
    <div className="card" style={{ padding: 0 }}>
      {empty ? (
        <div style={headStyle}>{head}</div>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ ...headStyle, border: "none", borderBottom: headStyle.borderBottom, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
        >
          {head}
        </button>
      )}
      {budget && <BudgetBlock spent={g.total} budget={budget} />}
      {open && (
        <div style={{ borderTop: budget ? "1px solid var(--line)" : "none" }}>
          {g.items
            .slice()
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((x) => (
              <Row key={x.id} x={x} cat={g.cat} />
            ))}
        </div>
      )}
    </div>
  );
}

// Chips de los filtros activos, uno por pieza (tipo + cada categoría), con
// botón × para quitar esa pieza sola sin abrir la hoja de Filtros.
function FilterChips() {
  const { txFilter, setTxFilter, byId } = useStore();
  const pieces: { key: string; label: string; onRemove: () => void }[] = [];

  if (txFilter.type !== "all") {
    pieces.push({
      key: "type",
      label: txFilter.type === "income" ? "Ingresos" : "Gastos",
      onRemove: () => setTxFilter({ ...txFilter, type: "all" }),
    });
  }
  txFilter.cats.forEach((id) => {
    const c = byId[id];
    if (!c) return;
    pieces.push({
      key: id,
      label: c.name,
      onRemove: () => setTxFilter({ ...txFilter, cats: txFilter.cats.filter((x) => x !== id) }),
    });
  });

  if (pieces.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 16px" }}>
      {pieces.map((p) => (
        <button
          key={p.key}
          onClick={p.onRemove}
          className="tag"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            maxWidth: "100%",
            background: "var(--surface)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {p.label}
          <Icon name="X" size={14} stroke={1.75} color="var(--text)" />
        </button>
      ))}
    </div>
  );
}

export function Movimientos() {
  const { visibleTx, byId, sim, setSim, currency, txFilter, setTxFilter, loadError, budgets, range } = useStore();
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const filterCount = activeFilterCount(txFilter);

  const filteredTx = useMemo(() => applyTxFilter(visibleTx, txFilter), [visibleTx, txFilter]);
  const filteredTotals = useMemo(() => sumTotals(filteredTx), [filteredTx]);

  // Los presupuestos son mensuales: solo se cruzan con el gasto cuando el rango
  // es un mes completo (mismo criterio que el Resumen) y no se miran solo ingresos.
  const showBudgets = isFullMonthRange(range) && txFilter.type !== "income";
  const budgetFor = (catId: string) => (showBudgets ? budgets.find((b) => b.categoryId === catId && b.limit > 0) : undefined);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <RangeNav center={false} />
      </div>
      <button
        onClick={() => setFiltrosOpen(true)}
        className={filterCount > 0 ? "btn btn-primary" : "btn"}
        style={{ position: "relative", padding: "0 12px", flex: "0 0 auto" }}
      >
        <Icon name="SlidersHorizontal" size={16} stroke={1.75} color={filterCount > 0 ? "var(--paper)" : "var(--text)"} />
        Filtros
        {filterCount > 0 && (
          <span
            className="num tnum"
            style={{ minWidth: 18, height: 18, padding: "0 4px", background: "var(--paper)", color: "var(--ink)", fontSize: 11, display: "grid", placeItems: "center" }}
          >
            {filterCount}
          </span>
        )}
      </button>
    </div>
  );

  if (loadError) return <StateView kind="error" onRetry={() => window.location.reload()} />;
  if (sim === "loading") return <StateView kind="loading" />;
  if (sim === "error") return <StateView kind="error" onRetry={() => setSim("normal")} />;
  // El header se mantiene también en vacío: sin él no hay forma de salir de un
  // período sin movimientos (ni navegar meses ni abrir Filtros) desde acá.
  if (sim === "empty" || visibleTx.length === 0) {
    return (
      <div className="app-scroll" style={{ height: "100%", overflowY: "auto", padding: "4px 16px 24px" }}>
        {header}
        <StateView kind="empty" />
        {filtrosOpen && <FiltrosModal onClose={() => setFiltrosOpen(false)} />}
      </div>
    );
  }

  if (filteredTx.length === 0) {
    return (
      <div className="app-scroll" style={{ height: "100%", overflowY: "auto", padding: "4px 16px 24px" }}>
        {header}
        <FilterChips />
        <StateView
          kind="empty"
          message="Ningún movimiento con estos filtros."
          action={{ label: "Quitar filtros", onClick: () => setTxFilter(EMPTY_TX_FILTER) }}
        />
        {filtrosOpen && <FiltrosModal onClose={() => setFiltrosOpen(false)} />}
      </div>
    );
  }

  // Con exactamente 1 categoría seleccionada la tarjeta agrupadora no aporta
  // nada (ya sabés cuál es) — se muestra una lista plana por fecha desc.
  const flat = txFilter.cats.length === 1;

  const groups: Record<string, Group> = {};
  if (!flat) {
    filteredTx.forEach((x) => {
      const c = x.cat ? byId[x.cat] : undefined;
      if (!c) return;
      if (!groups[c.id]) groups[c.id] = { cat: c, items: [], total: 0 };
      groups[c.id].items.push(x);
      groups[c.id].total += x.amount;
    });
    // categorías con presupuesto pero sin gastos en el mes: también se muestran
    // (en cero), siempre que pasen el filtro de categorías
    if (showBudgets) {
      budgets.forEach((b) => {
        const c = b.categoryId ? byId[b.categoryId] : undefined;
        if (!c || c.type !== "expense" || b.limit <= 0 || groups[c.id]) return;
        if (txFilter.cats.length > 0 && !txFilter.cats.includes(c.id)) return;
        groups[c.id] = { cat: c, items: [], total: 0 };
      });
    }
  }
  const list = Object.values(groups).sort((a, b) => {
    if ((a.cat.type === "income") !== (b.cat.type === "income")) return a.cat.type === "income" ? 1 : -1;
    return b.total - a.total;
  });
  const flatList = flat
    ? filteredTx.slice().sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];
  const flatCat = flat ? byId[txFilter.cats[0]] : undefined;
  const flatBudget = flatCat && flatCat.type === "expense" ? budgetFor(flatCat.id) : undefined;

  return (
    <div className="app-scroll" style={{ height: "100%", overflowY: "auto", padding: "4px 16px 24px" }}>
      {header}
      <FilterChips />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 16px" }}>
        {txFilter.type !== "all" ? (
          <div className="card" style={{ flex: "1 1 140px", minWidth: 0 }}>
            <div className="eyebrow">{txFilter.type === "income" ? "Ingresos" : "Gastos"}</div>
            <div className="display" style={{ fontSize: 22, marginTop: 4, color: txFilter.type === "income" ? "var(--income)" : "var(--expense)" }}>
              {fmt(txFilter.type === "income" ? filteredTotals.income : filteredTotals.expense, currency)}
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{ flex: "1 1 140px", minWidth: 0 }}>
              <div className="eyebrow">Ingresos</div>
              <div className="display" style={{ fontSize: 22, marginTop: 4, color: "var(--income)" }}>{fmt(filteredTotals.income, currency)}</div>
            </div>
            <div className="card" style={{ flex: "1 1 140px", minWidth: 0 }}>
              <div className="eyebrow">Gastos</div>
              <div className="display" style={{ fontSize: 22, marginTop: 4, color: "var(--expense)" }}>{fmt(filteredTotals.expense, currency)}</div>
            </div>
          </>
        )}
      </div>

      {flat ? (
        <>
          {flatBudget && (
            <div className="card" style={{ padding: 0, marginBottom: 16 }}>
              <BudgetBlock spent={filteredTotals.expense} budget={flatBudget} />
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            {flatList.map((x) => {
              const c = x.cat ? byId[x.cat] : undefined;
              if (!c) return null;
              return <Row key={x.id} x={x} cat={c} />;
            })}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {list.map((g) => (
            <GroupCard key={g.cat.id} g={g} budget={g.cat.type === "expense" ? budgetFor(g.cat.id) : undefined} />
          ))}
        </div>
      )}

      {filtrosOpen && <FiltrosModal onClose={() => setFiltrosOpen(false)} />}
    </div>
  );
}
