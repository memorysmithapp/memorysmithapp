---
title: EV-1-034 · API v2 (HL Router) — REST + GraphQL, OAuth, RSQL
aliases: [EV-1-034]
tags: [evidence, dominio/integracoes, api]
type: evidence
status: confirmed
source: "SRC-001 · src/Glpi/Api/HL/Router.php L36–80 · src/Glpi/Api/API.php · src/Glpi/Api/HL/Middleware/*"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-034 · API v2 (HL Router) — REST + GraphQL, OAuth, RSQL

> [!quote] `src/Glpi/Api/HL/Router.php` (controllers e middlewares)
> ```php
> // Controllers por domínio:
> AssetController, ITILController, ManagementController, ProjectController,
> KnowbaseController, AdministrationController, InventoryController, RuleController,
> DashboardController, ReportController, NotificationController, CustomAssetController,
> GraphQLController, CoreController, DropdownController, SetupController
> // Middlewares:
> CookieAuthMiddleware, InternalAuthMiddleware, OAuthRequestMiddleware,
> IPRestrictionRequestMiddleware, RSQLRequestMiddleware, ResultFormatterMiddleware,
> SecurityResponseMiddleware
> ```

O GLPI 11 tem uma **API v2 de alto nível** (`Glpi\Api\HL`): endpoints REST organizados por
**controller de domínio** (ativos, ITIL, gestão, projetos, KB, admin, inventário, regras…),
um **endpoint GraphQL**, autenticação por **OAuth2**/cookie/interno, **restrição por IP**, e
uma linguagem de filtro **RSQL** na query. Convive com a **API REST legada** (`Glpi\Api\API`,
v1). Formatação de resultado e segurança via middlewares.

## Sustenta
- [[API REST e GraphQL]]
- [[Arquitetura de execução (request lifecycle)]]
