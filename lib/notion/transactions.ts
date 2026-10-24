import { getNotionClient, queryDatabase, ensureDatabaseProps } from "./client";
import type { NotionCreds } from "@/lib/auth/session";
import { TransactionSchema, PAYMENT_METHODS, type Transaction, type TransactionType, type Currency, type PaymentMethod } from "./schemas";
import { getTitle, getSelect, getNumber, getRichText, getDate, getCreatedTime, getRelationId } from "./helpers";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

// Propiedades que la feature "medio de pago" necesita en la DB Transactions,
// además de las que ya trae la plantilla.
const REQUIRED_PROPS: Record<string, unknown> = {
  PaymentMethod: {
    select: {
      options: [
        { name: "Efectivo", color: "green" },
        { name: "Bizum", color: "blue" },
        { name: "Débito", color: "purple" },
        { name: "Crédito", color: "orange" },
      ],
    },
  },
};

// Idempotente (ver ensureDatabaseProps): agrega solo las propiedades que falten.
// Devuelve los nombres que agregó ([] si no faltaba nada).
export async function ensureTransactionsSchema(databaseId: string, token: string): Promise<string[]> {
  return ensureDatabaseProps(databaseId, REQUIRED_PROPS, token);
}

// Las conexiones existentes nunca vuelven a pasar por /api/setup, y escribir un
// select en una propiedad que no existe falla: antes de guardar un medio de pago
// se asegura la propiedad, una sola vez por base y por instancia del servidor.
// Se anota recién después de lograrlo, así un fallo se reintenta en el próximo pedido.
const ensuredPaymentDbs = new Set<string>();

async function ensurePaymentProp(creds: NotionCreds): Promise<void> {
  const id = creds.dbIds.transactions;
  if (ensuredPaymentDbs.has(id)) return;
  await ensureTransactionsSchema(id, creds.token);
  ensuredPaymentDbs.add(id);
}

function pageToTransaction(page: PageObjectResponse): Transaction {
  const p = page.properties;
  // En bases viejas la propiedad no existe (getSelect reventaría con undefined);
  // y una opción agregada a mano en Notion no debe romper el parse de todo el año.
  const pm = p["PaymentMethod"] ? getSelect(p["PaymentMethod"]) : null;
  return TransactionSchema.parse({
    id: page.id,
    name: getTitle(p["Name"]),
    type: getSelect(p["Type"]) as TransactionType | null,
    amount: getNumber(p["Amount"]) ?? 0,
    currency: getSelect(p["Currency"]) as Currency | null,
    amountBase: getNumber(p["AmountBase"]),
    fxRate: getNumber(p["FxRate"]),
    date: getDate(p["Date"]),
    notes: getRichText(p["Notes"]),
    accountId: getRelationId(p["Account"]),
    accountToId: getRelationId(p["AccountTo"]),
    categoryId: getRelationId(p["Category"]),
    subscriptionId: getRelationId(p["Subscription"]),
    paymentMethod: (PAYMENT_METHODS as readonly string[]).includes(pm ?? "") ? pm : null,
    createdAt: getCreatedTime(p["CreatedAt"]),
  });
}

export interface GetTransactionsOptions {
  startDate?: string;
  endDate?: string;
  // Solo movimientos con fecha estrictamente anterior (YYYY-MM-DD).
  before?: string;
  ascending?: boolean;
  categoryId?: string;
  accountId?: string;
  type?: TransactionType;
  pageSize?: number;
  startCursor?: string;
}

export async function getTransactions(opts: GetTransactionsOptions = {}, creds: NotionCreds): Promise<{
  transactions: Transaction[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  type PropertyFilter = {
    property: string;
    select?: { equals: string };
    relation?: { contains: string };
    date?: { on_or_after?: string; on_or_before?: string; before?: string };
  };

  const filters: PropertyFilter[] = [];

  if (opts.type) filters.push({ property: "Type", select: { equals: opts.type } });
  if (opts.categoryId) filters.push({ property: "Category", relation: { contains: opts.categoryId } });
  if (opts.accountId) filters.push({ property: "Account", relation: { contains: opts.accountId } });
  if (opts.startDate) filters.push({ property: "Date", date: { on_or_after: opts.startDate } });
  if (opts.endDate) filters.push({ property: "Date", date: { on_or_before: opts.endDate } });
  if (opts.before) filters.push({ property: "Date", date: { before: opts.before } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any =
    filters.length === 0 ? undefined :
    filters.length === 1 ? filters[0] :
    { and: filters };

  const res = await queryDatabase(
    creds.dbIds.transactions,
    {
      filter,
      sorts: [{ property: "Date", direction: opts.ascending ? "ascending" : "descending" }],
      page_size: opts.pageSize ?? 50,
      ...(opts.startCursor ? { start_cursor: opts.startCursor } : {}),
    },
    creds.token
  );

  const transactions = res.results
    .filter((p): p is PageObjectResponse => p.object === "page" && "properties" in p)
    .map(pageToTransaction);

  return { transactions, nextCursor: res.next_cursor, hasMore: res.has_more };
}

export async function getTransactionsByMonth(year: number, month: number, creds: NotionCreds): Promise<Transaction[]> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  const { transactions } = await getTransactions({ startDate: start, endDate: end, pageSize: 100 }, creds);
  return transactions;
}

// Whole-year fetch, paginated until exhausted. Used by the SPA (client filters by period).
export async function getTransactionsByYear(year: number, creds: NotionCreds): Promise<Transaction[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const all: Transaction[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await getTransactions({ startDate: start, endDate: end, pageSize: 100, startCursor: cursor }, creds);
    all.push(...res.transactions);
    cursor = res.hasMore && res.nextCursor ? res.nextCursor : undefined;
  } while (cursor);
  return all;
}

// Todo el historial anterior a `beforeISO` (exclusivo), paginado hasta agotar.
// Alimenta el saldo acumulado: el cliente solo necesita los movimientos previos a
// los años que ya carga por separado. Las páginas van en serie (sin ráfagas) para
// no pisar el límite de pedidos de Notion.
export async function getTransactionsBefore(beforeISO: string, creds: NotionCreds): Promise<Transaction[]> {
  const all: Transaction[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await getTransactions({ before: beforeISO, ascending: true, pageSize: 100, startCursor: cursor }, creds);
    all.push(...res.transactions);
    cursor = res.hasMore && res.nextCursor ? res.nextCursor : undefined;
  } while (cursor);
  return all;
}

export async function createTransaction(data: {
  type: TransactionType;
  amount: number;
  currency: Currency;
  amountBase?: number;
  fxRate?: number;
  date: string;
  accountId?: string;
  accountToId?: string;
  categoryId?: string;
  subscriptionId?: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
}, creds: NotionCreds): Promise<Transaction> {
  const notion = getNotionClient(creds.token);
  const label = `${data.type} · ${data.amount} ${data.currency}`;
  if (data.paymentMethod) await ensurePaymentProp(creds);

  const page = await notion.pages.create({
    parent: { database_id: creds.dbIds.transactions },
    properties: {
      Name: { title: [{ text: { content: label } }] },
      Type: { select: { name: data.type } },
      Amount: { number: data.amount },
      Currency: { select: { name: data.currency } },
      ...(data.amountBase != null ? { AmountBase: { number: data.amountBase } } : {}),
      ...(data.fxRate != null ? { FxRate: { number: data.fxRate } } : {}),
      Date: { date: { start: data.date } },
      ...(data.accountId ? { Account: { relation: [{ id: data.accountId }] } } : {}),
      ...(data.accountToId ? { AccountTo: { relation: [{ id: data.accountToId }] } } : {}),
      ...(data.categoryId ? { Category: { relation: [{ id: data.categoryId }] } } : {}),
      ...(data.subscriptionId ? { Subscription: { relation: [{ id: data.subscriptionId }] } } : {}),
      ...(data.notes ? { Notes: { rich_text: [{ text: { content: data.notes } }] } } : {}),
      ...(data.paymentMethod ? { PaymentMethod: { select: { name: data.paymentMethod } } } : {}),
    },
  });

  return pageToTransaction(page as PageObjectResponse);
}

export async function updateTransaction(
  id: string,
  data: Partial<{
    type: TransactionType;
    amount: number;
    currency: Currency;
    amountBase: number;
    fxRate: number;
    date: string;
    accountId: string;
    categoryId: string;
    notes: string;
    // null limpia el medio de pago
    paymentMethod: PaymentMethod | null;
  }>,
  creds: NotionCreds
): Promise<Transaction> {
  const notion = getNotionClient(creds.token);
  if (data.paymentMethod !== undefined) await ensurePaymentProp(creds);
  const page = await notion.pages.update({
    page_id: id,
    properties: {
      ...(data.type ? { Type: { select: { name: data.type } } } : {}),
      ...(data.amount != null ? { Amount: { number: data.amount } } : {}),
      ...(data.currency ? { Currency: { select: { name: data.currency } } } : {}),
      ...(data.amountBase != null ? { AmountBase: { number: data.amountBase } } : {}),
      ...(data.fxRate != null ? { FxRate: { number: data.fxRate } } : {}),
      ...(data.date ? { Date: { date: { start: data.date } } } : {}),
      ...(data.accountId ? { Account: { relation: [{ id: data.accountId }] } } : {}),
      ...(data.categoryId ? { Category: { relation: [{ id: data.categoryId }] } } : {}),
      ...(data.notes !== undefined ? { Notes: { rich_text: data.notes ? [{ text: { content: data.notes } }] : [] } } : {}),
      ...(data.paymentMethod !== undefined
        ? { PaymentMethod: { select: data.paymentMethod ? { name: data.paymentMethod } : null } }
        : {}),
    },
  });
  return pageToTransaction(page as PageObjectResponse);
}

export async function deleteTransaction(id: string, creds: NotionCreds): Promise<void> {
  const notion = getNotionClient(creds.token);
  await notion.pages.update({ page_id: id, in_trash: true });
}
