---
title: Campos de tipo de documento (dropdown)
aliases: [Document types fields, Tipos de documento]
tags: [data, dropdown, document-types, fields]
type: entity
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-010 · Outros dropdowns tipos modelos documentos SO unicidade login|EV-2-f2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de tipo de documento (dropdown)

Campos ao adicionar um **Document type**, parte de [[Outros dropdowns (tipos, modelos, documentos, SO, redes, unicidade)]].

| Campo | Significado |
|---|---|
| Nome do tipo | Nome do tipo de documento. |
| Extensão | Ex.: `.txt`, `.pdf`; base da **detecção** dos documentos que podem ser adicionados. Pode ser uma **expressão regular** (ex.: `/[0-9]+/`). |
| Nome do arquivo de ícone | Ícone do tipo; arquivos colocados em `pics/icones` sob a árvore de instalação do GLPI. |
| Tipo MIME | Se necessário. |
| Autorização de download | Sim/Não — permite ou não baixar este tipo de arquivo. |

Lista **plana**, válida para todas as entidades. Relaciona-se a [[Documentos (Document)]].
