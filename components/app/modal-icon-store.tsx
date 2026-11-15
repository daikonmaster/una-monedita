"use client";

import { useState, useMemo } from "react";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./Sheet";
import { GROUPS, COLORS, ALL } from "@/lib/icon-catalog";

export function IconStoreModal({
  open,
  value,
  onPick,
  onPickColor,
  onClose,
}: {
  open: boolean;
  value: { icon: string; color: string };
  onPick: (icon: string) => void;
  onPickColor?: (color: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query) return ALL.filter((n) => n.toLowerCase().includes(query));
    if (group === "all") return ALL;
    return GROUPS.find((g) => g.id === group)?.icons ?? ALL;
  }, [q, group]);

  if (!open) return null;

  return (
    <Sheet label="Tienda de iconos" onClose={onClose} maxWidth={480} style={{ display: "flex", flexDirection: "column", maxHeight: "92dvh" }}>
        <SheetHeader title="Tienda de iconos" onClose={onClose} />

        {/* search */}
        <div style={{ padding: "0 24px 16px", flex: "0 0 auto" }}>
          <div className="field-wrap" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", minHeight: 48, background: "var(--surface)", border: "1.5px solid var(--ink)" }}>
            <Icon name="Search" size={17} stroke={1.75} color="var(--text-2)" />
            <input
              aria-label="Buscar icono"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar icono…"
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 16, fontWeight: 500, color: "var(--text)" }}
            />
          </div>
        </div>

        {/* color palette */}
        {onPickColor && (
          <div style={{ padding: "0 24px 16px", display: "flex", gap: 8, flexWrap: "wrap", flex: "0 0 auto" }}>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onPickColor(c)}
                aria-label={"Color " + c}
                style={{
                  width: 36,
                  height: 36,
                  background: c,
                  border: "1.5px solid var(--ink)",
                  outline: value.color === c ? "3px solid var(--violet)" : undefined,
                  outlineOffset: value.color === c ? 2 : undefined,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        )}

        {/* group tabs */}
        {!q.trim() && (
          <div className="app-scroll" style={{ padding: "0 24px 16px", display: "flex", gap: 8, overflowX: "auto", flex: "0 0 auto" }}>
            {[{ id: "all", name: "Todos" }, ...GROUPS].map((g) => {
              const on = group === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGroup(g.id)}
                  className={on ? "eyebrow is-inv" : "eyebrow"}
                  style={{
                    padding: "0 12px",
                    minHeight: 36,
                    border: "1.5px solid var(--ink)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: on ? 700 : 500,
                    whiteSpace: "nowrap",
                    color: on ? "var(--paper)" : "var(--text)",
                    background: on ? "var(--ink)" : "transparent",
                    flex: "0 0 auto",
                  }}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}

        {/* icon grid: casillas pegadas, como plano */}
        <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            {list.map((name) => {
              const on = value.icon === name;
              return (
                <button
                  key={name}
                  onClick={() => onPick(name)}
                  className="icon-tile"
                  title={name}
                  style={{
                    aspectRatio: "1 / 1",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: "none",
                    background: on ? "var(--ink)" : "var(--surface)",
                  }}
                >
                  <Icon name={name} size={22} stroke={1.75} color={on ? "var(--paper)" : "var(--text)"} />
                </button>
              );
            })}
          </div>
          {list.length === 0 && (
            <div className="caption" style={{ textAlign: "center", padding: "24px 0" }}>Sin resultados</div>
          )}
        </div>
    </Sheet>
  );
}
