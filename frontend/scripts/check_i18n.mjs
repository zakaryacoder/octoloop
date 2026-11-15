// Usage: npm run check:i18n
// 1) EN/FR/AR message files must have identical keys and no empty values.
// 2) Every tx("...") phrase used in the source must exist in messages/phrases.{fr,ar}.json.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const flat = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
  );
const load = (f) => Object.fromEntries(flat(JSON.parse(readFileSync(f, "utf8"))));
let bad = 0;
const en = load("messages/en.json");
for (const l of ["fr", "ar"]) {
  const m = load(`messages/${l}.json`);
  for (const k of Object.keys(en)) if (!(k in m)) { console.error(`[${l}] missing key: ${k}`); bad++; }
  for (const k of Object.keys(m)) if (!(k in en)) { console.error(`[${l}] extra key: ${k}`); bad++; }
  for (const [k, v] of Object.entries(m)) if (!String(v).trim()) { console.error(`[${l}] empty value: ${k}`); bad++; }
}
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  if (n === "node_modules" || n === ".next") return [];
  return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(p) ? [p] : [];
});
const used = new Set();
for (const f of [...walk("app"), ...walk("components")]) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\btx\(("(?:[^"\\]|\\.)*")\)/g)) used.add(JSON.parse(m[1]));
}
for (const l of ["fr", "ar"]) {
  const d = JSON.parse(readFileSync(`messages/phrases.${l}.json`, "utf8"));
  for (const s of used) if (!(s in d)) { console.error(`[phrases.${l}] missing: ${JSON.stringify(s)}`); bad++; }
}
console.log(bad ? `i18n check FAILED (${bad} issues)` : `i18n check OK (${Object.keys(en).length} keys, ${used.size} phrases, 3 languages)`);
process.exit(bad ? 1 : 0);
