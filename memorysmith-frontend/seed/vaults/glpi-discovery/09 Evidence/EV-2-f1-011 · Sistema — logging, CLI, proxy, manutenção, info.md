---
title: EV-2-f1-011 · Sistema — logging, CLI, proxy, manutenção, info
aliases: [EV-2-f1-011]
tags: [evidence, sistema, proxy, manutencao, logging, configuracao-geral]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/general/system.rst · System"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/system.rst — "System"
> "This tab allows you to view a summary of information about the web server, configure the proxy information, and to define the logging information to be recorded."
> - **Logging level**: cada evento interno é registrado nos logs (visíveis em Administration > Logs).
> - **Logs in files (SQL, email, automatic action...)**: registra eventos adicionais em arquivos no diretório `files/_log`.
> - **Maximum number of automatic actions (run by CLI)**: número de execuções simultâneas de ações automáticas via CLI (padrão: uma a uma).
> - **SQL replica**: habilita uso de bancos réplica; configuráveis na aba SQL replicas após habilitar.
> - **Modo de manutenção**: ativável para operação técnica (ex.: update); mensagem configurável exibida na página de login; ainda acessível via `index.php?skipMaintenance=1`.
> - **Proxy**: quando GLPI está atrás de proxy, informar dados p/ acesso à Internet (checagem de versões, feeds RSS etc.).
> - **System info**: lista informações do GLPI para reportar falhas ao time de desenvolvimento; botão `Copy system information` gera versão rich-text para o clipboard (melhor formatação no GitHub).

## Sustenta
- [[Informações de Sistema, Proxy, Logging e Modo de Manutenção]]
