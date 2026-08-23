---
title: EV-2-b1-003 · Campos específicos da abertura na interface simplificada
aliases: [EV-2-b1-003]
tags: [evidence, assistance, ticket, opening, simplified-interface, fields]
type: evidence
status: confirmed
source: "SRC-002 · source/modules/assistance/tickets/ticketopening.rst · Simplified interface"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-003 · Campos específicos da abertura na interface simplificada

> [!quote] ticketopening.rst — "Simplified interface"
> Permite a um usuário autenticado abrir rapidamente um ticket, para si ou por delegação para outra pessoa. O formulário pode vir acompanhado de mensagem convidando o usuário a verificar suas informações pessoais (localização, telefone) para ser facilmente contatado.
> Campos específicos:
> - **Inform me about the actions taken**: aparece se os followups por e-mail estiverem configurados. Se `Yes`, o requerente é mantido informado por e-mail dos processamentos do ticket. O campo *Mail* contém o endereço para o qual as notificações serão enviadas; se houver vários, o GLPI seleciona o e-mail padrão das preferências do usuário, sendo possível escolher outro ou digitar um endereço se o perfil não tiver e-mail;
> - **Associated elements**: permite associar um item do inventário ao ticket; o conteúdo da lista depende dos parâmetros do perfil do usuário;
> - **Watchers**: permite adicionar um observador e definir parâmetros de notificação.

> [!warning] ticketopening.rst — aviso
> Se imagens ou documentos forem adicionados ao ticket, é importante anexá-los **depois** de preencher **todos** os campos obrigatórios marcados com estrela vermelha, pois o recarregamento do formulário disparado por um campo obrigatório faltante suprime as imagens/documentos anexados.

> [!note]
> Uma mensagem confirma a criação do ticket, então acessível clicando no número do ticket destacado em verde.

## Sustenta
- [[Campos específicos da abertura simplificada]]
- [[Abertura de um chamado (fluxo)]]
- [[Interfaces de abertura de chamado]]
