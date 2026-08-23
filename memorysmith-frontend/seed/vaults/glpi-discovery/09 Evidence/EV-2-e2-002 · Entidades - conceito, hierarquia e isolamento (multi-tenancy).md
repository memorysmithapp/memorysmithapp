---
title: EV-2-e2-002 · Entidades - conceito, hierarquia e isolamento (multi-tenancy)
aliases: [EV-2-e2-002]
tags: [evidence, entidades, multi-tenancy, hierarquia, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/entity/entities.rst · Entities (introdução)"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (entities.rst, introdução)
> "Entities are a **key concept in GLPI**. (…) it allows on a single instance of GLPI to isolate sets organized in a hierarchical manner." Segmentar em entidades serve para: isolar ativos de cada divisão, isolar ativos de clientes, ou reproduzir a hierarquia do diretório (LDAP/AD). Uma única instância com várias entidades permite **consolidar dados e regras comuns** e criar **isolamento estrito** entre unidades organizacionais.

Pontos-chave do texto:
- Criada uma entidade, inventário de ativos, usuários, perfis e o serviço de assistência passam a **depender de entidades** (um computador é atribuído a uma entidade; um chamado é declarado numa entidade; perfis e autorizações podem ser específicos por entidade).
- Atribuição automática de entidade a usuários e ativos é possível via **regras** (link para `userauthorizations`).
- Exemplo: *Root entity* → *Entity 1* e *Entity 2* → cada uma com *Child-entity 1 e 2*. **Root** vê seus ativos e os de todas as entidades; **Entity 1** vê os seus e os das filhas; **Child-entity 1** vê só os próprios (herança descendente de visibilidade).
- Um usuário pode ter **autorizações diferentes em entidades diferentes**, e essas autorizações podem ser **recursivas** (aplicando-se opcionalmente às entidades-filhas).
- Por padrão o GLPI tem uma única entidade genérica *Root Entity* (renomeável).
- Entidades podem ter **administração delegada** (autorização *Entities* no perfil), concedida a poucos usuários.
- Em modo multi-entidade, alguns parâmetros de configuração podem ser aplicados de forma diferente em cada entidade.
- `.. hint::` quando o isolamento **não** é desejado, é melhor usar *Groups*.

## Sustenta
- [[Modelo de Entidades na administração (multi-tenancy)]]
- [[Herança de configuração entre entidades (fluxo)]]
