// Tests de personalizeGuide (lib/notion/markdown-blocks.ts): la guía para agentes
// trae los IDs del Notion original y al publicarla se cambian por los de la
// conexión. Lee el docs/NOTION-SCHEMA.md real. Se compila con tsc y se corre con
// node (ver README, sección Tests).

import { readFileSync } from "node:fs";
import path from "node:path";
import { GUIDE_EXAMPLE_DB_IDS, personalizeGuide } from "../lib/notion/markdown-blocks";

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = "") {
  if (cond) passed++;
  else failures.push(`${name}${detail ? ": " + detail : ""}`);
}

function eq<T>(name: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `esperaba ${e}, obtuvo ${a}`);
}

const count = (text: string, needle: string) => (needle ? text.split(needle).length - 1 : 0);

const md = readFileSync(path.join(process.cwd(), "docs", "NOTION-SCHEMA.md"), "utf8");
const keys = Object.keys(GUIDE_EXAMPLE_DB_IDS) as Array<keyof typeof GUIDE_EXAMPLE_DB_IDS>;
const originalCounts = keys.map((k) => count(md, GUIDE_EXAMPLE_DB_IDS[k]));

// ---- el doc trae exactamente los 6 IDs de ejemplo ----
eq("hay 6 IDs de ejemplo", keys.length, 6);
keys.forEach((k, i) => check(`el doc contiene el ID de ${k}`, originalCounts[i] >= 1));
// Todo UUID con prefijo del workspace original que aparezca en el doc debe ser uno de los 6
// (con o sin guiones): si alguien pega un 7mo ID, personalizeGuide no lo reemplazaría.
const known = new Set<string>(Object.values(GUIDE_EXAMPLE_DB_IDS));
const stray = (md.match(/36d5c48e-?39b6-?[0-9a-f-]{4,}/gi) ?? []).filter((id) => !known.has(id));
eq("no hay otros IDs del workspace original en el doc", stray, []);
eq("el doc no menciona al dueño original", /Franco/.test(md), false);

// ---- IDs de la conexión: algunos con guiones, uno sin guiones, uno con espacios ----
const fake = {
  transactions: "11111111-aaaa-4bbb-8ccc-111111111111",
  accounts: "22222222-aaaa-4bbb-8ccc-222222222222",
  categories: "33333333aaaa4bbb8ccc333333333333", // sin guiones
  subscriptions: "  44444444-aaaa-4bbb-8ccc-444444444444  ", // con espacios
  budgets: "55555555-aaaa-4bbb-8ccc-555555555555",
  fxRates: "66666666-aaaa-4bbb-8ccc-666666666666",
};
const expected: Record<keyof typeof fake, string> = {
  transactions: "11111111-aaaa-4bbb-8ccc-111111111111",
  accounts: "22222222-aaaa-4bbb-8ccc-222222222222",
  categories: "33333333-aaaa-4bbb-8ccc-333333333333",
  subscriptions: "44444444-aaaa-4bbb-8ccc-444444444444",
  budgets: "55555555-aaaa-4bbb-8ccc-555555555555",
  fxRates: "66666666-aaaa-4bbb-8ccc-666666666666",
};

const out = personalizeGuide(md, fake);
keys.forEach((k, i) => {
  eq(`ya no queda el ID original de ${k}`, count(out, GUIDE_EXAMPLE_DB_IDS[k]), 0);
  eq(`el ID nuevo de ${k} aparece tantas veces como el original`, count(out, expected[k]), originalCounts[i]);
});
eq("no queda ningun 36d5c48e", count(out, "36d5c48e"), 0);
eq("el ID sin guiones no se publica sin guiones", count(out, "33333333aaaa4bbb8ccc333333333333"), 0);
eq("solo cambian los IDs: mismo largo de lineas", out.split("\n").length, md.split("\n").length);

// ---- idempotencia / identidad ----
eq("con los IDs originales el texto no cambia", personalizeGuide(md, { ...GUIDE_EXAMPLE_DB_IDS }), md);
eq("aplicarlo dos veces da lo mismo", personalizeGuide(out, fake), out);

// ---- ID vacio: no se reemplaza ese ----
const partial = personalizeGuide(md, { ...fake, accounts: "" });
eq("ID vacio: se conserva el original de accounts", count(partial, GUIDE_EXAMPLE_DB_IDS.accounts), originalCounts[keys.indexOf("accounts")]);
eq("ID vacio: los demas si se reemplazan", count(partial, expected.transactions), originalCounts[keys.indexOf("transactions")]);
const blank = personalizeGuide(md, { ...fake, accounts: "   " });
eq("ID solo espacios: tampoco se reemplaza", count(blank, GUIDE_EXAMPLE_DB_IDS.accounts), originalCounts[keys.indexOf("accounts")]);

console.log(`test-guide: ${passed} ok, ${failures.length} fallos`);
if (failures.length) {
  for (const f of failures) console.log("  FALLO " + f);
  process.exit(1);
}
