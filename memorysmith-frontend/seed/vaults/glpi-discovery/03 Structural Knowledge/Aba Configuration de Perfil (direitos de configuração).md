---
title: Aba Configuration de Perfil (direitos de configuração)
aliases: [Configuration tab, Setup permissions, Aba Configuration]
tags: [perfis, permissoes, configuracao, busca, exibicao]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-007 · Aba Configuration do perfil (direitos de exibição de busca)|EV-2-e1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Aba Configuration de Perfil (direitos de configuração)

Aba do perfil com permissões de **setup/configuração** (além das 7 [[Permissões padrão de objetos|permissões padrão]], não relistadas).

A permissão **Search result display** permite configurar as colunas exibidas no motor de busca do GLPI, e desdobra-se em:
- **User Display** — exibe uma aba *Personal view* que permite ao usuário customizar a exibição, objeto a objeto.
- **Default Display** — modifica a exibição padrão aplicada a cada usuário sem visão pessoal.

Isso governa a [[Busca na Interface (uso do motor de busca)]] e a [[Exportação de Resultados de Busca]].

> [!warning] Cobertura parcial na documentação
> O doc detalha apenas *Search result display*; as demais permissões da aba Configuration não estão documentadas — ver [[INV-2-e1-002 · Detalhamento incompleto da aba Configuration do perfil]].

## Relações
- Conceito: [[Perfil de Usuário (conceito e composição)]].
- Motor de busca (código): [[Motor de Busca (Search Engine)]].
