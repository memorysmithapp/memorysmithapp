---
title: API REST e GraphQL
aliases: [API, REST, GraphQL, HL API]
tags: [integration, api, dominio/integracoes]
type: integration
status: confirmed
source: "[[EV-1-034 · API v2 HL Router REST GraphQL OAuth RSQL|EV-1-034]]"
author: CAD Discovery
created: 2026-07-10
---

# API REST e GraphQL

O GLPI expõe uma **API v2 de alto nível** (`Glpi\Api\HL`) para integração externa, além da
**API REST legada** (v1, `Glpi\Api\API`).

## Características (v2)
- **Endpoints por domínio**: ativos, ITIL (chamados/mudanças/problemas), gestão, projetos,
  base de conhecimento, administração, inventário, regras, dashboards, relatórios,
  notificações, ativos customizados.
- **GraphQL** — endpoint único para consultas flexíveis (`GraphQLController`).
- **Autenticação** — OAuth2 (`Glpi\OAuth`), cookie de sessão ou interno; **restrição por IP**.
- **Filtragem RSQL** — linguagem de query nos parâmetros para filtrar coleções.
- Pipeline de **middlewares** (auth, segurança, formatação de resultado).

## Uso típico
Integração com CMDBs externos, ITSM corporativo, automações, portais e ETL. Toda operação
respeita [[Perfis e Direitos (RBAC)]] e [[Modelo de Entidades (multi-tenancy)]] do token/usuário.

> [!note]
> A API é um **canal**; a lógica de negócio continua no domínio ([[CommonDBTM (Active Record)]]),
> logo o comportamento via API é o mesmo da UI.
