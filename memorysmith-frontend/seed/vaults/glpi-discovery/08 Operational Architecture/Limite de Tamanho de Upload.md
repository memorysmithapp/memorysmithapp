---
title: Limite de Tamanho de Upload
aliases: [Management tab, Upload size limit, Limite de upload]
tags: [configuracao-geral, upload, documentos, operacao]
type: capability
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-009 · Limite de upload de documentos|EV-2-f1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Management** (Setup > General): o único parâmetro é o **limite de tamanho** para documentos enviados (upload).

> [!warning]
> Se a diretiva PHP `upload_max_filesize` for menor que o valor definido aqui, `upload_max_filesize` será o fator limitante. Também pode ser necessário garantir que `post_max_size` esteja um pouco acima de `upload_max_filesize`.

> [!note]
> Interage com o **Default file size limit imported by the mails receiver** da [[Configuração do Módulo de Assistência (Setup)]] e com [[Documentos (Document)]].
