---
title: EV-2-e2-006 · Entidade - abas Ativos, UI, Segurança, Helpdesk home, Usuários e Regras
aliases: [EV-2-e2-006]
tags: [evidence, entidades, ativos, ui, seguranca, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/entity/entities.rst · Assets/UI Customization/Security/Helpdesk home/Users/Rules"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (entities.rst, abas finais)

**Assets**: configura datas de informação administrativa/financeira e opções de ativos por entidade.
- *Autofill dates*: Date of purchase, Order date, Delivery date, Startup date, Start date of warranty, Decommission date. Ações automáticas possíveis: preencher quando o item recebe um status; preencher copiando outra data; sem preenchimento automático.
- *Software*: opção **Entity for software creation** redireciona criação de software para entidade de nível superior (aplica a *todo* software da entidade; para software específico, usar o **dicionário de software**).
- *Transfer*: **Model for automatic entity transfer on inventories** — se um critério de atribuição a entidade muda ao atualizar via inventário, o motor de regras de atribuição é reexecutado e o computador é transferido se a entidade resultante diferir. Escolhas: *Complete* / *No automatic transfer*. `.. note::` opção ausente se houver apenas uma entidade.
- *Automatic inventory*: usado com múltiplos servidores GLPI; o agente recupera a configuração das tarefas deploy/collect/ESX do servidor indicado.
- *Automatically update elements related to computers*: define se dados de equipamentos conectados (impressoras, periféricos…) são atualizados no login/próximo inventário e o comportamento na desconexão. Campos: Alternate username, User, group, Location, Status (copiar ou não ao conectar/atualizar; apagar ou não ao desconectar).

**UI Customization**: regras CSS customizadas por entidade, herdar CSS de entidade-pai ou desabilitar CSS. (Paletas customizadas em artigo dedicado.)

**Security**: forçar ou não a autenticação de dois fatores (2FA).

**Helpdesk home**: personaliza a página inicial do perfil self-service. Botão **+ Add tile** adiciona 3 tipos de bloco: *GLPI page* (ex.: catálogo de serviços, FAQ), *External page*, *Form* (selecionar formulário existente). Para GLPI/External page: título, descrição, ilustração.

**Users**: adiciona usuário à entidade atribuindo um perfil (recursivo ou não); lista usuários por perfil.

**Rules**: cria regras — *Automatic user assignment*, *Assigning an item to an entity*, *Assignment of a ticket created through a mails receiver*. Exibe regras já aplicáveis à entidade atual. (Também inclui abas comuns: Documents, Notes, Historical, All.)

## Sustenta
- [[Abas de configuração da Entidade]]
- [[Regras de atribuição de item a entidade (inventário)]]
- [[Dicionários de dados (administração)]]
