# tri-lang (0 / M / 1)

Мини-язык троичной логики: `0` (нет), `M` (unknown), `1` (да).

## Быстрый старт

Запуск файла:
tri examples/demo.tri

REPL:
tri

Таблицы истинности:
tri --table and
tri --table imp

Выражение (9 строк):
echo "a imp b" | tri --expr --stdin --list

Big factorial (GMP):
tri bigfact 1000000 --sci --head 20 --tail 20 --out /tmp/fact1000000.txt

Risk demo:
tri examples/risk.tri
# outputs:
# M
# 3  (docs+history)

Local Risk API:
cd ~/tri-lang
node scripts/risk_server.mjs

curl -s -X POST http://127.0.0.1:7334/risk -H "Content-Type: application/json" -d '{"env":{"income":"1","docs":"M","fraud":"0","history":"M"}}'