---
title: INV-2-e1-002 · Detalhamento incompleto da aba Configuration do perfil
aliases: [INV-2-e1-002]
tags: [investigation, consumidor/cad, perfis, permissoes, configuracao, lacuna-doc]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-e1-002 · Detalhamento incompleto da aba Configuration do perfil

## O que disparou
O arquivo `profiles/configurationtab.rst` (um *orphan* enxuto) documenta apenas a permissão **Search result display** (com *User Display* e *Default Display*). A figura `config.png` (referenciada como "All Configuration Permissions") indica que a aba contém **muitas outras permissões** de configuração do GLPI que **não estão descritas em texto** na documentação lida.

## Perguntas abertas
- Quais são todas as permissões da aba Configuration (ex.: gestão de dropdowns, configuração geral, notificações, entidades, plugins, logs)?
- Como cada uma mapeia para os rights do modelo de código [[Perfis e Direitos (RBAC)]]?
- Há permissões sensíveis (ex.: acesso à configuração que, se dada à interface simplificada do Super-Admin, causa perda de acesso — ver [[Perfis pré-definidos do GLPI]])?

## Próximos passos
Cruzar com o modelo de rights do código ([[Perfis e Direitos (RBAC)]], [[Tipos de Regra]]) e com a figura `config.png`. Complementar [[Aba Configuration de Perfil (direitos de configuração)]] quando houver evidência.
