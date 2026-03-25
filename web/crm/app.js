window.__CRM_VER="crm-ui-7"; console.log("CRM UI", window.__CRM_VER);
let cases = [];
let currentId = null;


function todayISO(){
  const d=new Date(); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function isoAddDays(n){
  const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function inScope(due, scope){
  if (!due) return false;
  const td=todayISO();
  if (scope==="today") return due===td;
  if (scope==="tomorrow") return due===isoAddDays(1);
  if (scope==="week") return due>=td && due<=isoAddDays(7);
  return false;
}
function collectTasks(scope){
  const out=[];
  for (const c of cases){
    const ts=Array.isArray(c.tasks)?c.tasks:[];
    for (const t of ts){
      if (t.done) continue;
      if (!inScope(t.due, scope)) continue;
      const overdue = (t.due < todayISO());
      out.push({caseId:c._id, client:c.client||"-", text:t.text||"", due:t.due||"", overdue});
    }
  }
  return out;
}
function renderDashTasks(scope){
  const box=document.getElementById("dashTasks");
  if (!box) return;
  box.innerHTML="";
  const list=collectTasks(scope);
  list.forEach(x=>{
    const d=document.createElement("div");
    d.className="dashTask " + (x.overdue ? "overdue" : "upcoming");
    d.textContent = `${x.client}: ${x.text}`;
    d.onclick = ()=>selectCase(x.caseId);
    box.appendChild(d);
  });
}
function initDash(){
  window.__dashScope = window.__dashScope || "today";
  const tabs=document.querySelectorAll(".dashTabs .tab");
  if (!tabs.length) return;
  tabs.forEach(btn=>{
    btn.onclick=()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      window.__dashScope = btn.dataset.scope;
      renderDashTasks(window.__dashScope);
    };
  });
  const first=document.querySelector('.dashTabs .tab[data-scope="today"]');
  if (first) first.classList.add("active");
}




function taskFlag(t) {
  if (!t || t.done) return "done";
  if (!t.due) return "none";
  const td = todayISO();
  if (t.due < td) return "overdue";
  return "upcoming";
}

function caseFlags(c) {
  const ts = Array.isArray(c.tasks) ? c.tasks : [];
  let overdue = 0, upcoming = 0;
  for (const t of ts) {
    const f = taskFlag(t);
    if (f === "overdue") overdue++;
    if (f === "upcoming") upcoming++;
  }
  return { overdue, upcoming };
}



const STATUS_LABEL = {
  new: "Новые",
  in_progress: "В работе",
  pilot: "Пилот",
  paid: "Оплачено",
  lost: "Потеряно"
};

function labelStatus(st) {
  return STATUS_LABEL[st] || st || "-";
}


const el = (id) => document.getElementById(id);

async function api(path, opts={}) {
  const res = await fetch(path, opts);
  return res.json().catch(() => ({}));
}

function fmt(c) {
  const a = [];
  a.push(`client: ${c.client || "-"}`);
  a.push(`company: ${c.company || "-"}`);
  a.push(`source: ${c.source || "-"}`);
  a.push(`type: ${leadType(c) || "-"}`);
  a.push(`case: ${c.case || "-"}`);
  a.push(`status: ${labelStatus(c.status)}`);
  if (c.chat_id) a.push(`chat_id: ${c.chat_id}`);
  if (c.email) a.push(`email: ${c.email}`);
  if (c.inn) a.push(`inn: ${c.inn}`);
  return a.join("\n");
}


function leadType(c) {
  const k = String(c.case || "");
  if (k === "biz lead") return "Юрлицо";
  if (k === "trial started" || k === "trial lead") return "Физик";
  return "";
}

function cardText(c) {
  const t = `${c.client || "-"} · ${c.case || "-"}`;
  const s = `${c.company || "-"} · ${labelStatus(c.status)}`;
  const tag = leadType(c);
  const tagClass = (tag === "Юрлицо") ? "biz" : (tag === "Физик" ? "phys" : "");
  const s2 = tag ? `${s} · ${tag}` : s;
  return { t, s: s2, tag, tagClass };
}

function matchesQuery(c, q) {
  if (!q) return true;
  const hay = `${c.client||""} ${c.company||""} ${c.source||""} ${c.case||""} ${c.pain||""}`.toLowerCase();
  return hay.includes(q);
}

function clearCols() {
  ["new","in_progress","pilot","paid","lost"].forEach(st => {
    const box = el(`col-${st}`);
    if (box) box.innerHTML = "";
  });
}



function formatMoney(n) {
  const x = Number(n||0);
  const v = Number.isFinite(x) ? x : 0;
  return v.toLocaleString("ru-RU");
}

function renderCounts(byStatus) {
  document.querySelectorAll(".col").forEach(col => {
    const st = col.dataset.status;
    const label = col.dataset.label || st;
    const list = (byStatus[st] || []);
    const n = list.length;
    const sum = list.reduce((acc,c)=>acc+Number(c.amount||0),0);
    const head = col.querySelector(".colHead");
    if (head) head.textContent = `${label} (${n}) · ${formatMoney(sum)} ₽`;
  });
}

function renderKanban() {
  const q = el("q").value.trim().toLowerCase();
  clearCols();

  const byStatus = {
    new: [], in_progress: [], pilot: [], paid: [], lost: []
  };

  cases.forEach(c => {
    const st = c.status || "new";
    if (!byStatus[st]) byStatus[st] = [];
    if (matchesQuery(c, q)) byStatus[st].push(c);
  });

  renderCounts(byStatus);

  Object.entries(byStatus).forEach(([st, list]) => {
    const box = el(`col-${st}`);
    if (!box) return;
    list.forEach(c => {
      const d = document.createElement("div");
      d.className = "cardItem";
      if (currentId === c._id) d.classList.add("active");
      d.draggable = true;
      d.dataset.id = c._id;

      const { t, s, tag, tagClass } = cardText(c);
      const chip = tag ? `<span class="chip ${tagClass}"><span class="chipDot"></span>${tag}</span>` : ``;
      const flags = caseFlags(c);
      const dots = (flags.overdue || flags.upcoming) ? `<span class="dots"><span class="dot red" style="display:${flags.overdue? "inline-block":"none"}"></span><span class="dot green" style="display:${flags.upcoming? "inline-block":"none"}"></span></span>` : ``;
      d.innerHTML = `<div class="t">${t}</div><div class="s">${s} ${chip} ${dots}</div>`;

      d.onclick = () => selectCase(c._id);

      d.addEventListener("dragstart", (e) => {
        d.classList.add("dragging");
        e.dataTransfer.setData("text/plain", String(c._id));
      });
      d.addEventListener("dragend", () => d.classList.remove("dragging"));

      box.appendChild(d);
    });
  });
}

async function selectCase(id) {
  currentId = id;
  const c = cases.find(x => x._id === id);
  if (!c) return;

  el("title").textContent = `${c.client || "-"} · ${c.case || "-"}`;
  el("badge").textContent = labelStatus(c.status);
  el("meta").textContent = fmt(c);
  el("amount").value = (c.amount || 0);

  const note = await api(`/api/cases/${id}/note`);
  el("note").value = note.text || "";

  renderTasks(c.tasks || []);
}

function renderTasks(tasks) {
  const box = el("tasks");
  box.innerHTML = "";
  tasks.forEach((t, idx) => {
    const row = document.createElement("div");
    const flag = taskFlag(t);
    row.className = "task " + flag;
    row.innerHTML = `<input type="checkbox" ${t.done ? "checked":""} data-idx="${idx}">
                     <div style="flex:1">${t.text || ""}</div><div class="taskDue">${t.due || ""}</div>`;
    row.querySelector("input").addEventListener("change", (e) => {
      const i = Number(e.target.dataset.idx);
      const c = cases.find(x => x._id === currentId);
      if (!c) return;
      c.tasks[i].done = e.target.checked;
    });
    box.appendChild(row);
  });
}

async function setStatus(id, status) {
  await api(`/api/cases/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const c = cases.find(x => x._id === id);
  if (c) c.status = status;
  if (currentId === id) el("badge").textContent = labelStatus(status);
  renderKanban();
}

function bindDropZones() {
  document.querySelectorAll(".col").forEach(col => {
    const status = col.dataset.status;
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData("text/plain"));
      if (!id || !status) return;
      await setStatus(id, status);
    });
  });
}

async function load() {
  cases = await api("/api/cases");
  renderKanban();
  bindDropZones();
  if (cases.length && currentId == null) selectCase(cases[0]._id);
}

el("reload").onclick = load;
el("q").oninput = renderKanban;

document.querySelectorAll(".actions button").forEach(b => {
  b.onclick = async () => {
    if (!currentId) return;
    await setStatus(currentId, b.dataset.status);
  };
});

el("saveNote").onclick = async () => {
  if (!currentId) return;
  await api(`/api/cases/${currentId}/note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: el("note").value })
  });
  renderDashTasks(window.__dashScope || 'today');
};

el("addTask").onclick = () => {
  if (!currentId) return;
  const txt = el("taskText").value.trim();
  if (!txt) return;
  const c = cases.find(x => x._id === currentId);
  if (!c) return;
  c.tasks = Array.isArray(c.tasks) ? c.tasks : [];
  const due = (el("taskDue") && el("taskDue").value) ? el("taskDue").value : todayISO();
  c.tasks.push({ text: txt, done: false, due });
  el("taskText").value = "";
  renderTasks(c.tasks);
  if (el('saveTasks')) el('saveTasks').click();
};


el("saveAmount").onclick = async () => {
  if (!currentId) return;
  const v = Number(el("amount").value || 0);
  await api(`/api/cases/${currentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: v })
  });
  const c = cases.find(x => x._id === currentId);
  if (c) c.amount = v;
  renderKanban();
};


el("saveTasks").onclick = async () => {
  if (!currentId) return;
  const c = cases.find(x => x._id === currentId);
  if (!c) return;
  await api(`/api/cases/${currentId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: c.tasks || [] })
  });
  renderDashTasks(window.__dashScope || 'today');
};


el("deleteCase").onclick = async () => {
  if (!currentId) return;
  const c = cases.find(x => x._id === currentId);
  const name = c ? `${c.client || "-"} · ${c.case || "-"}` : String(currentId);
  if (!confirm(`удалить кейс\n${name}\nточно`)) return;

  await api(`/api/cases/${currentId}`, { method: "DELETE" });
  // перезагрузим список
  currentId = null;
  initDash();
load();
};

load();
