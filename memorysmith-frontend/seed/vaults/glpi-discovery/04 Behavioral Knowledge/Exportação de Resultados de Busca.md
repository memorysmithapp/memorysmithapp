---
title: Exportação de Resultados de Busca
aliases: [Export search results, Exportação CSV PDF SLK]
tags: [use-case, export, csv, pdf, slk, search]
type: use-case
status: confirmed
source: "[[EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)|EV-2-a1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Exportação de Resultados de Busca

Os resultados de uma busca podem ser exportados em formatos de planilha **SLK** ou **CSV**, ou em **PDF**. A exportação é acionada pelo botão `Export` acima da lista de resultados.

## Escopo da exportação
- **Current page** — exporta apenas os dados exibidos na tela (ex.: os primeiros 10 de 200 resultados).
- **All pages** — exporta todos os resultados da busca.

Há também opção de **copiar os nomes** dos resultados para a área de transferência (ex.: nomes de computadores).

## Observações de formato
- O formato **SLK** é lido por muitos softwares de planilha; campos muito longos são truncados em softwares não totalmente conformes ao padrão — nesse caso prefira **CSV**.
- CSV importado no **Microsoft Excel** pode exibir caracteres acentuados incorretamente (dificuldade do software com UTF-8).

> [!note]
> O delimitador de CSV e a fonte de exportação PDF são configuráveis em [[Campos das Preferências do Usuário]].

## Relações
- Feature de: [[Busca na Interface (uso do motor de busca)]].
- Ponte de código: [[Motor de Busca (Search Engine)]].
