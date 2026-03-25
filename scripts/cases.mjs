#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const baseDir = path.join(os.homedir(), "tri-private");
const casesFile = path.join(baseDir, "cases.jsonl");
const casesDir = path.join(baseDir, "cases");

fs.mkdirSync(casesDir, { recursive: true });
if (!fs.existsSync(casesFile)) fs.writeFileSync(casesFile, "", "utf8");

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function ask(rl, q) {
  return new Promise(resolve => rl.question(q, a => resolve(a.trim())));
}

async function addCase() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const date = new Date().toISOString().slice(0, 10);
    const client = await ask(rl, "клиент: ");
    const company = await ask(rl, "компания: ");
    const source = await ask(rl, "источник: ");
    const caseName = await ask(rl, "кейс: ");
    const pain = await ask(rl, "боль: ");
    let status = (await ask(rl, "статус [новый/в работе/пилот/оплачен/потерян]: ")) || "новый";

    const statusMap = {
      "новый": "new",
      "в работе": "in_progress",
      "пилот": "pilot",
      "оплачен": "paid",
      "потерян": "lost",
      "new": "new",
      "in_progress": "in_progress",
      "pilot": "pilot",
      "paid": "paid",
      "lost": "lost"
    };

    status = statusMap[status] || status;

    const row = {
      date,
      client,
      company,
      source,
      кейс: caseName,
      pain,
      status
    };

    fs.appendFileSync(casesFile, JSON.stringify(row) + "\n", "utf8");

    const fileName = `${date}_${slugify(client || "unknown")}_${slugify(caseName || "case")}.md`;
    const mdPath = path.join(casesDir, fileName);

    const md = `# ${client || "Новый кейс"}

## Клиент / источник
${client || "-"} / ${source || "-"}

## Компания
${company || "-"}

## Сфера
-

## Боль
${pain || "-"}

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
${status}
`;

    fs.writeFileSync(mdPath, md, "utf8");

    console.log("");
    console.log("OK ✅ кейс добавлен");
    console.log(`jsonl: ${casesFile}`);
    console.log(`заметка:  ${mdPath}`);
  } finally {
    rl.close();
  }
}

function listCases() {
  const raw = fs.readFileSync(casesFile, "utf8").trim();
  if (!raw) {
    console.log("пока кейсов нет");
    return;
  }

  const rows = raw
    .split("\n")
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);

  rows.forEach((r, i) => {
    console.log(
      `${i + 1}. ${r.date} | ${r.client || "-"} | ${r.company || "-"} | ${r.case || "-"} | ${r.status || "-"}`
    );
  });
}

function openDir() {
  console.log(casesDir);
}


function loadRows() {
  const raw = fs.readFileSync(casesFile, "utf8").trim();
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function saveRows(rows) {
  const out = rows.map(r => JSON.stringify(r)).join("\n");
  fs.writeFileSync(casesFile, out ? out + "\n" : "", "utf8");
}

function showCase(n) {
  const rows = loadRows();
  const i = Number(n) - 1;
  if (!Number.isFinite(i) || i < 0 || i >= rows.length) {
    console.log("bad index");
    return;
  }
  console.log(JSON.stringify(rows[i], null, 2));
}

function removeCase(n) {
  const rows = loadRows();
  const i = Number(n) - 1;
  if (!Number.isFinite(i) || i < 0 || i >= rows.length) {
    console.log("bad index");
    return;
  }
  const removed = rows.splice(i, 1)[0];
  saveRows(rows);
  console.log("OK ✅ removed:", removed.client, removed.case);
}


const cmd = process.argv[2];

if (cmd === "add") {
  await addCase();
} else if (cmd === "list") {
  listCases();
} else if (cmd === "show") {
  showCase(process.argv[3]);
} else if (cmd === "rm") {
  removeCase(process.argv[3]);
} else if (cmd === "open") {
  openDir();
} else {
  console.log(`cases cli

использование:
  node scripts/cases.mjs add   (добавить кейс)
  node scripts/cases.mjs list  (список)
  node scripts/cases.mjs open  (папка кейсов)
  node scripts/cases.mjs show <n> (показать json)
  node scripts/cases.mjs rm <n>   (удалить)
`);
}
