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

function decisionAndNeed(env){
  // decision: 1 approve, M review, 0 reject
  // need: 0 none, 1 docs, 2 history, 3 both
  const program = `
// inputs
let docs = ${env.docs ?? "M"};
let income = ${env.income ?? "M"};
let fraud = ${env.fraud ?? "M"};
let history = ${env.history ?? "M"};

// rule
let approve = income and docs and (not fraud) and history;

// decision
print approve;

// need code
let need = 0;
if docs eq M { need = need + 1; } maybe { need = need + 1; } else { need = need + 0; }
if history eq M { need = need + 2; } maybe { need = need + 2; } else { need = need + 0; }
print need;
`;
  const [decision, need] = triRun(program);
  return { decision, need: Number(need) };
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
