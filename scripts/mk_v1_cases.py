from pathlib import Path
Path("docs/v1_cases").mkdir(parents=True, exist_ok=True)
files={
"01_claim_settlement.md": "# Кейс 1: Урегулирование убытка (страховая)\n\nБыло: ждём полный пакет, дни.\nСтало: M + need_list, досбор точечно.\n\nВХОД:\n```json\n{\"claim\":\"M\",\"policy\":\"1\",\"statement\":\"M\",\"bank_details\":\"M\"}\n```\n\nВЫХОД:\n```json\n{\"decision\":\"M\",\"label\":\"не хватает данных\",\"need_list\":[\"claim\",\"statement\",\"bank_details\"]}\n```\n",
"02_underwriting.md": "# Кейс 2: Андеррайтинг (не хватает данных)\n\nБыло: пауза/отказ, теряем конверсию.\nСтало: M + need_list → досбор → 0/1.\n\nВХОД:\n```json\n{\"income_confirmed\":\"M\",\"credit_history\":\"M\",\"age_ok\":\"1\"}\n```\n\nВЫХОД:\n```json\n{\"decision\":\"M\",\"label\":\"нужно подтвердить доход и историю\",\"need_list\":[\"income_confirmed\",\"credit_history\"]}\n```\n",
"03_compliance_doccheck.md": "# Кейс 3: Проверка документа (печать/подпись/дата)\n\nБыло: 10–15 минут ручной сверки.\nСтало: 0/1 или M + need_list.\n\nВХОД:\n```json\n{\"stamp_present\":\"0\",\"signature_present\":\"1\",\"date_present\":\"1\"}\n```\n\nВЫХОД:\n```json\n{\"decision\":\"0\",\"label\":\"нет печати организации\"}\n```\n"
}
for n,t in files.items(): Path("docs/v1_cases"/Path(n)).write_text(t, encoding="utf-8")
print("OK")
