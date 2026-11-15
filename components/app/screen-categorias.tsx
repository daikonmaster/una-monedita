"use client";

import { useState } from "react";
import { useStore, type UICategory, type TxType } from "./store";
import { CatBubble, Icon } from "./Icon";
import { Segmented } from "./ui";
import { Sheet, SheetHeader, ConfirmRow } from "./Sheet";
import { IconStoreModal } from "./modal-icon-store";
import { fmt } from "@/lib/format";

type EditTarget = UICategory | { type: TxType } | null;

function CategoryEditor({ initial, onClose }: { initial: NonNullable<EditTarget>; onClose: () => void }) {
  const { addCategory, updateCategory, deleteCategory, budgets, setBudget, currency: appCurrency } = useStore();
  const existing = "id" in initial ? initial : null;
  const isNew = !existing;
  const [name, setName] = useState(existing?.name || "");
  const [type, setType] = useState<TxType>(initial.type || "expense");
  const [icon, setIcon] = useState(existing?.icon || "Tag");
  const [color, setColor] = useState(existing?.color || "#2fa86a");
  const [storeOpen, setStoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existingBudget = existing ? budgets.find((b) => b.categoryId === existing.id) : undefined;
  const [budgetLimit, setBudgetLimit] = useState(existingBudget ? String(existingBudget.limit) : "");

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const payload = { name: name.trim() || "Sin nombre", type, icon, color };
      let catId: string;
      if (existing) {
        await updateCategory(existing.id, payload);
        catId = existing.id;
      } else {
        catId = await addCategory(payload);
      }
      if (type === "expense") {
        const lim = Math.round((parseFloat(budgetLimit) || 0) * 100) / 100;
        if (lim > 0) await setBudget(catId, lim);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || busy) return;
    setBusy(true);
    try {
      await deleteCategory(existing.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet label={isNew ? "Nueva categoría" : "Editar categoría"} onClose={onClose}>
        <SheetHeader title={isNew ? "Nueva categoría" : "Editar categoría"} onClose={onClose} />

        <div style={{ padding: "8px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setStoreOpen(true)}
              title="Elegir icono"
              style={{ width: 64, height: 64, flex: "0 0 auto", cursor: "pointer", display: "grid", placeItems: "center", background: color, border: "1.5px solid var(--ink)", position: "relative" }}
            >
              <Icon name={icon} size={30} stroke={1.75} color="var(--on-cat)" />
              <span style={{ position: "absolute", right: -8, bottom: -8, width: 24, height: 24, background: "var(--ink)", display: "grid", placeItems: "center" }}>
                <Icon name="Pencil" size={12} stroke={2} color="var(--paper)" />
              </span>
            </button>
            <input
              data-autofocus
              aria-label="Nombre de la categoría"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la categoría"
              style={{ flex: 1, minWidth: 0, fontWeight: 700 }}
            />
          </div>

          <button className="btn btn-block" onClick={() => setStoreOpen(true)} style={{ borderStyle: "dashed" }}>
            <Icon name="Store" size={18} stroke={1.75} /> Elegir icono de la tienda
          </button>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Tipo</div>
            <Segmented label="Tipo de categoría" value={type} onChange={setType} options={[{ value: "expense", label: "Gasto" }, { value: "income", label: "Ingreso" }]} />
          </div>

          {type === "expense" && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Presupuesto mensual (opcional)
              </div>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="field"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                placeholder={`Sin límite (${appCurrency})`}
                style={{ fontWeight: 700 }}
              />
              <div className="caption" style={{ marginTop: 8 }}>
                Se compara contra el gasto real del mes en el Resumen.
              </div>
            </div>
          )}

          {confirmDelete ? (
            <ConfirmRow
              question="¿Eliminar esta categoría?"
              detail="Los movimientos que ya la usan se conservan."
              busy={busy}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={remove}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {existing && (
                <button onClick={() => setConfirmDelete(true)} disabled={busy} className="btn" style={{ width: 52, height: 52, padding: 0, flex: "0 0 auto" }} aria-label="Eliminar">
                  <Icon name="Trash2" size={20} stroke={1.75} color="var(--text)" />
                </button>
              )}
              <button className="btn btn-primary" onClick={save} disabled={busy} style={{ flex: 1, minHeight: 52 }}>
                {isNew ? "Crear categoría" : "Guardar cambios"}
              </button>
            </div>
          )}
        </div>
      </Sheet>
      <IconStoreModal
        open={storeOpen}
        value={{ icon, color }}
        onPick={(ic) => { setIcon(ic); setStoreOpen(false); }}
        onPickColor={(c) => setColor(c)}
        onClose={() => setStoreOpen(false)}
      />
    </>
  );
}

function CatCard({ cat, limit, onClick }: { cat: UICategory; limit?: number; onClick: () => void }) {
  const { currency } = useStore();
  return (
    <button
      onClick={onClick}
      className="cat-card"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", minHeight: 44, background: "var(--surface)", border: "1.5px solid var(--ink)", cursor: "pointer", fontFamily: "inherit" }}
    >
      <CatBubble icon={cat.icon} color={cat.color} size={52} stroke={1.75} />
      <div style={{ fontWeight: 500, fontSize: 12, color: "var(--text)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{cat.name}</div>
      {limit !== undefined && limit > 0 && (
        <div className="caption num" style={{ fontSize: 11, lineHeight: "14px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fmt(limit, currency)}
        </div>
      )}
    </button>
  );
}

function Section({
  title,
  items,
  limits,
  onEdit,
  onNew,
}: {
  title: string;
  items: UICategory[];
  limits: Record<string, number>;
  onEdit: (c: UICategory) => void;
  onNew: (type: TxType) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="eyebrow bracket" style={{ margin: "0 0 16px" }}>{title}</div>
      <div className="cat-grid">
        {items.map((c) => (
          <CatCard key={c.id} cat={c} limit={limits[c.id]} onClick={() => onEdit(c)} />
        ))}
        <button
          onClick={() => onNew(title === "Ingresos" ? "income" : "expense")}
          className="cat-card"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 8px", minHeight: 44, background: "transparent", border: "1.5px dashed var(--ink)", cursor: "pointer", fontFamily: "inherit" }}
        >
          <div className="display" aria-hidden="true" style={{ fontSize: 40, lineHeight: 1, color: "var(--text)" }}>+</div>
          <div style={{ fontWeight: 500, fontSize: 12, color: "var(--text-2)" }}>Nueva</div>
        </button>
      </div>
    </div>
  );
}

export function Categorias() {
  const { categories, budgets } = useStore();
  const [editing, setEditing] = useState<EditTarget>(null);

  const expenses = categories.filter((c) => c.type === "expense");
  const incomes = categories.filter((c) => c.type === "income");
  const limits: Record<string, number> = {};
  for (const b of budgets) if (b.categoryId) limits[b.categoryId] = b.limit;

  return (
    <div className="app-scroll" style={{ height: "100%", overflowY: "auto", padding: "8px 16px 24px" }}>
      <Section title="Gastos" items={expenses} limits={limits} onEdit={setEditing} onNew={(type) => setEditing({ type })} />
      <Section title="Ingresos" items={incomes} limits={limits} onEdit={setEditing} onNew={(type) => setEditing({ type })} />
      {editing && <CategoryEditor initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
