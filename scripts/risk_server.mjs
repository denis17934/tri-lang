import http from "node:http";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

function triRun(program){
  const tmp = `/tmp/tri_env_${process.pid}_${Math.random().toString(16).slice(2)}.tri`;
  writeFileSync(tmp, program, "utf8");
  const r = spawnSync("tri", [tmp], { encoding: "utf8" });
  try { unlinkSync(tmp); } catch {}
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "tri failed"));
  const lines = String(r.stdout).trim().split(/\r?\n/).filter(Boolean);
  return lines;
}

function label(decision){
  if (decision === "1") return "APPROVE";
  if (decision === "0") return "REJECT";
  return "REVIEW";
}

function decisionAndNeed(env){
  // decision: 1 approve, M review, 0 reject
  // need: 0 none, 1 docs, 2 history, 3 both
  const program = `
// inputs
let docs = ${env.docs ?? "M"};
let income = ${env.income ?? "M"};
let fraud = ${env.fraud ?? "M"};
let history = ${env.history ?? "M"};

// helper: strict "is unknown?"
fn isM(x) {
  if x { return 0; }
  maybe { return 1; }
  else { return 0; }
}

// rule
let decision = income and docs and (not fraud) and history;
print decision;

// need code
let need = 0;
need = need + isM(docs) * 1;
need = need + isM(history) * 2;
print need;
`;
  const [decision, needStr] = triRun(program);
  const need = Number(needStr);
  const need_list = [];
  if (need & 1) need_list.push("docs");
  if (need & 2) need_list.push("history");
  return { decision, label: label(decision), need, need_list };
}

const port = 7334;

http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS"){res.statusCode=204;res.end();return;}
  if(req.method==="GET" && req.url==="/health"){
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify({ok:true}));
    return;
  }
  if(req.method!=="POST"){res.statusCode=405;res.end("POST");return;}

  let body=""; req.on("data",c=>body+=c);
  req.on("end",()=>{
    try{
      const j = body?JSON.parse(body):{};
      if(req.url==="/risk"){
        const env = (j.env && typeof j.env==="object")?j.env:{};
        const out = decisionAndNeed(env);
        res.setHeader("Content-Type","application/json");
        res.end(JSON.stringify(out));
        return;
      }
      res.statusCode=404; res.end("Not found");
    }catch(e){
      res.statusCode=400;
      res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify({error:String(e?.message ?? e)}));
    }
  });
}).listen(port,"127.0.0.1",()=>console.log("risk server on http://127.0.0.1:"+port));
