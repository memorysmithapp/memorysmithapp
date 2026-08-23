---
title: Regras de negócio de tickets (administração)
aliases: [Business rules for tickets, Regras de negócio de tickets]
tags: [regras, negocio, tickets, automacao, doc]
type: rule
status: confirmed
source: "[[EV-2-e2-010 · Regras de negócio de tickets|EV-2-e2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Mecanismo que **modifica automaticamente atributos de um ticket** ao abri-lo ou atualizá-lo.

## Critérios
Todos os atributos do ticket — título, descrição, status, categoria, urgência, impacto, prioridade, fonte da requisição, tipo de ativo, grupo/usuário/localização requerente, atribuído a fornecedor/grupo/técnico, entidade — e atributos ligados a coletores de e-mail (headers).

## Ações
Modificar atributos do ticket (status, categoria, urgência, impacto, prioridade, requerente, atribuição); **atribuir o ticket a um dispositivo** por IP, nome completo + domínio ou MAC; **enviar solicitação de validação**.

## Semântica de execução
- Executáveis **na abertura e/ou na atualização**, conforme parâmetro da regra. Na atualização, só campos modificados disparam regras.
- O motor executa **todas as regras em sequência**, passando o resultado da anterior à atual (comportamento *pass result to next rule*).
- **Multi-entidade**: podem ser **recursivas** (aplicadas na entidade e nas sub-entidades). Abas: *applied rules (parent)* (requer autorização *Business rules (parent)*), *local rules*, *rules applicable in sub-entities*.

> [!warning] Urgência/Impacto
> Ao definir urgência e/ou impacto via regra de negócio, adicionar também a ação **Recalculate priority** para que a prioridade seja recalculada com base nesses campos. Ver [[Matriz de prioridade (configuração urgência × impacto)]] e código [[Priorização (urgência × impacto)]].

> [!note] Ponte doc×código
> Corresponde à capacidade de código [[Motor de Regras de Negócio (capacidade)]] e ao fluxo [[Execução de uma regra (criteria → action)]].
