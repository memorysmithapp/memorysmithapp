---
title: EV-2-a1-009 · Preferências do usuário (abas e campos)
aliases: [EV-2-a1-009]
tags: [evidence, doc, preferences, personalization, mfa, 2fa, fields, timezone]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/preferences.rst · Manage your Preferences (Main / Two-factor authentication / Personalization / Personal View)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-009 · Preferências do usuário (abas e campos)

> [!quote] source/first-steps/preferences.rst
> "User preferences are accessible from the `Preferences` tab of the user form by clicking on your name at the top right of the interface, from any page. Each authenticated user has the possibility to modify his preferences if they have the `Personalize` update right in their profile."
> "These options override the default ones set in the general setup."

## Aba Principal (Main)
Campos usuais: Surname, First name, Email address, Phone numbers, Location, Language, etc. Alguns campos não podem ser modificados se vierem de diretório LDAP. O usuário pode adicionar endereços de email e selecionar o padrão (usado para notificações), definir comportamentos padrão (perfil e entidade selecionados), desligar notificações das próprias ações. Conforme o perfil, o usuário experiente pode sair do modo normal e ativar o **modo debug** (exibe erros, valores de variáveis, queries SQL, etc.). A seção **Remote access key** regenera a chave de segurança para acessar os fluxos privados (ICAL e WEBCAL do planejamento estão protegidos por essa chave embutida na URL).

## Aba Autenticação de dois fatores (2FA/MFA)
> [!quote]
> "MFA (Multi Factor Authentication) is now native to GLPI." Após a senha, insere-se o código de acesso de um app (Free OTP, Authy, Authenticator, etc.).

Procedimento: baixar app → Preferences (canto superior direito) → my settings > Two-factor authentication (2FA) → no app, "+"/novo e escanear QR code (ou inserir código diretamente) → inserir o código gerado no GLPI → **verify**. Guardar os **backup codes** (usados se o app ficar inacessível). Pela aba é possível desabilitar o MFA (perde os códigos) e regenerar backup codes (sobrescreve os antigos).

## Aba Personalização (Personalization)
Muda o comportamento da interface. Divide-se em partes:

**General customisation** — Language; Display order of surnames; Results to display by page (1–50); Display the tree dropdown complete name in dropdown inputs (Yes/No); Display counters (Yes/No); Keep devices when purging an item (Yes/No, No por padrão); Results to display on home page (5–30); CSV delimiter (`;` ou `,`, padrão `;`); Page layout (horizontal/vertical); Enable high contrast (Yes/No); Default central bar (dashboard/personal/group/global/RSS); Show search from above results (Yes/No); Date format (YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY); Number format; Go to created item after creation (Yes/No); Display complete name of tree dropdown in search results (Yes/No); Show GLPI ID (Yes/No); Notifications for my changes; PDF export font; Color palette (tema); Rich text field layout; Timezone; Timeline order (natural/reverse).
> [!note] O nº de resultados por página aqui não pode exceder o máximo definido nas opções gerais de exibição.

**Assistance customisation and priority colors** — Private followups by default; Private tasks by default; Tasks state by default (Information/To do/Done); Pre-select me as a technician when adding a ticket follow-up; Add me as a technician when adding a ticket follow-up; Action button layout (Splitted/Merged); Show new tickets on the home page; Request sources by default (Direct/E-Mail/Fromcreator/Other/Phone/Written); Automatically refresh data (tickets list, project kanban) in minutes (never–30); Pre-select me as a requester when creating a ticket; Add me as a technician when adding a ticket solution; Timeline date display (Precise/Relative). Permite alterar as **cores de prioridade** (Tickets, Problems, Changes) por seletor ou código Hex.
> [!warning] O refresh automático pode ocorrer enquanto se escreve um followup, causando perda do texto — recomenda-se desativar.

**Due date progression** — ao adicionar um Service Level: cores dos estados; threshold do estado de aviso; threshold do estado crítico (em percentual, horas ou dias).

**Dashboards** — dashboard padrão para: Central (home), Assistance, Assets, Tickets (mini dashboard, que pode ser desativado ou exibido na aba de tickets).

**Notifications** — posição das notificações de mudanças: Top left / Top right / Bottom left / Bottom right.

**Authorized substitutes** — delegar validação de tickets a uma ou mais pessoas (grupos não disponíveis aqui) por um período (datas de início/fim; sem data de fim, até revogação manual).

## Aba Visão Pessoal (Personal View)
Lista visões customizadas definidas nos objetos pelo usuário; permite apagá-las para voltar às visões globais.

## Sustenta
- [[Personalização da Experiência do Usuário (capacidade)]]
- [[Campos das Preferências do Usuário]]
- [[Configuração de MFA e 2FA]]
