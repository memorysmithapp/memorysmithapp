---
title: INV-2-f2-001 · Include de tabs-translation.rst ausente nos dropdowns
aliases: [INV-2-f2-001]
tags: [investigation, consumidor/cad, dropdown, doc-gap]
type: investigation
maturity: seed
reviewed: false
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-f2-001 · Include de tabs/translation.rst ausente nos dropdowns

> [!question] Referência quebrada na documentação
> Os arquivos `dropdowns/general.rst` e `dropdowns/assistance.rst` contêm a diretiva `.. include:: tabs/translation.rst` (para descrever a aba de tradução dos dropdowns), mas **o arquivo `dropdowns/tabs/translation.rst` não existe** no repositório de documentação fornecido (`SRC-002`). Nenhum arquivo `translation.rst` foi encontrado sob `modules/configuration/`.

## O que disparou
Ao cobrir 100% da fatia de dropdowns, a lista de arquivos a ler incluía `dropdowns/tabs/translation.rst`. A varredura do diretório confirmou que o arquivo não está presente, embora seja incluído por duas páginas.

## Impacto
- O conteúdo específico da **aba de tradução no formulário do dropdown** não pôde ser lido diretamente; foi coberto apenas pela descrição de alto nível em `dropdowns/index.rst` (recurso desabilitado por padrão, habilitado em Setup > General > General setup — ver [[Catálogo de tipos de dropdown (configuração)]]).

## Hipóteses
- Arquivo omitido do pacote de extração (`in/doc`) mas presente no repositório original do GLPI.
- Página ainda não redigida (consistente com outras lacunas — ver [[INV-2-f2-002 · Dropdown de Wi-Fi networks e network-name.rst não redigidos]]).

## Próximos passos
- Verificar o repositório oficial `glpi-project/doc` para recuperar o conteúdo da aba de tradução dos dropdowns.
