---
title: EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis
aliases: [EV-2-d1-006]
tags: [evidence, management, document, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/management/documents.rst · Documents"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis

> [!quote] documents.rst · "Documents"
> "Documents management in GLPI allows to store digital documents or web links sorted under different headings." Um documento é descrito por um **name** e um **comment** e pode ser associado a um **heading** (cabeçalho/rubrica).

> [!quote] documents.rst · formas de adicionar o arquivo
> O arquivo pode ser adicionado de várias formas: a partir do disco local; usando um **web link** apontando para um documento (imagem, página HTML, PDF...); usando um arquivo previamente transferido por FTP para a subpasta */files/_uploads/* da instalação do GLPI. Um **MIME type** também pode ser informado.

> [!quote] documents.rst · notas
> Os tipos de documento autorizados por extensão são definidos em **Setup > Dropdowns > Management > Document types**. Os cabeçalhos (headings) de documento podem ser hierárquicos. A opção **Blacklisted for import** exclui o documento da importação por coletores; útil para imagens de assinatura, logos...

> [!quote] documents.rst · abas "Associated Items" e "Documents"
> A aba **Associated Items** referencia todos os itens ligados ao documento; é possível vincular muitos tipos de objeto (lista extensa: Appliance, Budget, Certificate, Change, Computer, Contact, Contract, License, Line, Printer, Problem, Project, Software, Supplier, Ticket, User, etc. — ~90 tipos). A aba **Documents** existe porque um documento pode ter outros documentos anexados a ele. Inclui abas Notes, Historical, All.

## Sustenta
- [[Documento na interface (Document) — visão do usuário]]
- [[Gestão de Documentos (capacidade)]]
- [[Campos do formulário de Documento]]
- [[Adicionar um documento e anexar arquivo (procedimento)]]
- [[Itens vinculáveis a um documento]]
