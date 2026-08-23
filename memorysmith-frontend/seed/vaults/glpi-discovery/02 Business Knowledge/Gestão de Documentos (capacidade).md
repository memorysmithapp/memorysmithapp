---
title: Gestão de Documentos (capacidade)
aliases: [Documents management]
tags: [capability, management, document, doc]
type: capability
status: confirmed
source: "[[EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis|EV-2-d1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Documentos (capacidade)

A gestão de documentos do GLPI permite **armazenar documentos digitais ou web links**, organizados sob diferentes **cabeçalhos** (headings), que podem ser hierárquicos.

Um documento tem *name*, *comment* e um *heading*, e o arquivo pode entrar de três formas: (1) disco local; (2) web link para um documento externo; (3) arquivo previamente transferido por FTP para `/files/_uploads/`. Um MIME type pode ser informado. Ver [[Adicionar um documento e anexar arquivo (procedimento)]].

O que torna documentos centrais no GLPI é a **vinculação universal**: quase todos os objetos (ativos, contratos, licenças, tickets, orçamentos, usuários, etc.) podem ter documentos anexados; e um documento pode, ele próprio, ter outros documentos anexados. Ver [[Itens vinculáveis a um documento]].

Os tipos de arquivo aceitos por padrão são regidos por *Setup > Dropdowns > Management > Document types* (ver [[Tipos de arquivo permitidos para documentos (extensões)]]). A opção **Blacklisted for import** exclui um documento da importação por coletores (útil para logos, imagens de assinatura).

> [!note] Ponte doc×código
> Complementa a entidade de código [[Documentos (Document)]]. Relaciona-se com [[Reserva de Ativos e Documentos (processos)]].
