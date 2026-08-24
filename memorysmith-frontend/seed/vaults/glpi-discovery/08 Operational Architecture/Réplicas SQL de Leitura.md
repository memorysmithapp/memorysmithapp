---
title: Réplicas SQL de Leitura
aliases: [SQL replicas, Réplicas SQL, config_db_slave]
tags: [configuracao-geral, sql, replicas, banco-de-dados, performance, operacao]
type: capability
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-016 · Réplicas SQL|EV-2-f1-016]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **SQL replicas** (Setup > General): configura bancos **réplica** para melhorar performance. Só visível se a opção **SQL replica** foi habilitada na aba [[Informações de Sistema, Proxy, Logging e Modo de Manutenção|System]].

## Configuração
- Ativa-se preenchendo os parâmetros de conexão; recomendável usar login **somente leitura**.
- Vários replicados separados por **espaço em branco** (no `config_db_slave.php` o `dbhost` vira array). Porta específica pode ser adicionada.
- Com múltiplas réplicas, as configurações aplicam-se a **todas**.

## Quando as réplicas são usadas
- Servidor principal inacessível → GLPI entra em **modo somente-leitura**.
- Execução de **relatórios** (reduz carga no principal) — ver [[Relatórios e estatísticas]].
- Pelo **motor de busca**, conforme a opção: Never; If synced (all changes); If synced (current user changes); If synced or read-only account; Always — ver [[Motor de Busca (Search Engine)]].

> [!warning]
> Com "Always", os resultados podem estar desatualizados; prefira outra opção.

> [!note]
> A replicação do banco em si não é configurada pelo GLPI — deve ser feita com as ferramentas do SGBD.
