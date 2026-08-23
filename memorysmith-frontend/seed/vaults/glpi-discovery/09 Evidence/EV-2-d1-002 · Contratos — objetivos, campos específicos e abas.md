---
title: EV-2-d1-002 · Contratos — objetivos, campos específicos e abas
aliases: [EV-2-d1-002]
tags: [evidence, management, contract, doc, financial]
type: evidence
status: confirmed
source: "SRC-002 · source/modules/management/contract.rst · Contracts"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d1-002 · Contratos — objetivos, campos específicos e abas

> [!quote] contract.rst · "Contracts"
> "GLPI supports contracts management, in order to manage contract types such as loan, maintenance, support...". Permite: inventariar todos os contratos ligados aos ativos da organização; integrar contratos na gestão financeira do GLPI; antecipar e acompanhar a renovação de contratos. Novo contrato: botão **+ Add** no topo da tela; é possível usar *template*.

> [!quote] contract.rst · nota sobre notificações
> É possível receber notificações para ser informado de eventos como o fim do contrato. Para contratos que exigem renovação expressa, é útil ser notificado antes do fim. Para contratos periódicos, também é possível ser notificado ao fim de cada período. As notificações são configuradas ao nível da entidade, em **Setup > Notifications** (modelos e destino) e em **Administration > Entities** (habilitar notificação, valores padrão e antecipação).

> [!quote] contract.rst · "Description of specific fields"
> Campos específicos: **Contract type** (nenhum por padrão; configurado no dropdown); **Number** (número do contrato); **Start date** (todos os eventos de periodicidade são calculados a partir dela); **Initial contract period** (com a start date, faz aparecer a data de fim, em vermelho se expirado); **Notice** (dispara alertas); **Account number** (liga ao software contábil da empresa); **Contract renewal period** (duração após a qual a renovação fica disponível); **Invoice period** (duração entre faturas); **Renewal** (*Tacit* = renovação automática se ninguém encerrar / *Express* = requer acordo); **Max number of items** (bloqueia anexar novos itens ao ultrapassar o número); **Support hours** (horas de suporte, distinguindo dias úteis, sábados e domingos/feriados).

> [!quote] contract.rst · "The different tabs"
> Aba **Costs**: define um custo ligado ao contrato e a um orçamento GLPI (o custo é imputado a esse orçamento). Procedimento: *Add a new cost* → **name**, datas de **start**/**end** cobertas, selecionar um **budget** (ou criar), inserir o **real cost**. Todos os custos ficam visíveis e somados na mesma aba. Aba **Suppliers**: associa um ou vários fornecedores ao contrato (selecionar no dropdown). Inclui ainda abas padrão: Items, Documents, External links, Notes, Historical, Debug, All.

## Sustenta
- [[Contrato na interface (Contract) — visão do usuário]]
- [[Gestão de Contratos (visão do usuário)]]
- [[Campos do formulário de Contrato]]
- [[Abas do formulário de Contrato]]
- [[Adicionar um custo a um contrato (procedimento)]]
- [[Alertas de renovação e vencimento (contratos, licenças, certificados)]]
