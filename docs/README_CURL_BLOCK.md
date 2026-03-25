## Curl quickstart (risk)

Step 1: partial data → decision=M + need_list
```bash
curl -s -X POST http://127.0.0.1:7334/risk -H "Content-Type: application/json" \
  -d '{"env":{"income":"1","fraud":"0","docs":"M","history":"M"}}'
```

Step 2: completed data → decision=1
```bash
curl -s -X POST http://127.0.0.1:7334/risk -H "Content-Type: application/json" \
  -d '{"env":{"income":"1","fraud":"0","docs":"1","history":"1"}}'
```
