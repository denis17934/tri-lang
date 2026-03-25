## SDK quickstart

### Python (no deps)
```py
from sdk.tri_client import run_until_decision

URL = "http://127.0.0.1:7444/v1/risk"
API_KEY = None

facts = {"claim":"M","policy":"1","statement":"M","bank_details":"M"}

def get_more(need_list):
    return {k:"1" for k in need_list}

out = run_until_decision(URL, facts, api_key=API_KEY, get_more=get_more)
print(out)
```

### JS (node 18+)
```js
import { runUntilDecision } from "./sdk/tri_client.js";

const URL = "http://127.0.0.1:7444/v1/risk";
const facts = { claim:"M", policy:"1", statement:"M", bank_details:"M" };

const out = await runUntilDecision(URL, facts, null, async (need) => {
  const more = {};
  for (const k of need) more[k] = "1";
  return more;
});

console.log(out);
```
