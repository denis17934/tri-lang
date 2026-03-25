# Кейс 2: Андеррайтинг (не хватает данных)

Было: пауза/отказ, теряем конверсию.
Стало: M + need_list → досбор → 0/1.

ВХОД:
```json
{"income_confirmed":"M","credit_history":"M","age_ok":"1"}
```

ВЫХОД:
```json
{"decision":"M","label":"нужно подтвердить доход и историю","need_list":["income_confirmed","credit_history"]}
```
