// Estado de un presupuesto mensual contra el gasto real. Puro, sin React: lo
// comparten el Resumen y Movimientos para que el color de una categoría sea
// siempre el mismo.

export type BudgetLevel = "ok" | "near" | "over";

// over si se pasó del límite (justo en el límite todavía no); near si el
// presupuesto tiene alerta al 80% y el gasto llegó a ese punto; si no, ok.
// `ratio` es el avance recortado a 0..1 para dibujar la barra. Límite en 0 (o
// negativo) no tiene sentido como presupuesto: se trata como sin avance.
export function budgetState(spent: number, limit: number, alertAt80: boolean): { ratio: number; level: BudgetLevel } {
  if (limit <= 0) return { ratio: 0, level: "ok" };
  const ratio = Math.min(spent / limit, 1);
  if (spent > limit) return { ratio, level: "over" };
  if (alertAt80 && spent / limit >= 0.8) return { ratio, level: "near" };
  return { ratio, level: "ok" };
}
