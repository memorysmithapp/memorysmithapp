---
title: INV-2-c1-001 · Semântica de Approved device e aprovação de ativos não gerenciados
aliases: [INV-2-c1-001]
tags: [investigation, consumidor/cad, assets, unmanaged]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-c1-001 · Semântica de "Approved device" e aprovação de ativos não gerenciados

O formulário de [[Campos do formulário de Ativo não gerenciado|ativo não gerenciado]] expõe o campo **Approved device: Yes/No**, mas o doc (`unmanaged_assets.rst`) não descreve o **workflow de aprovação**: quem aprova, o que muda ao aprovar, se afeta a conversão automática/SNMP ou a incorporação ao parque.

> [!question] Perguntas abertas
> - Qual o efeito de marcar um dispositivo como aprovado? Ele deixa de aparecer como "não gerenciado"?
> - A aprovação é pré-requisito para conversão via [[Conversão de ativo não gerenciado em outro tipo (fluxo)]]?
> - Existe regra/automação (import rules) associada?

Disparador: campo booleano documentado sem semântica de processo. Verificar no código (SRC-001) ou com o consultor.
</content>
