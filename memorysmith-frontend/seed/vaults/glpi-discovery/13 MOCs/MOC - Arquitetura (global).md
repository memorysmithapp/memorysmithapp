---
title: MOC - Arquitetura (global)
aliases: [MOC Arquitetura, índice global, mapa do vault]
tags: [moc, arquitetura, global]
type: moc
status: confirmed
author: CAD Discovery
created: 2026-07-10
---

# MOC - Arquitetura (global)

Índice mestre do vault de engenharia reversa do **GLPI 11.0.7**. Conecta os seis módulos e as
camadas de conhecimento.

## Por onde começar
- [[Visão Geral do GLPI]] — o que é o sistema.
- [[Camadas da arquitetura (view)]] — visão em camadas.
- [[Arquitetura de execução (request lifecycle)]] — como uma requisição flui.

## MOCs por domínio
1. [[MOC - Foundation]] — núcleo: [[CommonDBTM (Active Record)]], entidades, RBAC, busca, hooks.
2. [[MOC - Service Desk]] — ITIL: chamados, mudanças, problemas, SLA.
3. [[MOC - Ativos e Inventário]] — CMDB, software, rede, DCIM, inventário.
4. [[MOC - Gestão]] — contratos, financeiro, documentos, projetos.
5. [[MOC - Administração e Segurança]] — usuários, auth, regras, KB.
6. [[MOC - Integrações e Operação]] — API, notificações, agente, cron, config.

## Fios condutores (padrões transversais)
- **Tudo é `CommonDBTM`** → mesmo ciclo de vida, direitos, entidade, histórico, busca.
- **Multi-tenancy por entidade** em árvore, com herança de config.
- **Configuração como dado**: templates, categorias, **regras**, notificações e ativos
  customizados moldam o comportamento **sem código**.
- **Extensão por hooks/plugins**.

## Índice de rastreabilidade
- [[Registro de Evidências]] — EV-1-001 … EV-1-039 por módulo.
- Investigações abertas remanescentes: [[INV-1-002 · Catálogo completo de hooks de plugin]],
  [[INV-1-003 · Comportamento de produção via plugins fora do repo]],
  [[INV-1-004 · Ações de escalonamento de SLA]],
  [[INV-1-005 · Regras exatas de transição de status por perfil]],
  [[INV-1-006 · Capacities disponíveis para ativos customizados]],
  [[INV-1-009 · Catálogo de critérios e ações por tipo de regra]].
