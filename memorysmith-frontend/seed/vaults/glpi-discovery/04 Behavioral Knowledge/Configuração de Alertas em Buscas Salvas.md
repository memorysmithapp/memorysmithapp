---
title: Configuração de Alertas em Buscas Salvas
aliases: [Saved search alerts, Alertas de bookmarks, Contadores de buscas salvas]
tags: [flow, saved-searches, alerts, counters, notification]
type: flow
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-008 · Buscas salvas (bookmarks), contadores e alertas|EV-2-a1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Configuração de Alertas em Buscas Salvas

Sobre as [[Buscas Salvas (Bookmarks)]], o GLPI permite exibir **contadores** e configurar **alertas** baseados no número de resultados.

## Contadores
As configurações do GLPI definem se contadores são exibidos. Para buscas, é mais complexo: buscas pesadas **não são contadas por padrão** (para limitar o impacto na performance). Para calcular o tempo de execução de uma busca salva, ela precisa ser executada ao menos uma vez. Uma **tarefa agendada** também é oferecida para calcular tempos de execução regularmente. Administradores podem sobrepor o método automático, forçando uma busca a ser *sempre* ou *nunca* contada (usar com parcimônia). Ver ponte de código [[Ações Automáticas (CronTask)]] e a investigação [[INV-2-a1-001 · Qual CronTask calcula tempos de execução de buscas salvas]].

## Alertas
O envio de "alertas" sobre uma busca salva usa o sistema de notificações do GLPI. A notificação baseia-se no número de resultados retornados, comparado (via operador escolhido) ao valor informado.
- **Buscas privadas** — só o autor pode ser notificado, usando um template padrão; uma única notificação vinculada.
- **Buscas públicas** — é preciso criar um **evento** específico e uma notificação que o use (apenas pela aba de configuração de alertas), depois associar template e destinatários. Várias notificações podem se ligar à mesma busca via o evento correspondente. Enquanto a notificação específica não for criada, não é possível adicionar alertas.

## Relações
- Aplica-se a: [[Buscas Salvas (Bookmarks)]].
- Ponte de código: [[Notificações (e-mail e canais)]], [[Fluxo de notificação (event → fila → envio)]], [[Ações Automáticas (CronTask)]].
