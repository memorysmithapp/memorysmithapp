---
title: EV-2-e2-003 · Abas da entidade - Endereço e Avançado (regras genéricas e LDAP)
aliases: [EV-2-e2-003]
tags: [evidence, entidades, abas, ldap, campos, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/entity/entities.rst · Entities/Address/Advanced information"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (entities.rst, abas Entities/Address/Advanced information)
> Aba **Entities**: lista sub-entidades e permite adicionar sub-entidade à entidade atual.
> Aba **Address**: agrupa dados administrativos — Phone, Administrative number, Fax, Website, Email, Postal code, Address, City, State, Country, Location on map, Longitude, Latitude, Altitude.
> Aba **Advanced information**: dados técnicos de identificação da entidade usados por regras de atribuição automática e pela importação/sincronização de usuários de um diretório LDAP.

**Valores para as regras genéricas de atribuição a entidades** (aba Avançado), três opções:
- Informação da ferramenta de inventário (**TAG**) representando a entidade;
- Atributo do diretório **LDAP** representando a entidade (ex.: o `DN` da entidade);
- **Domínio de e-mail** substituto da entidade (mail domain).

**Valores usados na interface para buscar usuários de um diretório LDAP**:
- **LDAP directory**: diretório associado à entidade;
- **LDAP filter** associado à entidade (se necessário) — só é significativo se a definição da entidade acrescenta uma restrição no filtro LDAP; também é possível definir o domínio de e-mail específico da entidade para atribuir usuários.

## Sustenta
- [[Abas de configuração da Entidade]]
- [[Campos administrativos e de endereço da entidade]]
- [[Regras de atribuição de item a entidade (inventário)]]
- [[Regras de atribuição de autorizações ao usuário]]
