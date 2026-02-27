# tri server API (local)

Start:
```bash
tri server
Health:
curl http://127.0.0.1:7331/health

Eval:
curl -s -X POST http://127.0.0.1:7331/eval -H 'Content-Type: application/json' -d '{"expr":"a imp b","a":"M","b":"0"}'
