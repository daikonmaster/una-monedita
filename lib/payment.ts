// Cómo se pagó un gasto (propiedad select `PaymentMethod` de Transactions,
// opcional, solo gastos). Vive aparte de lib/notion/schemas.ts para que el
// modal de alta lo importe sin arrastrar zod al bundle del cliente.
export const PAYMENT_METHODS = ["Efectivo", "Bizum", "Débito", "Crédito"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
