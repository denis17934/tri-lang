export async function runUntilDecision(url, facts, apiKey, getMore, maxSteps = 10) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  let cur = { ...facts };

  for (let i = 0; i < maxSteps; i++) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(cur) });
    if (!res.ok) throw new Error("http " + res.status);

    const out = await res.json();
    if (out.decision !== "M") return out;

    const need = out.need_list || [];
    if (!need.length || !getMore) return out;

    const more = await getMore(need);
    cur = { ...cur, ...(more || {}) };
  }

  return { decision: "M", label: "max_steps_reached", need_list: [] };
}
