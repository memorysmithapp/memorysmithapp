---
title: EV-2-f1-016 · Réplicas SQL
aliases: [EV-2-f1-016]
tags: [evidence, sql, replicas, banco-de-dados, configuracao-geral]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/general/sql_replicas.rst · SQL replicas"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/sql_replicas.rst — "SQL replicas"
> "GLPI can be configured to use replica databases in some cases to improve performance."
> - Aba visível só se a opção foi habilitada na aba **system**.
> - Ativa-se preenchendo os parâmetros de conexão; recomendável usar login com privilégios **somente leitura**.
> - Vários replicados separados por **espaço em branco** (no `config_db_slave.php` o `dbhost` vira array); porta específica pode ser adicionada.
> [!warning] Com múltiplas réplicas, as configurações se aplicam a todas.
> Réplicas usadas ao menos quando: o servidor principal está inacessível (GLPI entra em modo somente-leitura); execução de relatórios (reduz carga no principal).
> Uso pelo motor de busca conforme opção: **Never**; **If synced (all changes)**; **If synced (current user changes)**; **If synced or read-only account**; **Always**.
> [!warning] Com "Always", os resultados podem estar desatualizados.
> [!note] A configuração da replicação do banco não é feita pelo GLPI; deve ser configurada com as ferramentas do SGBD.

## Sustenta
- [[Réplicas SQL de Leitura]]
