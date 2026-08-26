---
title: Consumível (ativo)
aliases: [Consumable, Consumível, Consumíveis]
tags: [assets, consumable, stock, structural, doc]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-010 · Consumíveis (consumables.rst)|EV-2-c2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Consumível (ativo)

Tipo de ativo para **recursos ou suprimentos** destinados a serem usados, emprestados ou confiados em operações de manutenção ou no dia a dia do parque de TI. Exemplos: pendrives, cabos HDMI ou peças de reposição. Complementa a visão de código [[Reservas e Consumíveis]].

> [!warning] Sem inventário automático
> "Consumables cannot be managed by the agent or automatic inventory."

## Composição (abas)
- Formulário do modelo ([[Campos do formulário de Consumível]]) com **Alert threshold** e **Stock target**.
- **Consumables**: gerenciar quantidades, alocar a usuários/grupos, devolver ao estoque — ver [[Gestão de quantidades de consumíveis (alocação)]].
- Abas comuns: Management, Documents, Links, Notes, Historical.

## Ações específicas
- Adicionar novos consumíveis a um modelo.
- Botão de menu **Summary**: resumo dos consumíveis alocados.

## Relações
- Comparte a lógica de estoque com [[Cartucho (ativo)]].
