---
title: Resoluções de investigações do código pela documentação (sessão 2)
aliases: [Resoluções sessão 2, cruzamento SRC-001 × SRC-002, doc responde ao código]
tags: [decision, sintese, cruzamento-fontes, sessao/2]
type: decision
maturity: evergreen
reviewed: false
source: "[[Registro de Evidências]]"
author: CAD Discovery
created: 2026-07-12
---

# Resoluções de investigações do código pela documentação (sessão 2)

Na sessão 1, a engenharia reversa do **código** (`SRC-001`) deixou perguntas abertas em
`11 Investigations` que o código sozinho não respondia (comportamento default, catálogos,
UI de edição). A sessão 2 escaneou a **documentação oficial do usuário** (`SRC-002`), que
por natureza descreve esses comportamentos de configuração — e portanto **responde** a várias
dessas investigações.

> [!important] Hierarquia de fontes
> A documentação oficial é fonte **Corporativa**; na hierarquia CAD (Normativo > Corporativo >
> **Código** > Informal) ela **precede o código** para o *comportamento pretendido/configurável*.
> Onde a doc descreve o default e o código confirma o mecanismo, as duas se **reforçam** (não
> há conflito). As notas `INV-1-*` originais são **preservadas** (validadas por humano); este
> nota registra a resposta encontrada, sem sobrescrevê-las. A baixa de status de cada `INV-1`
> deve ser feita pelo consultor na revisão.

## Investigações do código respondidas pela doc

### INV-1-004 · Ações de escalonamento de SLA → **respondida**
A doc descreve os **níveis de escalonamento** de SLA/OLA e as **ações** que cada nível dispara
ao atingir o marco de prazo (notificação, atribuição, mudança de campo/status), além do
agendamento por ação automática. Ver [[Escalonamento de SLA-OLA (níveis e ações)]] e
[[Níveis de serviço (SLA e OLA) na configuração]], sustentadas por
[[EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento|EV-2-f3-009]].
Fecha a lacuna de [[INV-1-004 · Ações de escalonamento de SLA]] (que só confirmara o disparo via CronTask).

### INV-1-005 · Regras exatas de transição de status por perfil → **respondida**
A doc traz a **matriz de ciclo de vida** (transições de status permitidas/proibidas) e como
ela é definida **por perfil**, incluindo o comportamento default. Ver
[[Matriz de ciclo de vida (transições de status por perfil)]], sustentada por
[[EV-2-b2-006 · Matriz de ciclo de vida por perfil (transições de status)|EV-2-b2-006]].
Fecha a lacuna de [[INV-1-005 · Regras exatas de transição de status por perfil]]
(que localizara `isAllowedStatus()` mas não o default nem a UI de edição).

### INV-1-006 · Capacities disponíveis para ativos customizados → **respondida**
A doc enumera o **catálogo de capacidades** que uma AssetDefinition pode ativar e o que cada
uma injeta no ativo. Ver [[Capacidades de ativo customizado (catálogo)]], sustentada por
[[EV-2-f2-012 · Capacidades disponíveis para ativos customizados|EV-2-f2-012]].
Fecha a lacuna de [[INV-1-006 · Capacities disponíveis para ativos customizados]]
(que só vira `IsInventoriableCapacity`).

## Parcialmente iluminadas
- **INV-1-008 · Alertas e crons de vencimento** — a doc detalha o **catálogo de ações
  automáticas** e os alertas de vencimento por entidade; ver
  [[Catálogo de ações automáticas (crontasks)]] e [[Alertas de renovação e vencimento (contratos, licenças, certificados)]]
  ([[EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo|EV-2-f3-007]]).
- **INV-1-009 · Catálogo de critérios e ações por tipo de regra** — a doc descreve critérios,
  operadores e ações por tipo de regra na visão de configuração; ver
  [[Criação de uma regra (passo a passo)]] e [[Motor de Regras na Administração (gestão de regras)]]
  ([[EV-2-e2-009 · Criação de uma regra - critérios, operadores, regex e AND-OR|EV-2-e2-009]]).
  Permanece **aberta** para o catálogo exaustivo por tipo (a doc é ilustrativa, não exaustiva).

## Não respondidas pela doc (permanecem do código)
- **INV-1-002 · Catálogo completo de hooks de plugin** — a doc do usuário não cobre a API de
  plugins; segue aberta (fonte seria o código/dev-doc).
- **INV-1-003 · Comportamento de produção via plugins fora do repo** — fora do escopo da doc.

> [!note] Novas lacunas da própria documentação
> A sessão 2 abriu 28 investigações `INV-2-*` sobre **omissões da documentação** (stubs,
> includes ausentes, terminologia divergente). Não são falhas do sistema, e sim da doc —
> catalogadas em [[MOC - Documentação do Usuário (global)]] e no [[README]].
