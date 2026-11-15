"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useStore, toISO, type TxType, type UITx, type UISub } from "./store";
import { CatBubble, Icon } from "./Icon";
import { Segmented, SegmentedControl } from "./ui";
import { Sheet, SheetHeader } from "./Sheet";
import { fmt, fmtDayMonth } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment";

// Último medio de pago usado en este dispositivo: viene preseleccionado al
// cargar un gasto nuevo. El modal solo se monta tras una acción del usuario,
// así que leer localStorage en el inicializador del estado es seguro.
function readLastPay(): PaymentMethod | null {
  try {
    const v = localStorage.getItem("um.pay");
    return (PAYMENT_METHODS as readonly string[]).includes(v ?? "") ? (v as PaymentMethod) : null;
  } catch {
    return null;
  }
}

// safe calculator: + − × ÷ with × ÷ precedence
function calc(expr: string): number {
  const toks = String(expr).match(/(\d+\.?\d*|[+\-−×÷])/g);
  if (!toks) return 0;
  const t = toks.map((x) => (x === "×" ? "*" : x === "÷" ? "/" : x === "−" ? "-" : x));
  while (t.length && "*/+-".includes(t[t.length - 1])) t.pop();
  if (!t.length) return 0;
  if (t[0] === "-" || t[0] === "+") t.unshift("0");
  else if (t[0] === "*" || t[0] === "/") t.shift();
  if (!t.length) return 0;
  const stack = [parseFloat(t[0]) || 0];
  for (let i = 1; i < t.length; i += 2) {
    const op = t[i];
    const n = parseFloat(t[i + 1]) || 0;
    if (op === "*") stack.push(stack.pop()! * n);
    else if (op === "/") stack.push(n === 0 ? 0 : stack.pop()! / n);
    else if (op === "+") stack.push(n);
    else if (op === "-") stack.push(-n);
  }
  return stack.reduce((a, b) => a + b, 0);
}

function Key({ label, onClick, variant, span }: { label: ReactNode; onClick: () => void; variant?: "op"; span?: number }) {
  const op = variant === "op";
  return (
    <button
      onClick={onClick}
      className={op ? "key-btn" : "key-btn display"}
      style={{
        border: 0,
        cursor: "pointer",
        fontSize: op ? 20 : 26,
        ...(op ? { fontWeight: 700 } : {}),
        background: op ? "var(--bg-2)" : "var(--surface)",
        color: "var(--text)",
        display: "grid",
        placeItems: "center",
        // 52px en teléfonos altos; en pantallas bajas (375x667) se achica para
        // que la calculadora entre sin scroll, nunca por debajo del objetivo táctil de 44px
        minHeight: "clamp(44px, 7dvh, 52px)",
        padding: 0,
        gridColumn: span ? `span ${span}` : undefined,
      }}
    >
      {label}
    </button>
  );
}

// Cuando `fromSub` está seteado, en vez de "Agregar gasto/ingreso" este
// mismo formulario registra el pago de un fijo: precarga monto/categoría/nota
// y propone hoy como fecha (editable, por si el débito fue otro día).
function EntryForm({
  initialType,
  initialDate,
  edit,
  fromSub,
}: {
  initialType: TxType;
  initialDate: string;
  edit: UITx | null;
  fromSub: UISub | null;
}) {
  const { closeEntry, categories, addTransaction, updateTransaction, deleteTransaction, confirmSubscription, currency } = useStore();
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "US$" : "$";
  const [type, setType] = useState<TxType>(initialType);
  const [expr, setExpr] = useState(edit ? String(edit.amount) : fromSub ? String(fromSub.amount) : "");
  const [catId, setCatId] = useState<string | null>(() => {
    if (edit) return edit.cat;
    if (fromSub) {
      const c = categories.find((c) => c.id === fromSub.cat);
      return c && c.type === fromSub.type ? c.id : null;
    }
    return null;
  });
  const [note, setNote] = useState(edit ? edit.note : fromSub ? fromSub.name : "");
  const [date, setDate] = useState(initialDate);
  // Cómo se pagó (solo gastos, opcional): al editar el del movimiento, si no el último usado
  const [pay, setPay] = useState<PaymentMethod | null>(() => (edit ? edit.pay : readLastPay()));
  const [panel, setPanel] = useState<"pad" | "cats">("pad");
  // confirmación dentro del propio sheet: descartar lo escrito / eliminar el movimiento
  const [confirmKind, setConfirmKind] = useState<"discard" | "delete" | null>(null);

  // Si se borra el selector de fecha nativo (iOS/Android "Borrar") queda "":
  // se usa hoy en vez de dejar el botón deshabilitado sin explicación.
  const effectiveDate = date || toISO(new Date());

  const cats = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const cat = categories.find((c) => c.id === catId);
  const hasOp = /[+\-−×÷]/.test(expr.slice(1));
  const result = calc(expr);

  function push(ch: string) {
    setExpr((e) => {
      if ("+×÷".includes(ch) || ch === "−") {
        if (e === "") return ch === "−" ? "−" : e;
        if ("+−×÷".includes(e[e.length - 1])) return e.slice(0, -1) + ch;
        return e + ch;
      }
      if (ch === ".") {
        const last = e.split(/[+\-−×÷]/).pop()!;
        if (last.includes(".")) return e;
        return e + (e === "" || "+−×÷".includes(e[e.length - 1]) ? "0." : ".");
      }
      return e + ch;
    });
  }
  function equals() {
    setExpr((e) => {
      if (!/[+\-−×÷]/.test(e.slice(1))) return e;
      const r = Math.round(calc(e) * 100) / 100;
      return r === 0 ? "" : String(r).replace("-", "−");
    });
  }
  function back() {
    setExpr((e) => e.slice(0, -1));
  }

  // optimistic: el store aplica el cambio local al instante y sincroniza en
  // background (con rollback + toast si falla), así el modal cierra sin esperar
  function confirm() {
    const amount = Math.round(result * 100) / 100;
    if (!amount || amount <= 0 || !catId) return;
    const [y, m, d] = effectiveDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d, 12);
    const payToSave = type === "expense" ? pay : null;
    if (payToSave) {
      try {
        localStorage.setItem("um.pay", payToSave);
      } catch {
        // sin storage (modo privado): solo se pierde la preselección
      }
    }
    if (fromSub) void confirmSubscription(fromSub, { date: dateObj, amount, cat: catId, note: note.trim(), pay: payToSave });
    // al editar, el medio de pago solo viaja si cambió: evita tocar el schema de Notion de balde
    else if (edit) void updateTransaction(edit.id, { cat: catId, amount, date: dateObj, note: note.trim(), ...(payToSave !== edit.pay ? { pay: payToSave } : {}) });
    else void addTransaction({ cat: catId, amount, date: dateObj, note: note.trim(), pay: payToSave });
    closeEntry();
  }

  function remove() {
    if (!edit) return;
    void deleteTransaction(edit.id);
    closeEntry();
  }

  // Escape / scrim: si hay monto o nota sin guardar, pregunta antes de descartar.
  const dirty = !edit && !fromSub && (expr !== "" || note.trim() !== "");
  function requestClose() {
    if (confirmKind) setConfirmKind(null);
    else if (panel === "cats") setPanel("pad");
    else if (dirty) setConfirmKind("discard");
    else closeEntry();
  }

  // teclado físico (desktop): dígitos, operadores, Enter, Backspace, Escape.
  // Sin array de deps a propósito: re-suscribe cada render para usar closures frescos.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || panel !== "pad" || confirmKind) return;
      // Enter sobre un botón enfocado (Cerrar, Eliminar, tipo…) activa ESE botón:
      // no tiene que guardar el movimiento de paso.
      if (e.key === "Enter" && e.target instanceof Element && e.target.closest("button, a, select")) return;
      if (/^[0-9]$/.test(e.key)) push(e.key);
      else if (e.key === "." || e.key === ",") push(".");
      else if (e.key === "+") push("+");
      else if (e.key === "-") push("−");
      else if (e.key === "*") push("×");
      else if (e.key === "/") push("÷");
      else if (e.key === "=") equals();
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") {
        if (hasOp) equals();
        else confirm();
      }
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const accent = type === "expense" ? "var(--expense)" : "var(--income)";
  // confirmar: violeta para gasto, tinta para ingreso
  const fill = type === "expense" ? "var(--violet)" : "var(--ink)";
  const onFill = type === "expense" ? "var(--on-violet)" : "var(--paper)";
  const canSave = result > 0 && !!catId;

  return (
    <Sheet label={fromSub ? "Registrar pago" : edit ? "Editar movimiento" : "Agregar movimiento"} onClose={requestClose} style={{ display: "flex", flexDirection: "column", maxHeight: "94dvh" }}>
      {confirmKind ? (
        <div style={{ padding: "24px 16px calc(16px + env(safe-area-inset-bottom))", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 className="sheet-title" style={{ margin: 0 }}>
            {confirmKind === "discard"
              ? `¿Descartar este ${type === "expense" ? "gasto" : "ingreso"}?`
              : `¿Eliminar este ${type === "expense" ? "gasto" : "ingreso"}?`}
          </h2>
          <p className="caption" style={{ margin: 0 }}>
            {confirmKind === "discard" ? "Se pierde lo que escribiste." : "No se puede deshacer."}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setConfirmKind(null)} data-autofocus className="btn" style={{ flex: 1, minHeight: 48 }}>
              {confirmKind === "discard" ? "Seguir editando" : "Cancelar"}
            </button>
            <button onClick={confirmKind === "discard" ? closeEntry : remove} className="btn btn-accent" style={{ flex: 1, minHeight: 48 }}>
              {confirmKind === "discard" ? "Descartar" : "Eliminar"}
            </button>
          </div>
        </div>
      ) : panel === "cats" ? (
        <SheetHeader title="Elegí categoría" onClose={() => (dirty ? setConfirmKind("discard") : closeEntry())} onBack={() => setPanel("pad")} backLabel="Volver al monto" />
      ) : (
        <div style={{ padding: "16px 8px 8px 16px", display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          {fromSub ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">Registrar pago</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fromSub.name}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <Segmented label="Tipo de movimiento" value={type} onChange={(v) => { setType(v); setCatId(null); }} options={[{ value: "expense", label: "Gasto" }, { value: "income", label: "Ingreso" }]} />
            </div>
          )}
          {edit && !fromSub && (
            <button className="icon-btn" onClick={() => setConfirmKind("delete")} aria-label="Eliminar" style={{ border: "1.5px solid var(--ink)" }}>
              <Icon name="Trash2" size={19} stroke={1.75} color="var(--expense)" />
            </button>
          )}
          <button className="icon-btn" onClick={requestClose} aria-label="Cerrar">
            <Icon name="X" size={22} stroke={1.75} color="var(--text)" />
          </button>
        </div>
      )}

        {confirmKind ? null : panel === "cats" ? (
          <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px" }}>
            <div className="cat-grid" style={{ gap: 8 }}>
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCatId(c.id); setPanel("pad"); }}
                  className="cat-card"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", minWidth: 0, background: "var(--surface)", border: "1.5px solid var(--ink)", outline: catId === c.id ? "3px solid var(--violet)" : "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <CatBubble icon={c.icon} color={c.color} size={48} stroke={1.75} active={catId === c.id} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="app-scroll" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ margin: "0 16px 8px", padding: "8px 12px", textAlign: "right", background: "var(--surface)", border: "1.5px solid var(--ink)", minWidth: 0 }}>
              {hasOp && <div className="tnum" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500, height: 16, lineHeight: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{expr.slice(0, 1) + expr.slice(1).replace(/×/g, " × ").replace(/÷/g, " ÷ ").replace(/\+/g, " + ").replace(/−/g, " − ").replace(/\./g, ",")} =</div>}
              <div className="display" style={{ fontSize: 48, color: result > 0 ? accent : "var(--text-2)", overflow: "hidden", whiteSpace: "nowrap" }}>
                {hasOp ? fmt(Math.round(result * 100) / 100, currency) : expr === "" ? sym + " 0" : sym + " " + expr.replace(/\./g, ",")}
              </div>
            </div>

            <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" }}>
              <button
                onClick={() => setPanel("cats")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px 4px 4px", minHeight: 48, width: "100%", background: "var(--surface)", border: "1.5px solid var(--ink)", cursor: "pointer", fontFamily: "inherit" }}
              >
                {cat ? (
                  <CatBubble icon={cat.icon} color={cat.color} size={38} stroke={1.75} />
                ) : (
                  <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", background: "var(--bg-2)", border: "1.5px dashed var(--ink)" }}>
                    <Icon name="Shapes" size={19} stroke={1.75} color="var(--text-2)" />
                  </div>
                )}
                <span style={{ flex: 1, minWidth: 0, textAlign: "left", fontWeight: 500, fontSize: 14, color: cat ? "var(--text)" : "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat ? cat.name : "Elegir categoría"}</span>
                <Icon name="ChevronRight" size={20} stroke={1.75} color="var(--text)" />
              </button>

                {type === "expense" && (
                  <SegmentedControl<PaymentMethod>
                    label="Cómo se pagó"
                    options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                    value={pay}
                    onChange={setPay}
                    stretch
                  />
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <div className="field-wrap" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", minHeight: 48, background: "var(--surface)", border: "1.5px solid var(--ink)" }}>
                    <Icon name="PenLine" size={17} stroke={1.75} color="var(--text-2)" />
                    <input aria-label="Nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 16, fontWeight: 500, color: "var(--text)" }} />
                  </div>
                  <label className="field-wrap" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", minHeight: 48, background: "var(--surface)", border: "1.5px solid var(--ink)", cursor: "pointer", minWidth: 0, flex: "0 1 auto" }}>
                    <Icon name="Calendar" size={17} stroke={1.75} color="var(--text-2)" />
                    <input type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: "none", background: "transparent", fontFamily: "inherit", fontSize: 16, fontWeight: 700, color: "var(--text)", minWidth: 0 }} />
                  </label>
                </div>
            </div>

            <div style={{ padding: "0 16px 16px", flex: "0 0 auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5, background: "var(--ink)", border: "1.5px solid var(--ink)" }}>
                <Key label="7" onClick={() => push("7")} /><Key label="8" onClick={() => push("8")} /><Key label="9" onClick={() => push("9")} /><Key label="÷" variant="op" onClick={() => push("÷")} />
                <Key label="4" onClick={() => push("4")} /><Key label="5" onClick={() => push("5")} /><Key label="6" onClick={() => push("6")} /><Key label="×" variant="op" onClick={() => push("×")} />
                <Key label="1" onClick={() => push("1")} /><Key label="2" onClick={() => push("2")} /><Key label="3" onClick={() => push("3")} /><Key label="−" variant="op" onClick={() => push("−")} />
                <Key label="," onClick={() => push(".")} /><Key label="0" onClick={() => push("0")} /><Key label={<Icon name="Delete" size={22} stroke={1.75} color="var(--text)" />} onClick={back} /><Key label="+" variant="op" onClick={() => push("+")} />
                <Key label="=" variant="op" span={4} onClick={equals} />
              </div>
              <button
                onClick={confirm}
                disabled={!canSave}
                className="btn btn-block"
                style={{ marginTop: 8, minHeight: 48, fontSize: 14, fontWeight: 700, ...(canSave ? { background: fill, color: onFill, borderColor: fill } : {}) }}
              >
                <Icon name="Check" size={20} stroke={2} color={canSave ? onFill : "var(--text-2)"} />
                {fromSub
                  ? `Registrar pago · ${fmtDayMonth(effectiveDate)}`
                  : edit
                  ? "Guardar cambios"
                  : type === "expense"
                  ? "Agregar gasto"
                  : "Agregar ingreso"}
              </button>
            </div>
          </div>
        )}
    </Sheet>
  );
}

export function NewEntryModal() {
  const { entry } = useStore();
  if (!entry.open) return null;

  if (entry.sub) {
    const s = entry.sub;
    return (
      <EntryForm
        key={"sub-" + s.id + "-" + (s.nextChargeDate ?? "none")}
        initialType={s.type}
        initialDate={toISO(new Date())}
        edit={null}
        fromSub={s}
      />
    );
  }

  const initialType: TxType = entry.edit ? entry.edit.type : entry.kind || "expense";
  const initialDate = entry.edit ? toISO(entry.edit.date) : entry.date ? toISO(entry.date) : toISO(new Date());
  const formKey = entry.edit ? "edit-" + entry.edit.id : "new-" + initialType + "-" + initialDate;
  return <EntryForm key={formKey} initialType={initialType} initialDate={initialDate} edit={entry.edit} fromSub={null} />;
}
