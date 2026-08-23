---
title: Glossário oficial (doc)
aliases: [Glossário da documentação, Official glossary, Glossary]
tags: [glossary, terminology, overview, doc]
type: overview
status: confirmed
source: "[[EV-2-a2-005 · Glossário oficial do GLPI|EV-2-a2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Glossário oficial (doc)

Consolidação do glossário oficial da documentação do GLPI (`glossary.rst`, ~130 termos). Distinto da nota de código [[Glossário]] (derivada do código-fonte na sessão 1): esta reúne a terminologia **da documentação de usuário**, faz among-links para as notas existentes e para as notas atômicas novas, e serve de índice de vocabulário. Ver também [[Visão Geral do GLPI]].

> [!info] Convenção
> Termos que já possuem nota (de código ou de doc) aparecem com `[[link]]`. Termos sem nota própria trazem a definição literal aqui.

## Service desk / ITIL

- **[[Ticket]]** — objeto do GLPI que representa um incidente ou uma requisição de serviço.
- **Incident** — interrupção não planejada ou queda de qualidade de um serviço → [[Gestão de Incidentes e Requisições (processo)]].
- **Requester** — pessoa na origem de um ticket de incidente ou requisição → [[Modelo de Atores ITIL]].
- **Technician** — usuário encarregado do tratamento de tickets → [[Modelo de Atores ITIL]].
- **Supervisor** — pessoa encarregada de um grupo de usuários.
- **Intervention** — ação de um técnico para resolver um incidente.
- **[[Priorização (urgência × impacto)|Priority]]** — escala que identifica a importância relativa de um ticket, resultante de impacto e urgência.
- **Urgency** — critério definido pelo requerente que especifica a velocidade de resolução desejada → [[Priorização (urgência × impacto)]].
- **Impact** — medida do efeito de um incidente, problema ou mudança no processo de negócio.
- **Followup** — troca entre o emissor de um ticket e os responsáveis por ele → [[Fluxo de followups, tarefas e solução]].
- **Task** — ação de uma operação técnica que pode ser planejada → [[Fluxo de followups, tarefas e solução]].
- **Planning** — agendamento de uma tarefa no tempo.
- **Validation** — ação de autorizar o tratamento de um ticket → [[Validação e aprovação (regra)]].
- **Validator** — pessoa que realiza a validação de um ticket → [[Validação e aprovação (regra)]].
- **[[TTO e TTR (indicadores de tempo)|TTO]]** — Time To Own: tempo até a atribuição a um técnico.
- **[[TTO e TTR (indicadores de tempo)|TTR]]** — Time To Resolve: tempo até a resolução completa.
- **[[SLA e níveis de serviço (regra)|SLA]]** — Service-Level Agreement: contrato entre provedor e cliente sobre qualidade de serviço e responsabilidades → [[SLM, SLA e OLA]].
- **Statistics** — resumo de dados do GLPI ligados a tickets → [[Relatórios e estatísticas]].

## Estados de ticket → [[Ciclo de vida de um Ticket (máquina de estados)]]

- **New (ticket)** — status padrão de um ticket.
- **In progress (attributed)** — ticket atribuído a um técnico ou grupo de técnicos.
- **In progress (planned)** — ticket atribuído e para o qual uma ação está planejada.
- **Pending (ticket)** — processamento temporariamente suspenso (não impacta o tempo de processamento).
- **Solved (ticket)** — solução técnica fornecida para um incidente.
- **Closed (ticket)** — solução aprovada pelo emissor ou fechado automaticamente.
- **Administrative closing** / **Automatic closing** → [[Fechamento automático e administrativo de tickets]].
- **Accepted** — estado de uma demanda validada por um aprovador.
- **Refused** — estado de uma demanda invalidada.

## Ativos e inventário

- **[[Glossário|Asset]]** — termo genérico para um elemento inventariável e gerível no GLPI.
- **Case** — elemento físico que contém os componentes de um computador → [[Composição de um Ativo (componentes)]].
- **Controller** — dispositivo que faz interface com outro periférico.
- **Power supply** — bloco que fornece corrente elétrica aos componentes.
- **Volume** — área de armazenamento anexada a um computador.
- **Mount point** — diretório a partir do qual os dados de uma partição são acessados.
- **Cartridge** — consumível usado por uma impressora → [[Reservas e Consumíveis]].
- **Manufacturer** — empresa que produz um hardware.
- **Location** — localização geográfica de um ativo.
- **[[Status de itens (visão específica)|Status]]** — estado de um ativo ou ticket em seu ciclo de vida.
- **[[Gestão global vs unitária de itens|Global management]] / [[Gestão global vs unitária de itens|Unitary management]]** — modos de gestão (um objeto ligado a vários ou a um único computador).
- **Direct connection** — link físico entre um computador e outro ativo.
- **External link** — link exibido no formulário de um ativo, construído dinamicamente com os dados do ativo.
- **User** — usuário de um ativo não registrado na base de usuários do GLPI.

## Rede

- **[[Rede (portas, IP, VLAN)|Network port]]** — interface de rede virtual ou física.
- **[[Rede (portas, IP, VLAN)|VLAN]]** — Virtual Local Area Network.
- **Tagged VLAN** — VLAN cuja tag é transmitida no frame de rede (802.1Q).
- **Virtual network port** — porta que não corresponde a hardware físico.
- **Connection (network)** — link entre duas portas de rede.
- **Network** — nome que define o tipo de conexão (internet, local...).
- **Networks** — hardwares que interconectam equipamentos.
- **Domain** — grupo de ativos conectados a uma rede.
- **FQDN** — Fully Qualified Domain Name (ex.: `www.glpi-project.org`).
- **Label FQDN** — um FQDN é composto de labels separados por pontos (compatível com RFC 1123 §2.1).
- **Mail domain** — parte de um endereço de e-mail após o `@`.

## Entidades e direitos

- **[[Modelo de Entidades (multi-tenancy)|Entity]]** — objeto organizacional que particiona o escopo de visão e ação dos usuários.
- **Root entity** / **Sub-entity** / **[[Recursividade em entidades|Recursivity]]** — ver [[Recursividade em entidades]].
- **Grouping** — fusão de elementos semelhantes de entidades distintas na entidade pai.
- **[[Perfis e Direitos (RBAC)|Profile]]** — conjunto de direitos.
- **Default profile** — perfil atribuído pela aplicação na ausência de configuração particular.
- **[[Perfis e Direitos (RBAC)|Right]]** — autorização de um usuário para uma dada ação.
- **Local right** / **Global right** — permissão por escopo (entidade) vs sobre objetos não vinculados a entidade → [[Recursividade em entidades]].
- **Accreditation** — autorização para executar um conjunto de ações em várias entidades.
- **[[Usuários e Grupos|Group]]** — agrupamento de usuários.
- **[[Interface padrão vs simplificada|Standard interface]] / [[Interface padrão vs simplificada|Simplified interface]]** — interfaces completa vs reduzida (usuários finais).

## Contratos, finanças, fornecedores

- **[[Contratos (Contract)|Contract]]** — documento financeiro ligado a ativos e fornecedores.
- **Tacit renewal** / **Express renewal** — renovação automática vs somente com acordo das partes → [[Gestão de Contratos (processo)]].
- **[[Orçamentos e Custos|Budget]]** — operação contábil que agrupa despesas e receitas provisionais.
- **Depreciation type** — característica da depreciação (linear ou decrescente) → [[Infocom (dados financeiros do ativo)]].
- **Financial information** — dados de faturamento e garantia → [[Infocom (dados financeiros do ativo)]].
- **[[Fornecedores e Contatos|Provider]]** — estrutura jurídica com quem se estabelece relação contratual.
- **Contact** — pessoa referente ligada a um fornecedor → [[Fornecedores e Contatos]].
- **Tier type** — categoria de fornecedores.

## Regras, busca e dados

- **[[Tipos de Regra|Rule]]** — lista de critérios que disparam ações se satisfeitos → [[Motor de Regras (engine)]].
- **Adaptive rule** — regra com ao menos uma ação resultante de regex definida em um critério.
- **Criteria** / **Pattern** / **Regular expression** — elementos de seleção/comparação em buscas e regras.
- **[[Dicionário de dados (dictionary)|Dictionary]]** — conjunto de regras que modificam dados do GLPI.
- **[[Buscas Salvas (Bookmarks)|Saved search]] / [[Buscas Salvas (Bookmarks)|Bookmark]]** — estado de busca gravado / link rápido a uma página.
- **[[Dropdown (lista suspensa customizável)|Dropdown]]** — lista suspensa customizável.
- **Report** — documento que resume dados do GLPI → [[Relatórios e estatísticas]].
- **Global view** / **Personal view** — colunas de lista comuns a todos vs específicas de um usuário.
- **Logs** — lista de eventos ocorridos durante o uso do GLPI.
- **Service** — ação geral do GLPI listada nos eventos.

## Autenticação e usuários

- **[[Autenticação (Auth)|SSO]]** — Single Sign On → [[Autenticação e Single Sign-On (processo)]].
- **[[Autenticação (Auth)|LDAP directory]]** — serviço de diretório via protocolo LDAP.
- **Active Directory service** — diretório compatível com LDAP, da Microsoft (AD).
- **Identifier** — nome de conexão de um usuário (login).
- **Registered user** — pessoa com acreditação para conectar ao GLPI.
- **Preferences** — parâmetros pessoais de um usuário.
- **Collector** — funcionalidade que cria tickets/followups importando mensagens de uma caixa de correio → [[Coletor de E-mail (MailCollector)]].
- **IMAP/POP** — protocolos de mensagens para recuperar e-mails.

## Base de conhecimento

- **[[Base de Conhecimento (KnowbaseItem)|Knowledge base]]** — base para reunir, analisar, armazenar e compartilhar conhecimento.
- **FAQ** — seleção de itens da base de conhecimento disponibilizados independentemente (ex.: artigos acessíveis na interface simplificada).
- **Subject** — título ou questão de um elemento da base de conhecimento.

## Conceitos gerais

- **[[Ações em massa (massive actions)|Actions]]** — agrupamento em lista de manejos disponíveis dos objetos do GLPI.
- **[[Lixeira e purga (trash bin)|Trash bin]] / Purge / Restoration** — lixeira, purga e restauração.
- **[[Transferência de itens entre entidades (processo)|Transfer]]** — mover um objeto de uma entidade para outra.
- **[[Templates de itens (modelos)|Template]]** — modelo reutilizável de objeto com campos predefinidos.
- **[[Sistema de Plugins (Hooks)|Plugin]]** — extensão que adiciona funcionalidades e/ou modifica comportamentos.
- **[[Documentos (Document)|Document]]** — elemento que define link e/ou armazena arquivo, associável a outros objetos.
- **[[Notas em GLPI (pessoal, pública, global, privada)|Personal/Public/Global note]] / Private / Public** — notas e visibilidade.
- **[[Reserva de Ativos e Documentos (processos)|Booking]]** — elemento reservado por um período.
- **[[Ações Automáticas (CronTask)|Automatic action]]** — processo de disparo regular de ações (interno ou externo: cron Unix, tarefas planejadas Windows).
- **Alert threshold** — valor mínimo a partir do qual um alerta é disparado.
- **CLI** — Command Line Interface.
- **ID** / **Identifier** — identificador técnico / nome de conexão.
- **Path** / **Tree** — endereço em estrutura de árvore / organização hierárquica.
- **Hive** — entrada no registro do Windows.
- **PDU** — Power Distribution Unit → [[DCIM (Datacenter → Rack)]].
- **ICAL / Webcal / VCard** — formatos de import/export de calendário e cartão de visita.
- **Replicate (MySQL)** — banco MySQL usado se o principal estiver indisponível.

> [!note] Conflitos doc×código
> Nenhuma contradição identificada entre o glossário da documentação e as notas de código existentes; os termos ou coincidem ou complementam as notas da sessão 1.
