---
title: Informações de Sistema, Proxy, Logging e Modo de Manutenção
aliases: [System tab, Modo de manutenção, Maintenance mode, Proxy]
tags: [configuracao-geral, sistema, proxy, manutencao, logging, operacao]
type: capability
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-011 · Sistema — logging, CLI, proxy, manutenção, info|EV-2-f1-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **System** (Setup > General): resumo do servidor web, configuração de proxy e definição do que registrar em log.

## Logging
- **Logging level**: cada evento interno é registrado nos logs (Administration > Logs).
- **Logs in files (SQL, email, automatic action...)**: registra eventos adicionais em arquivos no diretório `files/_log`.

## Execução / CLI
- **Maximum number of automatic actions (run by CLI)**: número de execuções **simultâneas** de ações automáticas via CLI (padrão: uma a uma) — ver [[Ações Automáticas (CronTask)]].
- **SQL replica**: habilita bancos réplica; configuráveis depois na aba [[Réplicas SQL de Leitura]].

## Modo de manutenção
Ativável para operação técnica (ex.: update). Mensagem configurável exibida na página de login. Ainda acessível via `index.php?skipMaintenance=1`. Relaciona-se à [[Arquitetura de execução (request lifecycle)]] e a [[Configuração e Instalação]].

## Proxy
Quando GLPI está atrás de proxy, informar dados para acesso à Internet (checagem de versões, feeds RSS etc.).

## System info
Lista informações do GLPI para reportar falhas ao time de desenvolvimento; o botão **Copy system information** gera versão rich-text para o clipboard (melhor formatação no GitHub). Ver [[Comunidade e Ecossistema do GLPI]].
