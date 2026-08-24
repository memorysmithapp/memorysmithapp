---
title: Visão Geral do GLPI
aliases: [GLPI, Gestionnaire Libre de Parc Informatique]
tags: [overview, dominio/foundation]
type: overview
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]"
author: CAD Discovery
created: 2026-07-10
---

# Visão Geral do GLPI

**GLPI** (*Gestionnaire Libre de Parc Informatique*) é um pacote de software livre de
**gestão de ativos de TI (ITAM)** e **central de serviços (ITSM/Service Desk)** com recursos
alinhados ao **ITIL**. Versão analisada: **11.0.7** (fonte `SRC-001`, ver [[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]).
Licença **GPL v3**; mantido pela **Teclib'** e comunidade.

## O que o sistema faz (capacidades declaradas no README)

- **Service Asset & Configuration Management (SACM)** — inventário e CMDB de ativos.
- **Request Fulfillment / Incident / Problem / Change Management** — processos de service desk ITIL. Ver [[Service Desk (visão geral)]] *(a criar no Módulo 2)*.
- **Knowledge Management** — base de conhecimento e FAQ.
- **Contract & Financial Management** — contratos, orçamentos, licenças, depreciação.
- **Inventário nativo dinâmico** (a partir da v10) via agentes.
- **DCIM** — gestão de datacenter; **Software/License Management**; **Impact Analysis**;
  **Service Catalog (SLM)**; **Project Management**; **Reserva de ativos**.
- **Separação de entidades** (multi-tenancy) — ver [[Modelo de Entidades (multi-tenancy)]].
- **Ecossistema de plugins** — ver [[Sistema de Plugins (Hooks)]].

## Como está construído (visão de 10.000 pés)

GLPI 11 é uma **aplicação web PHP** de arquitetura **híbrida**: um `Kernel` **Symfony**
moderno ([[Kernel e Bootstrap]]) envolve um núcleo legado no padrão **Active Record**
([[CommonDBTM (Active Record)]]) sobre **MariaDB/MySQL**. Toda leitura/escrita passa por um
ciclo de vida único com hooks ([[Ciclo de vida de um item (add-update-delete)]]), sob um
modelo de **segurança por perfis/direitos** ([[Perfis e Direitos (RBAC)]]) e **isolamento
por entidade**. As listagens e relatórios são geradas por um [[Motor de Busca (Search Engine)]]
genérico dirigido por metadados.

## Termos-chave
Ver [[Glossário]] · Requisitos de plataforma em [[Tecnologias e requisitos de plataforma]].

> [!note] Escopo desta nota
> Módulo 1 (Foundation & Overview). As capacidades de negócio de cada domínio (chamados,
> ativos, contratos…) serão detalhadas nos módulos seguintes.
