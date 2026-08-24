---
title: Documentos (Document)
aliases: [Document, Documento, anexos]
tags: [component, documento, dominio/gestao]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-025 · Document com dedup sha1 e Document_Item polimórfico|EV-1-025]]"
author: CAD Discovery
created: 2026-07-10
---

# Documentos (Document)

Serviço transversal de **arquivos anexados**. O **Document** guarda o arquivo em **disco**
(fora do banco), com **deduplicação por sha1sum** (conteúdos idênticos não são re-armazenados)
e navegação em árvore por categorias.

- **DocumentType** — whitelist de extensões/MIME permitidas no upload (controle de segurança).
- **Document_Item** — anexa um documento a **qualquer itemtype** (`itemtype`/`items_id`):
  chamados, ativos, contratos, artigos de KB, etc.
- Suporta **tags** para embutir imagens/anexos em campos rich-text (followups, descrições).

Por ser polimórfico, é o mecanismo único de anexos em todo o GLPI.
