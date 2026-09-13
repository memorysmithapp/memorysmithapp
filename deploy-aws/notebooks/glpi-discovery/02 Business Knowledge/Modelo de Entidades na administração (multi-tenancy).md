---
title: Modelo de Entidades na administração (multi-tenancy)
aliases: [Entidades (administração), Multi-tenancy GLPI]
tags: [entidades, multi-tenancy, hierarquia, isolamento, delegacao, doc]
type: capability
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-002 · Entidades - conceito, hierarquia e isolamento (multi-tenancy)|EV-2-e2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

**Entidades** são o conceito central de multi-tenancy do GLPI: em uma única instância, permitem **isolar** conjuntos organizados hierarquicamente (semelhante a uma hierarquia/divisão de empresa). O termo é propositalmente neutro para se adaptar a diversos sistemas de informação.

## Para que servem
- Isolar ativos de cada divisão (limitar visibilidade a grupos/usuários);
- Isolar ativos de clientes;
- Reproduzir a hierarquia de um diretório (LDAP/Active Directory).

Quando o isolamento **não** é desejado, a documentação recomenda usar **Groups** em vez de entidades.

## Hierarquia e visibilidade
A partir de uma *Root Entity* (renomeável) criam-se sub-entidades em árvore. A visibilidade é **descendente**: a entidade-pai enxerga seus ativos e os das filhas; uma entidade-folha vê apenas os próprios. Criada uma entidade, inventário, usuários, perfis e o serviço de assistência passam a **depender de entidades** (um computador é atribuído a uma entidade; um ticket é declarado numa entidade).

## Autorização por entidade
Um usuário pode ter **autorizações diferentes em cada entidade**, e cada autorização pode ser **recursiva** (aplicando-se ou não às filhas). Ver [[Regras de atribuição de autorizações ao usuário]] e a nota de código [[Recursividade em entidades]].

## Administração delegada
Processos podem variar por entidade; por isso há **administração delegada** (autorização *Entities* no perfil), concedida a poucos usuários responsáveis pela gestão completa da entidade. Em modo multi-entidade, vários parâmetros de configuração podem ser aplicados de forma diferente por entidade — ver [[Herança de configuração entre entidades (fluxo)]].

> [!note] Ponte doc×código
> Corresponde, na perspectiva de produto, à nota de código [[Modelo de Entidades (multi-tenancy)]]. Relaciona-se com [[Perfis × Entidades (Profile_User)]] e [[Transferência de itens entre entidades (processo)]].

## Ver também
- [[Abas de configuração da Entidade]]
- [[Herança de configuração entre entidades (fluxo)]]
