---
title: Campos do formulário de Cartão SIM
aliases: [Campos de SIM, SIM fields]
tags: [assets, data, sim, form]
type: entity
status: confirmed
source: "[[EV-2-c1-008 · Formulário de Cartão SIM|EV-2-c1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Cartão SIM

O **SIM (Subscriber Identity Module)** é gerido como objeto específico para rastrear uso e alocação em telefones, tablets, modems 4G/5G etc. Conjunto de campos próprio (não segue o modelo comum de hardware):

| Campo | Significado |
|---|---|
| **Code PIN / PIN2** | Códigos PIN do cartão |
| **Code PUK / PUK2** | Códigos PUK de desbloqueio |
| **Line** | Linha telefônica associada |
| **MSIN** | Mobile Subscriber Identification Number (últimos 8 ou 10 dígitos do IMSI) |
| **Serial number** | Nº de série |
| **Inventory number** | Nº de inventário |
| **Location** | Localização |
| **Status** | Estado ([[Status de itens (visão específica)]]) |
| **User / Group** | Usuário / grupo |
| **Comments** | Comentários |

**Abas:** Management (financeiro/administrativo), Documents, Locks, Contracts, Historical, All.

> [!warning] Não há Manufacturer/Model/Type nem abas de OS/Components/Network — o SIM é um objeto enxuto e específico.
</content>
