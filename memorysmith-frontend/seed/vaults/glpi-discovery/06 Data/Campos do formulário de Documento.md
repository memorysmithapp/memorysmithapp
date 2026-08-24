---
title: Campos do formulário de Documento
aliases: [Document fields]
tags: [data, management, document, fields, doc]
type: table
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis|EV-2-d1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Documento

Campos do formulário de [[Documento na interface (Document) — visão do usuário|documento]]:

| Campo | Semântica |
|-------|-----------|
| **Name** | Nome do documento. |
| **Comment** | Comentário/descrição. |
| **Heading** | Cabeçalho/rubrica de classificação; pode ser **hierárquico**. |
| **File** | O arquivo em si; adicionado por disco local, web link externo ou arquivo pré-transferido por FTP a `/files/_uploads/`. |
| **Web link** | URL alternativa apontando ao documento (imagem, HTML, PDF...). |
| **MIME type** | Tipo MIME opcional. |
| **Blacklisted for import** | Exclui o documento da importação por coletores (útil p/ assinaturas, logos). |

Os formatos aceitos por padrão constam em [[Tipos de arquivo permitidos para documentos (extensões)]].

> [!note] Ponte doc×código
> Entidade [[Documentos (Document)]].
