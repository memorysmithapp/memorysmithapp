---
title: EV-2-d2-001 · Appliances (appliance.rst)
aliases: [appliance.rst, Appliances]
tags: [evidence, management, appliance, aplicacao, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/management/appliance.rst · Appliances"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d2-001 · Appliances (appliance.rst)

Evidência da documentação do usuário GLPI sobre o objeto **Appliance** (aplicações/servidores lógicos) no módulo **Management**.

> [!quote] appliance.rst · introdução
> "The Appliances in GLPI refer to the software and applications managed within the GLPI tool. This includes all software solutions installed on users' machines, servers and other devices within the organisation. Applications can include office applications, business software, operating systems, utilities, etc."

> [!quote] appliance.rst · "The basics fields"
> Campos básicos: Name; Status; Location; Technician in charge; Group in charge; Manufacturer; Alternate username number; Alternate username; Serial number; Inventory number; User; Group; Comments. (todos referenciam `tabs/common_fields/*`)

> [!quote] appliance.rst · "The specifics fields"
> - **Appliance type**: define o contexto do appliance (VOIP, EDM, etc.); selecionável em lista suspensa ou adicionável via botão **+**.
> - **Appliance environment**: designa se a aplicação está em produção, homologação (acceptance), pré-produção etc.; campo adaptável às necessidades.
> - **Pictures**: é possível anexar uma imagem ao appliance.

> [!quote] appliance.rst · "The differents tab"
> Abas: Impact Analysis (diagrama de dependências, salvável e exportável); Items (lista de itens GLPI vinculados, adição manual por lista; um appliance pode ligar-se a outro appliance); Contracts; Documents; Management (informações financeiras e administrativas); Certificates; Domains (representa domínio Internet com nome, data de expiração; ligável a tickets, problems, changes); Knowledge Base; Links (links externos, RDP etc.); Note. Inclui ainda as abas comuns Historical e "all".

Há capturas de tela no doc (não embutidas): `images/appliance.png` (visão geral) e `images/appliance-add-type.png` (adicionar tipo).

## Sustenta
- [[Appliance (aplicação de negócio)]]
- [[Campos do formulário de Appliance]]
- [[Aba Análise de Impacto (diagrama de dependências)]]
