"use client";

import { useMemo, useState } from "react";
import { useStore, type UISub, type TxType } from "./store";
import { CatBubble, Icon } from "./Icon";
import { fmt, fmtDayMonth } from "@/lib/format";
import { monthlyEquivalent, monthStatus, monthCounter, type SubMonthKind } from "@/lib/recurrence";
import { SubEditor, type EditTarget } from "./modal-recurrente";
import { MONTHS_FULL } from "./ui";

// Estado de un fijo en el MES actual (ver monthStatus en lib/recurrence): el
// contador y las filas arrancan de cero al cambiar de mes porque se calculan
// contra el mes calendario, no contra "alguna vez se pagó".
function statusOf(sub: UISub, today: string): { label: string; kind: SubMonthKind } {
  const st = monthStatus(sub, today);
  const d = st.date ? fmtDayMonth(st.date) : "";
  switch (st.kind) {
    case "late":
      return { label: `Pendiente · venció ${d}`, kind: st.kind };
    case "today":
      return { label: "Pendiente · vence hoy", kind: st.kind };
    case "pending":
      return { label: `Vence ${d}`, kind: st.kind };
    case "paid":
      return { label: `${sub.type === "income" ? "Cobrado" : "Pagado"} ${d}`, kind: st.kind };
    case "later":
      return { label: `Próximo ${d}`, kind: st.kind };
    case "paused":
      return { label: "Pausado", kind: st.kind };
    default:
      return { label: "Sin fecha", kind: st.kind };
  }
}

function SubRow({ sub, today, onEdit, onPay }: { sub: UISub; today: string; onEdit: () => void; onPay: () => void }) {
  const { byId } = useStore();
  const cat = sub.cat ? byId[sub.cat] : null;
  const paused = sub.status === "Pausada";
  const st = statusOf(sub, today);
  // el ✓ se destaca cuando hay algo para registrar este mes
  const actionable = st.kind === "late" || st.kind === "today" || st.kind === "pending";
  const freq = sub.frequency !== "Mensual" ? `${sub.frequency} · ` : "";
  // chip del estado: pagado = .tag, pendiente / vencido = .tag inv, el resto texto
  const chipClass = st.kind === "paid" ? "tag" : st.kind === "late" || st.kind === "today" ? "tag inv" : null;

  return (
    <div
      className="row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 8px 8px 16px",
        opacity: paused ? 0.6 : 1,
      }}
    >
      <button
        onClick={onEdit}
        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0, color: "var(--text)" }}
      >
        <CatBubble icon={cat?.icon || "Repeat"} color={cat?.color || "#9aa0a6"} size={36} stroke={1.75} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* nombre y monto en la misma línea: el estado (chip largo) ocupa todo el ancho abajo */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</span>
            <span className="amount" style={{ color: sub.type === "income" ? "var(--income)" : "var(--expense)", flex: "0 0 auto" }}>
              {fmt(sub.amount, sub.currency)}
            </span>
          </div>
          <div className="caption" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {chipClass ? (
              <>
                {freq && <span style={{ whiteSpace: "nowrap" }}>{freq}</span>}
                <span className={chipClass} style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{st.label}</span>
              </>
            ) : (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {freq}
                {st.label}
              </span>
            )}
          </div>
        </div>
      </button>
      {sub.status === "Activa" && (
        <button
          onClick={onPay}
          className="icon-btn"
          title="Registrar pago"
          aria-label="Registrar pago"
          style={{ border: "1.5px solid var(--ink)", background: actionable ? "var(--ink)" : "transparent", flex: "0 0 auto" }}
        >
          <Icon name="Check" size={18} stroke={1.75} color={actionable ? "var(--paper)" : "var(--text)"} />
        </button>
      )}
    </div>
  );
}

export function Recurrentes() {
  const { subscriptions, openConfirmSub, currency, today } = useStore();
  const [editing, setEditing] = useState<EditTarget>(null);
  const [newType, setNewType] = useState<TxType>("expense");


  // Una sola lista: activos por próximo vencimiento, pausados al final.
  // Los cancelados no se muestran.
  const { list, activas } = useMemo(() => {
    const byDue = (a: UISub, b: UISub) => (a.nextChargeDate ?? "").localeCompare(b.nextChargeDate ?? "");
    const activas = subscriptions.filter((s) => s.status === "Activa").sort(byDue);
    const pausadas = subscriptions.filter((s) => s.status === "Pausada").sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { list: [...activas, ...pausadas], activas };
  }, [subscriptions]);

  const { paid: pagados, due } = useMemo(() => monthCounter(subscriptions, today), [subscriptions, today]);
  const monthName = MONTHS_FULL[Number(today.slice(5, 7)) - 1].toLowerCase();

  const monthlyTotal = useMemo(
    () => activas.filter((s) => s.type === "expense").reduce((sum, s) => sum + monthlyEquivalent(s.amount, s), 0),
    [activas]
  );

  const allPaid = due > 0 && pagados === due;

  return (
    <div className="app-scroll" style={{ height: "100%", overflowY: "auto", padding: "8px 16px 24px" }}>
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Gastos fijos por mes</div>
            <div className="display" style={{ fontSize: 28, color: "var(--text)", marginTop: 4 }}>
              ≈ {fmt(monthlyTotal, currency)}
            </div>
          </div>
          {due > 0 && (
            <div
              title={`Fijos de ${monthName}: ${pagados} de ${due} pagados`}
              aria-label={`Fijos de ${monthName}: ${pagados} de ${due} pagados`}
              role="status"
              className={allPaid ? "tag inv" : "tag"}
              style={{ flex: "0 0 auto" }}
            >
              {pagados}/{due} pagados
            </div>
          )}
        </div>
        {due > 0 && (
          <div className="track" style={{ marginTop: 16 }} aria-hidden="true">
            <div className="fill" style={{ width: `${Math.min(100, (pagados / due) * 100)}%` }} />
          </div>
        )}
      </div>

      {list.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          {list.map((s) => (
            <SubRow key={s.id} sub={s} today={today} onEdit={() => setEditing(s)} onPay={() => openConfirmSub(s)} />
          ))}
        </div>
      )}

      {subscriptions.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", gap: 14, textAlign: "center" }}>
          <div className="hatch" style={{ width: 76, height: 76, display: "grid", placeItems: "center", border: "1.5px solid var(--ink)" }}>
            <div style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "var(--surface)", border: "1.5px solid var(--ink)" }}><Icon name="Repeat" size={24} stroke={1.75} color="var(--text)" /></div>
          </div>
          <div className="display" style={{ fontSize: 28 }}>Sin gastos fijos</div>
          <div style={{ color: "var(--text-2)", fontSize: 14, maxWidth: 300, lineHeight: 1.5 }}>
            Agregá tus gastos fijos (alquiler, gimnasio, suscripciones) y registrá cada pago el día que lo hagas.
          </div>
        </div>
      )}

      <button onClick={() => setEditing({ type: newType })} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
        <Icon name="Plus" size={19} stroke={1.75} color="var(--paper)" /> Nuevo fijo
      </button>

      {editing && <SubEditor initial={editing} onClose={() => setEditing(null)} onTypeHint={setNewType} />}
    </div>
  );
}
