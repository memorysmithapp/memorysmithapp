---
title: EV-2-f1-009 · Limite de upload de documentos
aliases: [EV-2-f1-009]
tags: [evidence, upload, management, configuracao-geral]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/general/management.rst · Management"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/management.rst — "Management"
> "The only configuration parameter available on this page is the size limit for uploaded documents."
> [!note] Se a diretiva PHP `upload_max_filesize` for menor que o valor definido aqui, então `upload_max_filesize` será o fator limitante. Pode ser necessário garantir que `post_max_size` esteja um pouco acima de `upload_max_filesize`.

## Sustenta
- [[Limite de Tamanho de Upload]]
