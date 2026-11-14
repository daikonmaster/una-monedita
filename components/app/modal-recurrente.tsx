"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useStore, failureText, type UISub, type TxType, type NewSubInput } from "./store";
import { CatBubble, Icon } from "./Icon";
import { Sheet, SheetHeader, ConfirmRow } from "./Sheet";
import { Segmented } from "./ui";
import { firstChargeDate, withDueDay, todayISO } from "@/lib/recurrence";
import { fmt } from "@/lib/format";
import type { Frequency } from "@/lib/notion/schemas";

export type EditTarget = UISub | { type: TxType } | null;

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "Mensual", label: "Mensual" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Semestral", label: "Semestral" },
  { value: "Anual", label: "Anual" },
  { value: "Semanal", label: "Semanal" },
  { value: "Diaria", label: "Diaria" },
  { value: "Bimestral", label: "Bimestral" },
  { value: "Personalizada", label: "Personalizada" },
];

const HAS_DUE_DAY: Frequency[] = ["Mensual", "Bimestral", "Trimestral", "Semestral", "Anual"];

function FreqPills({ value, onChange }: { value: Frequency; onChange: (v: Frequency) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {FREQ_OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              minHeight: 40,
              padding: "0 12px",
              border: "1.5px solid var(--ink)",
              background: on ? "var(--ink)" : "var(--surface)",
              color: on ? "var(--paper)" : "var(--text)",
              fontWeight: on ? 700 : 500,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="eyebrow">{label}</div>
      {children}
    </div>
  );
}


export function SubEditor({
  initial,
  onClose,
  onTypeHint,
}: {
  initial: NonNullable<EditTarget>;
  onClose: () => void;
  onTypeHint?: (t: TxType) => void;
}) {
  const { categories, currency: appCurrency, addSubscription, updateSubscription, deleteSubscription, subPayments } = useStore();
  const existing = "id" in initial ? initial : null;
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<TxType>(existing?.type ?? initial.type ?? "expense");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [catId, setCatId] = useState<string | null>(existing?.cat ?? null);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "Mensual");
  const [customIntervalDays, setCustomIntervalDays] = useState(existing?.customIntervalDays ? String(existing.customIntervalDays) : "30");
  const [dueDay, setDueDay] = useState(existing?.dueDay ? String(existing.dueDay) : "");
  // Próximo vencimiento: un fijo nuevo lo deriva del día del mes (desde hoy);
  // uno existente conserva el suyo — cambiar la frecuencia nunca lo mueve (eso
  // fue lo que rompía Alquiler) y cambiar el día del mes lo retargetea dentro
  // del mismo mes (handleDueDayChange), sin perder el historial de pagos.
  const [nextChargeDate, setNextChargeDate] = useState(existing?.nextChargeDate?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cats = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const payments = useMemo(() => (existing ? subPayments(existing.id) : []), [existing, subPayments]);

  const derivedFirstCharge = firstChargeDate(
    todayISO(),
    frequency,
    frequency === "Personalizada" ? Number(customIntervalDays) || 30 : undefined,
    HAS_DUE_DAY.includes(frequency) && dueDay ? Number(dueDay) : undefined
  );
  const effectiveNext = existing ? nextChargeDate : derivedFirstCharge;

  function handleDueDayChange(v: string) {
    setDueDay(v);
    if (existing && HAS_DUE_DAY.includes(frequency) && nextChargeDate) {
      const n = parseInt(v, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 31) {
        setNextChargeDate(withDueDay(nextChargeDate, n));
      }
    }
  }

  // corre una acción del editor: cierra si sale bien, muestra el motivo si falla
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      console.error(err);
      setError(failureText(err, "No se pudo guardar"));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (!amt || amt <= 0) {
      setError("Ingresá un monto");
      return;
    }
    const payload: NewSubInput = {
      name: name.trim() || "Sin nombre",
      type,
      amount: amt,
      currency: appCurrency,
      frequency,
      customIntervalDays: frequency === "Personalizada" ? Number(customIntervalDays) || 30 : undefined,
      dueDay: HAS_DUE_DAY.includes(frequency) && dueDay ? Number(dueDay) : undefined,
      startDate: existing?.startDate ?? todayISO(),
      nextChargeDate: effectiveNext || undefined,
      cat: catId,
    };
    await run(() => (existing ? updateSubscription(existing.id, payload) : addSubscription(payload)));
  }

  async function togglePause() {
    if (!existing) return;
    await run(() => updateSubscription(existing.id, { status: existing.status === "Pausada" ? "Activa" : "Pausada" }));
  }

  async function remove() {
    if (!existing) return;
    await run(() => deleteSubscription(existing.id));
  }

  return (
    <Sheet label={isNew ? "Nuevo fijo" : "Editar fijo"} onClose={onClose} maxWidth={480} style={{ maxHeight: "94dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <SheetHeader title={isNew ? "Nuevo fijo" : "Editar fijo"} onClose={onClose} />

        <div
          className="app-scroll"
          style={{
            padding: "8px 16px calc(16px + env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
          }}
        >
          <Field label="Tipo">
            <Segmented
              value={type}
              onChange={(v) => {
                setType(v);
                setCatId(null);
                onTypeHint?.(v);
              }}
              options={[{ value: "expense", label: "Gasto" }, { value: "income", label: "Ingreso" }]}
            />
          </Field>

          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gimnasio, Claude, dominio…" className="field" />
          </Field>

          <Field label="Monto">
            <input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="field" />
          </Field>

          {cats.length > 0 && (
            <Field label="Categoría">
              <div className="cat-grid" style={{ gap: 8 }}>
                {cats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatId(c.id)}
                    className="cat-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "16px 8px",
                      minWidth: 0,
                      background: "var(--surface)",
                      border: "1.5px solid var(--ink)",
                      outline: catId === c.id ? "3px solid var(--violet)" : "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <CatBubble icon={c.icon} color={c.color} size={44} stroke={1.75} active={catId === c.id} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Frecuencia">
            <FreqPills value={frequency} onChange={setFrequency} />
          </Field>

          {frequency === "Personalizada" && (
            <Field label="Cada cuántos días">
              <input type="number" min={1} value={customIntervalDays} onChange={(e) => setCustomIntervalDays(e.target.value)} className="field" />
            </Field>
          )}

          {HAS_DUE_DAY.includes(frequency) && (
            <Field label="Día del mes (aprox.)">
              <input type="number" min={1} max={31} value={dueDay} onChange={(e) => handleDueDayChange(e.target.value)} placeholder="Ej: 14" className="field" />
              <div className="caption">
                Si el mes no tiene ese día (ej. 31 en febrero), vence el último día del mes.
              </div>
            </Field>
          )}

          {existing && (
            <Field label="Pagos registrados">
              {payments.length === 0 ? (
                <div className="caption">
                  Todavía no registraste pagos. Tocá ✓ en la lista el día que pagues o te debiten.
                </div>
              ) : (
                <div className="card" style={{ padding: 0 }}>
                  {payments.slice(0, 5).map((p) => (
                    <div key={p.id} className="row" style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 16px", fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
                      <span>{p.date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="amount" style={{ color: "var(--text)" }}>{fmt(p.amount, existing.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          )}

          {error && (
            <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: "var(--expense)", lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          {confirmDelete ? (
            <ConfirmRow
              question={`¿Eliminar este fijo?`}
              detail="Los movimientos ya registrados se conservan."
              busy={busy}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={remove}
            />
          ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {existing && (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="icon-btn"
                  style={{ width: 48, height: 48, border: "1.5px solid var(--ink)", flex: "0 0 auto" }}
                  aria-label="Eliminar"
                >
                  <Icon name="Trash2" size={20} stroke={1.75} color="var(--expense)" />
                </button>
                <button
                  onClick={togglePause}
                  disabled={busy}
                  className="icon-btn"
                  style={{ width: 48, height: 48, border: "1.5px solid var(--ink)", flex: "0 0 auto" }}
                  aria-label={existing.status === "Pausada" ? "Reanudar" : "Pausar"}
                  title={existing.status === "Pausada" ? "Reanudar" : "Pausar"}
                >
                  <Icon name={existing.status === "Pausada" ? "PlayCircle" : "PauseCircle"} size={20} stroke={1.75} color="var(--text)" />
                </button>
              </>
            )}
            <button onClick={save} disabled={busy} className="btn btn-primary" style={{ flex: 1, minHeight: 48 }}>
              {isNew ? "Crear fijo" : "Guardar cambios"}
            </button>
          </div>
          )}
        </div>
    </Sheet>
  );
}
