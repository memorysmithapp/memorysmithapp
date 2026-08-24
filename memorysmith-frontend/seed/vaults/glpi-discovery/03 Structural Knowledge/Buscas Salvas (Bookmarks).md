---
title: Buscas Salvas (Bookmarks)
aliases: [Saved searches, Bookmarks, Buscas favoritas]
tags: [component, search, saved-searches, bookmarks, private, public]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-008 · Buscas salvas (bookmarks), contadores e alertas|EV-2-a1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Buscas Salvas (Bookmarks)

O GLPI oferece um sistema para **salvar buscas** (bookmarks). Concluída uma busca, ela pode ser salva por um botão em forma de **estrela** no formulário de busca. As buscas salvas são acessadas por outro botão-estrela no menu do usuário.

## Tipos
- **Privadas** — acessíveis apenas por seu autor.
- **Públicas** — só podem ser criadas por usuários autorizados; acessíveis por todos que pertençam às entidades configuradas (ponte: [[Modelo de Entidades (multi-tenancy)]]).

## Operações na interface de buscas salvas
- Reordenar buscas privadas por **drag & drop** (públicas usam ordenação automática).
- Definir uma busca **padrão** (só uma por tipo de objeto) pelo ícone de estrela.
- Acessar resultados clicando na busca.
- Abrir a interface de gestão das buscas salvas (ícone de chave inglesa, topo direito).

> [!warning]
> Definir uma busca muito pesada como display padrão pode ter efeitos catastróficos na performance geral da aplicação.

Contadores e alertas dessas buscas são tratados em [[Configuração de Alertas em Buscas Salvas]].

## Relações
- Feature do [[Motor de Busca (Search Engine)]] (código) e de [[Busca na Interface (uso do motor de busca)]].
- Alertas via [[Notificações (e-mail e canais)]].
- Acessada por: [[Áreas da Interface do GLPI]] (user menu).
