import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const baseDir = path.join(os.homedir(), "tri-private");
export const casesFile = path.join(baseDir, "cases.jsonl");
export const casesDir = path.join(baseDir, "cases");

fs.mkdirSync(casesDir, { recursive: true });
if (!fs.existsSync(casesFile)) fs.writeFileSync(casesFile, "", "utf8");

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

export function loadRows() {
  const raw = fs.readFileSync(casesFile, "utf8").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

export function saveRows(rows) {
  const out = rows.map(r => JSON.stringify(r, null, 0)).join("\n");
  fs.writeFileSync(casesFile, out ? out + "\n" : "", "utf8");
}

export function addCase(row) {
  const rows = loadRows();

  const exists = rows.find(r =>
    String(r.client || "") === String(row.client || "") &&
    String(r.company || "") === String(row.company || "") &&
    String(r.case || "") === String(row.case || "") &&
    String(r.source || "") === String(row.source || "")
  );

  if (exists) return { added: false, row: exists };

  rows.push(row);
  saveRows(rows);

  const fileName = `${row.date}_${slugify(row.client || "unknown")}_${slugify(row.case || "case")}.md`;
  const mdPath = path.join(casesDir, fileName);

  if (!fs.existsSync(mdPath)) {
    const md = `# ${row.client || "Новый кейс"}

## Клиент / источник
${row.client || "-"} / ${row.source || "-"}

## Компания
${row.company || "-"}

## Сфера
-

## Боль
${row.pain || "-"}

## Что хотят решить
-

## Текущий процесс
-

## Какие данные есть
-

## Какие данные не хватает
-

## Decision flow
- ok:
- stop:
- need:

## Need list примеры
-

## Гипотезы
-

## Что обещали
-

## Следующий шаг
-

## Статус
${row.status || "new"}
`;
    fs.writeFileSync(mdPath, md, "utf8");
  }

  return { added: true, row };
}

export function updateCaseStatusByChat(chatId, status) {
  const rows = loadRows();
  let changed = false;

  for (const r of rows) {
    if (String(r.chat_id || "") === String(chatId)) {
      r.status = status;
      changed = true;
    }
  }

  if (changed) saveRows(rows);
  return changed;
}
