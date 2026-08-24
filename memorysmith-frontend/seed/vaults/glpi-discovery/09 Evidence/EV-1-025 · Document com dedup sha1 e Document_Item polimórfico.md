---
title: EV-1-025 · Document com dedup sha1 e Document_Item polimórfico
aliases: [EV-1-025]
tags: [evidence, dominio/gestao, documento]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Document.php L67, 182, 231–269 · src/Document_Item.php L45 · src/DocumentType.php L41"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-025 · Document com dedup sha1 e Document_Item polimórfico

> [!quote] `src/Document.php`
> ```php
> class Document extends CommonDBTM implements TreeBrowseInterface {
>     // dedup por hash: consulta por ['sha1sum' => ...] (L182)
>     // moveDocument() grava o arquivo em disco a partir de $input['_filename'] (L247)
> }
> class Document_Item extends CommonDBRelation { ... }  // anexa documento a qualquer item
> class DocumentType extends CommonDropdown { ... }     // tipos de arquivo permitidos
> ```

O **Document** é o gestor de arquivos anexados. Guarda o arquivo em **disco** (fora do banco)
e usa **sha1sum** para **deduplicar** conteúdos idênticos. **DocumentType** define as
extensões/MIME permitidas (whitelist de upload). **Document_Item** anexa um documento a
**qualquer itemtype** (chamado, ativo, contrato, KB…), tornando o Document um serviço
transversal de anexos.

## Sustenta
- [[Documentos (Document)]]
- [[Gestão de Documentos (processo)]]
