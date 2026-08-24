---
title: Campos das Preferências do Usuário
aliases: [User preference fields, Campos de preferências, Personalization fields]
tags: [data, preferences, fields, personalization, form]
type: data
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-009 · Preferências do usuário (abas e campos)|EV-2-a1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos das Preferências do Usuário

Semântica dos campos do formulário de preferências (ver [[Personalização da Experiência do Usuário (capacidade)]]). Estas opções **sobrepõem** os valores padrão da configuração geral.

## Aba Principal (Main)
Surname; First name; Email address (múltiplos, com seleção de padrão para notificações); Phone numbers; Location; Language; perfil e entidade padrão; desligar notificações das próprias ações; **modo debug** (usuários experientes — exibe erros, variáveis, queries SQL); **Remote access key** (regenera a chave dos fluxos privados ICAL/WEBCAL). *Campos vindos de LDAP podem ser não-editáveis.*

## Personalização geral (General customisation)
| Campo | Valores/observação |
|---|---|
| Language | idioma da interface (prevalece sobre config geral) |
| Display order of surnames | surname,first name / first name,surname |
| Results to display by page | 1–50 (≤ máximo geral) |
| Display tree dropdown complete name in dropdown inputs | Yes/No |
| Display counters | Yes/No (contadores de buscas salvas) |
| Keep devices when purging an item | Yes/No (No por padrão) |
| Results to display on home page | 5–30 |
| CSV delimiter | `;` ou `,` (padrão `;`) |
| Page layout | horizontal/vertical (posição do menu) |
| Enable high contrast | Yes/No |
| Default central bar | dashboard/personal/group/global/RSS |
| Show search from above results | Yes/No |
| Date format | YYYY-MM-DD / DD-MM-YYYY / MM-DD-YYYY |
| Number format | várias máscaras (ex.: 1 234.56) |
| Go to created item after creation | Yes/No |
| Display complete name of tree dropdown in search results | Yes/No |
| Show GLPI ID | Yes/No |
| Notifications for my changes | — |
| PDF export font | — |
| Color palette | tema |
| Rich text field layout | comportamento da barra de formatação |
| Timezone | — |
| Timeline order | natural (antigos no topo) / reverse |

## Assistência e cores de prioridade
Private followups by default (Yes/No); Private tasks by default (Yes/No); Tasks state by default (Information/To do/Done); Pre-select me as a technician when adding a ticket follow-up; Add me as a technician when adding a ticket follow-up; Action button layout (Splitted/Merged); Show new tickets on the home page; Request sources by default (Direct/E-Mail/Fromcreator/Other/Phone/Written); Automatically refresh data (never–30 min); Pre-select me as a requester when creating a ticket; Add me as a technician when adding a ticket solution; Timeline date display (Precise/Relative). **Cores de prioridade** para Tickets/Problems/Changes (seletor ou Hex).

## Progressão de prazo (Due date progression)
Ligado a um Service Level ([[SLM, SLA e OLA]]): cores dos estados; threshold do estado de aviso; threshold do estado crítico (em percentual, horas ou dias).

## Dashboards
Dashboard padrão para: Central (home), Assistance, Assets, Tickets (mini dashboard — pode ser desativado ou exibido na aba de tickets).

## Notifications
Posição das notificações de mudança: Top left / Top right / Bottom left / Bottom right.

## Authorized substitutes
Delegação de validação de tickets a uma ou mais pessoas (não grupos), por período (datas de início/fim; sem fim = até revogação manual).

## Relações
- Detalha: [[Personalização da Experiência do Usuário (capacidade)]].
- Afeta: [[Busca na Interface (uso do motor de busca)]], [[Visualização e Gestão de Registros]], [[Exportação de Resultados de Busca]].
- Ponte de código: [[Priorização (urgência × impacto)]], [[SLM, SLA e OLA]], [[Usuários e Grupos]].
