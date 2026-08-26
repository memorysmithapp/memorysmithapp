---
title: EV-2-b1-008 · Recursos avançados de tickets (collectors, fechamento, satisfação)
aliases: [EV-2-b1-008]
tags: [evidence, assistance, ticket, advanced, collector, satisfaction, closure]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/assistance/tickets/ticketadvanced.rst · To go further"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-008 · Recursos avançados de tickets (collectors, fechamento, satisfação)

> [!quote] ticketadvanced.rst — "Collectors"
> Ferramentas externas podem interagir com o módulo por meio de mail collectors. O e-mail cria tickets e adiciona followups a tickets existentes; uma tarefa interna conecta a uma caixa de correio e busca mensagens. **A solução ou o fechamento de um ticket NÃO estão disponíveis via collectors.** Etapas de uma mensagem: Mail box → Collector → Rules → Business rules → ticket criado. Resposta a um e-mail vindo do GLPI: Mail box → Collector → criação de followup no ticket relacionado.

> [!quote] ticketadvanced.rst — outros tópicos "To go further"
> Também referenciados: categorias de tickets, templates de ticket (mascarar/predefinir/tornar obrigatórios campos), tickets recorrentes, custos anexados (Attached costs), vínculos entre tickets, tempo de processamento/SLA e regras de negócio para modificar e atribuir tickets.

> [!quote] ticketadvanced.rst — "Administrative closure"
> O fechamento administrativo move o status de *Solved* para *Closed*. O ITIL recomenda validação da solução pelo requerente; se ele não a fizer, é possível parametrizar um fechamento administrativo após um atraso configurável **por entidade**. Se o atraso for zero, o ticket é fechado automaticamente.

> [!quote] ticketadvanced.rst — "Satisfaction"
> Uma pesquisa de satisfação é disparada quando o status vira *Closed* e o atraso de disparo (parametrizado por entidade) se esgota. A tarefa automática que dispara a pesquisa deve estar ativada. Ao fechar, uma notificação com link para a pesquisa pode ser enviada ao requerente, que também acessa a pesquisa pela aba `Satisfaction`. O requerente seleciona o nível de satisfação (de **0 a 5 estrelas**) e pode adicionar um comentário. Pode alterar a resposta dentro de **12 horas** após a primeira. Uma notificação pode ser enviada na geração da pesquisa e a cada resposta. Estatísticas disponíveis.

## Sustenta
- [[Collectors de e-mail no Assistance]]
- [[Pesquisa de satisfação (fluxo)]]
- [[Ciclo de vida do ticket (visão do usuário)]]
