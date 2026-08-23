---
title: Adicionar um documento e anexar arquivo (procedimento)
aliases: [Add a document]
tags: [use-case, management, document, doc]
type: use-case
status: confirmed
source: "[[EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis|EV-2-d1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Adicionar um documento e anexar arquivo (procedimento)

Ao criar um [[Documento na interface (Document) — visão do usuário|documento]], informa-se **name**, **comment** e um **heading**; o arquivo pode ser fornecido de três formas:

1. **A partir do disco local** — upload direto do computador.
2. **Por web link** — URL apontando a um documento externo (imagem, HTML, PDF...).
3. **Por FTP** — usando um arquivo previamente transferido para a subpasta `/files/_uploads/` da instalação GLPI.

Opcionalmente, informa-se o **MIME type**. Só são aceitos tipos autorizados por extensão (ver [[Tipos de arquivo permitidos para documentos (extensões)]]).

Depois de criado, o documento pode ser ligado a outros objetos pela aba **Associated Items** (ver [[Itens vinculáveis a um documento]]) ou anexado dentro de outro documento (aba Documents).

> [!note] Ponte doc×código
> Entidade [[Documentos (Document)]].
