---
title: Catálogo de tipos de dropdown (configuração)
aliases: [Dropdowns, Listas suspensas configuráveis, Setup dropdowns]
tags: [dropdown, configuration, translation, tree, entity]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-005 · Conceito e configuração de dropdowns|EV-2-f2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Catálogo de tipos de dropdown (configuração)

As **listas suspensas (dropdowns)** do GLPI são vocabulários configuráveis reutilizados em formulários por toda a aplicação. É a visão de administrador do conceito já registrado em [[Dropdown (lista suspensa customizável)]].

## Propriedades transversais
- Alguns dropdowns têm **valores padrão** semeados na instalação (ex.: formatos de sistema de arquivos).
- A lista de tipos de dropdown **varia conforme o perfil** atual do usuário.
- Estrutura **plana** (lista simples) ou **em árvore** (definindo a opção pai).
- Toda opção pode receber um **comentário**, exibido ao passar o mouse sobre o ícone **Help** ao lado do dropdown.
- Dropdowns associáveis a entidades específicas exibem um ícone de **"stack"** (delegação por entidade).
- **Tradução** das opções em múltiplos idiomas é possível mas **desabilitada por padrão**; habilita-se em **Setup > General > General setup**, adicionando uma aba de traduções no formulário do dropdown (alguns tipos não são traduzíveis).

## Categorias (subseções do menu)
- **Gerais / comuns** — ver [[Dropdowns gerais (localizações, status, fabricantes, blacklists)]]
- **Assistência** — ver [[Dropdowns de assistência (categorias, soluções, projetos)]]
- **Calendário** — ver [[Dropdowns de calendário e períodos de fechamento]]
- **Internet / rede** — ver [[Dropdowns de Internet e rede (IP, nomes de rede, domínios)]]
- **Outros** — ver [[Outros dropdowns (tipos, modelos, documentos, SO, redes, unicidade)]]

> [!note]
> Plugins podem prover cabeçalhos (headings) de dropdown adicionais, configuráveis no mesmo menu — ver [[Sistema de Plugins (Hooks)]].
