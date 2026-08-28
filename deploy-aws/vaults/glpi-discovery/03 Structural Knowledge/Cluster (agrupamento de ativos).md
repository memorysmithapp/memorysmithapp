---
title: Cluster (agrupamento de ativos)
aliases: [Cluster, Clusters]
tags: [management, cluster, agrupamento]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-d2-002 · Clusters (clusters.rst)|EV-2-d2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Cluster (agrupamento de ativos)

Um **Cluster** é um **agrupamento de vários ativos** — que podem ser computadores ou equipamentos de rede. É um objeto do módulo **Management** usado para representar conjuntos que operam como unidade.

> [!note] Análise de impacto
> Clusters são considerados na [[Aba Análise de Impacto (diagrama de dependências)|análise de impacto]] do GLPI (a documentação tem um item pendente — `todo` — para a representação dessa análise).

Campos específicos: **UUID**, **Version** (para clusters de software) e **Update Source** — ver [[Campos específicos de Cluster]].

## Abas
- **Elements**: lista os ativos que compõem o cluster e permite adicionar novos.
- **Network ports**: lista e cria interfaces de rede do cluster. Tipos possíveis: Ethernet, WiFi, FiberChannel, Port aggregate, Port alias, Dial up line connection, Local loop-back — coerente com [[Rede (portas, IP, VLAN)]].
- Abas comuns: contratos, documentos, tickets, problems, changes, histórico.

Relaciona-se com [[Módulo de Ativos (Assets)]] (os elementos são ativos) e com a [[Gestão de Ativos e Configuração (SACM)]].
