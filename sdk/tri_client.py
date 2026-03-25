import json
import urllib.request

def post_json(url, headers, payload, timeout=20):
    data=json.dumps(payload).encode("utf-8")
    req=urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def run_until_decision(url, facts, api_key=None, get_more=None, max_steps=10):
    headers={"Content-Type":"application/json"}
    if api_key: headers["X-API-Key"]=api_key
    cur=dict(facts)
    for _ in range(max_steps):
        out=post_json(url, headers, cur)
        d=out.get("decision")
        if d != "M":
            return out
        need=out.get("need_list") or []
        if not need or not get_more:
            return out
        cur.update(get_more(need) or {})
    return {"decision":"M","label":"max_steps_reached","need_list":[]}
