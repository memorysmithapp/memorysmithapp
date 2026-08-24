---
title: Registro de Evidências
aliases: [Evidence log, Registro de Evidências]
tags: [moc, evidencias]
type: moc
maturity: evergreen
reviewed: false
author: CAD Discovery
created: 2026-07-10
---

# Registro de Evidências

Índice de todas as notas de evidência do vault, por fonte e módulo. Cada nota de Knowledge
aponta para uma destas via `source:`.

## SRC-001 · GLPI 11.0.7 (`codebase/in/glpi`)

### Módulo 1 — Foundation & Overview
| ID                                                                                     | Resumo                                                        | Localização                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| [[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete\|EV-1-001]] | CommonDBTM é o active-record base com ciclo add/update/delete | `src/CommonDBTM.php`                |
| [[EV-1-002 · Constantes globais e bitmask de direitos\|EV-1-002]]                      | Constantes globais e bitmask de direitos                      | `src/autoload/constants.php`        |
| [[EV-1-003 · Entity é árvore com herança de configuração\|EV-1-003]]                   | Entity é árvore com herança de configuração                   | `src/Entity.php`                    |
| [[EV-1-004 · Kernel Symfony MicroKernel envolve o legado\|EV-1-004]]                   | Kernel Symfony MicroKernel envolve o legado                   | `src/Glpi/Kernel/Kernel.php`        |
| [[EV-1-005 · Motor de busca SQL dirigido por SEARCH_OPTION\|EV-1-005]]                 | Motor de busca SQL dirigido por SEARCH_OPTION                 | `src/Search.php`, `SQLProvider.php` |
| [[EV-1-006 · Profile e ProfileRight definem RBAC helpdesk vs standard\|EV-1-006]]      | Profile/ProfileRight — RBAC helpdesk vs standard              | `src/Profile.php`                   |
| [[EV-1-007 · Hooks de plugin no ciclo de vida dos itens\|EV-1-007]]                    | Hooks de plugin no ciclo de vida                              | `src/CommonDBTM.php`                |

### Módulo 2 — Service Desk / ITIL
| ID | Resumo | Localização |
|---|---|---|
| [[EV-1-008 · CommonITILObject define statuses e matriz de prioridade\|EV-1-008]] | CommonITILObject define statuses e matriz de prioridade | `src/CommonITILObject.php` |
| [[EV-1-009 · Atores ITIL requester-assign-observer\|EV-1-009]] | Atores ITIL (requester/assign/observer) | `src/CommonITILActor.php`, `src/Ticket.php` |
| [[EV-1-010 · Ticket com tipos incidente-requisição e direitos específicos\|EV-1-010]] | Ticket com tipos incidente/requisição e direitos | `src/Ticket.php` |
| [[EV-1-011 · SLM SLA e OLA com TTR-TTO e níveis de escalonamento\|EV-1-011]] | SLM/SLA/OLA (TTR/TTO) e níveis de escalonamento | `src/SLM.php`, `LevelAgreement.php`, `SLA.php`, `OLA.php` |
| [[EV-1-012 · Validação ITIL e artefatos filhos followup-task-solution\|EV-1-012]] | Validação ITIL + followup/task/solution | `src/CommonITILValidation.php`, `ITILFollowup.php`, `ITILSolution.php` |
| [[EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias\|EV-1-013]] | Change e Problem com fases próprias | `src/Change.php`, `src/Problem.php` |
| [[EV-1-014 · Categorias e templates ITIL\|EV-1-014]] | Categorias e templates ITIL | `src/ITILCategory.php`, `ITILTemplate.php` |

### Módulo 3 — Ativos & Inventário (CMDB/DCIM)
| ID | Resumo | Localização |
|---|---|---|
| [[EV-1-015 · Ativos herdam CommonDBTM com traits Assignable-State-Inventoriable\|EV-1-015]] | Ativos herdam CommonDBTM + traits Assignable/State/Inventoriable | `src/Computer.php`, `Monitor.php`, … |
| [[EV-1-016 · Composição do ativo via Item_Devices e itens filhos\|EV-1-016]] | Composição via Item_Devices (18 tipos) e itens-filhos | `src/Item_Devices.php`, `src/Device*.php` |
| [[EV-1-017 · Software versões e licenças\|EV-1-017]] | Software, versões e licenças | `src/Software*.php`, `Item_SoftwareVersion.php` |
| [[EV-1-018 · Rede NetworkPort IPAddress IPNetwork\|EV-1-018]] | Rede — NetworkPort/IPAddress/IPNetwork/Vlan | `src/NetworkPort.php`, `IPAddress.php`, `IPNetwork.php` |
| [[EV-1-019 · DCIM Datacenter Rack Item_Rack\|EV-1-019]] | DCIM — Datacenter/DCRoom/Rack/Item_Rack | `src/Datacenter.php`, `Rack.php`, `Item_Rack.php` |
| [[EV-1-020 · Infocom dados administrativos e financeiros do ativo\|EV-1-020]] | Infocom (dados financeiros/administrativos) | `src/Infocom.php` |
| [[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset\|EV-1-021]] | Inventário nativo orquestra parsers InventoryAsset | `src/Glpi/Inventory/Inventory.php` |
| [[EV-1-022 · Ativos customizáveis AssetDefinition com capacities e custom fields\|EV-1-022]] | Ativos customizáveis (AssetDefinition + capacities) | `src/Glpi/Asset/AssetDefinition.php` |

### Módulo 4 — Gestão (contratos, financeiro, documentos, projetos)
| ID | Resumo | Localização |
|---|---|---|
| [[EV-1-023 · Contract com renovação alerta custos e vínculo a itens\|EV-1-023]] | Contract — renovação, alerta, custos, vínculo a itens | `src/Contract.php`, `Contract_Item.php`, `ContractCost.php` |
| [[EV-1-024 · Supplier Contact e Budget\|EV-1-024]] | Supplier, Contact e Budget | `src/Supplier.php`, `Contact.php`, `Budget.php` |
| [[EV-1-025 · Document com dedup sha1 e Document_Item polimórfico\|EV-1-025]] | Document — dedup sha1 + Document_Item polimórfico | `src/Document.php`, `Document_Item.php` |
| [[EV-1-026 · Project ProjectTask ProjectTeam e ProjectCost\|EV-1-026]] | Project/ProjectTask/ProjectTeam/ProjectCost | `src/Project.php`, `ProjectTask.php` |
| [[EV-1-027 · Reservation e Consumíveis-Cartuchos\|EV-1-027]] | Reservation + consumíveis/cartuchos | `src/Reservation.php`, `Consumable.php`, `Cartridge.php` |

### Módulo 5 — Administração & Segurança
| ID | Resumo | Localização |
|---|---|---|
| [[EV-1-028 · User Group e Profile_User binding RBAC\|EV-1-028]] | User, Group e Profile_User (RBAC × entidade) | `src/User.php`, `Group.php`, `Profile_User.php` |
| [[EV-1-029 · Auth com múltiplos métodos e 2FA\|EV-1-029]] | Auth — 8 métodos de autenticação + 2FA | `src/Auth.php` |
| [[EV-1-030 · AuthLDAP diretório e sincronização\|EV-1-030]] | AuthLDAP (diretório) e sincronização | `src/AuthLDAP.php`, `AuthMail.php` |
| [[EV-1-031 · Motor de regras Rule RuleCollection Criteria Action\|EV-1-031]] | Motor de regras (Rule/Collection/Criteria/Action) | `src/Rule.php`, `RuleCollection.php` |
| [[EV-1-032 · Tipos de regra especializados\|EV-1-032]] | Tipos de regra especializados | `src/RuleRight.php`, `RuleTicket.php`, `RuleImportAsset.php` |
| [[EV-1-033 · KnowbaseItem base de conhecimento com visibilidade\|EV-1-033]] | KnowbaseItem — KB com visibilidade | `src/KnowbaseItem.php` |

### Módulo 6 — Integrações & Arquitetura Operacional
| ID | Resumo | Localização |
| --- | --- | --- |
| [[EV-1-034 · API v2 HL Router REST GraphQL OAuth RSQL\|EV-1-034]] | API v2 (HL Router) — REST + GraphQL, OAuth, RSQL | `src/Glpi/Api/HL/Router.php`, `Glpi/Api/API.php`   |
| [[EV-1-035 · Notificações event template target queue\|EV-1-035]] | Notificações — event/template/target/queue       | `src/Notification*.php`, `QueuedNotification.php`  |
| [[EV-1-036 · MailCollector e-mail para chamado\|EV-1-036]] | MailCollector — e-mail para chamado              | `src/MailCollector.php`                            |
| [[EV-1-037 · CronTask ações automáticas interno externo\|EV-1-037]] | CronTask — ações automáticas (interno/externo)   | `src/CronTask.php`                                 |
| [[EV-1-038 · Agente de inventário protocolo XML-JSON OAuth\|EV-1-038]] | Agente de inventário — XML/JSON, OAuth           | `src/Glpi/Agent/Communication/AbstractRequest.php` |
| [[EV-1-039 · Plugin Config e Migration\|EV-1-039]] | Plugin, Config e Migration                       | `src/Plugin.php`, `Config.php`, `Migration.php`    |

**Total: 39 evidências (EV-1-001 … EV-1-039) em 6 módulos, todas sobre SRC-001 (GLPI 11.0.7).**

---

## SRC-002 · Documentação oficial do usuário do GLPI 11.0 (`codebase/in/doc`)

Fonte **Corporativa** (documentação oficial). 227 arquivos `.rst` (Sphinx/reStructuredText). Extraída na **sessão 2** em 7 etapas de valor (E1…E7), via map-reduce. Cada evidência abaixo referencia o `.rst` de origem em `source:` na própria nota.

### Etapa E1 — Uso geral, interface e navegação (getting_started, glossary)

| ID | Resumo |
|---|---|
| [[EV-2-a1-001 · Prefácio e estrutura da documentação do usuário GLPI\|EV-2-a1-001]] | Prefácio e estrutura da documentação do usuário GLPI |
| [[EV-2-a1-002 · Administração de controles de acesso\|EV-2-a1-002]] | Administração de controles de acesso |
| [[EV-2-a1-003 · Navegador, conexão e fim de sessão\|EV-2-a1-003]] | Navegador, conexão e fim de sessão |
| [[EV-2-a1-004 · Interface padrão e interface simplificada\|EV-2-a1-004]] | Interface padrão e interface simplificada |
| [[EV-2-a1-005 · Navegação por módulos, atalhos de teclado e busca fuzzy\|EV-2-a1-005]] | Navegação por módulos, atalhos de teclado e busca fuzzy |
| [[EV-2-a1-006 · Visualização e gestão de registros (listas e abas)\|EV-2-a1-006]] | Visualização e gestão de registros (listas e abas) |
| [[EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)\|EV-2-a1-007]] | Motor de busca da UI (básica, multicritério, avançada, export, ações massivas) |
| [[EV-2-a1-008 · Buscas salvas (bookmarks), contadores e alertas\|EV-2-a1-008]] | Buscas salvas (bookmarks), contadores e alertas |
| [[EV-2-a1-009 · Preferências do usuário (abas e campos)\|EV-2-a1-009]] | Preferências do usuário (abas e campos) |
| [[EV-2-a1-010 · Gestão e recuperação de senha\|EV-2-a1-010]] | Gestão e recuperação de senha |
| [[EV-2-a1-011 · Áreas da interface do GLPI\|EV-2-a1-011]] | Áreas da interface do GLPI |
| [[EV-2-a1-012 · Comunidade, catálogo de plugins e parceiros\|EV-2-a1-012]] | Comunidade, catálogo de plugins e parceiros |
| [[EV-2-a2-001 · Ações sobre objetos e ações em massa\|EV-2-a2-001]] | Ações sobre objetos e ações em massa |
| [[EV-2-a2-002 · Quadro Kanban\|EV-2-a2-002]] | Quadro Kanban |
| [[EV-2-a2-003 · Status como visão específica\|EV-2-a2-003]] | Status como visão específica |
| [[EV-2-a2-004 · Gestão de templates (ativos e tickets)\|EV-2-a2-004]] | Gestão de templates (ativos e tickets) |
| [[EV-2-a2-005 · Glossário oficial do GLPI\|EV-2-a2-005]] | Glossário oficial do GLPI |

### Etapa E2 — Assistance / Service Desk (assistance)

| ID | Resumo |
|---|---|
| [[EV-2-b1-001 · Módulo Assistance (visão geral)\|EV-2-b1-001]] | Módulo Assistance (visão geral) |
| [[EV-2-b1-002 · Ferramentas e interfaces de abertura de chamado\|EV-2-b1-002]] | Ferramentas e interfaces de abertura de chamado |
| [[EV-2-b1-003 · Campos específicos da abertura na interface simplificada\|EV-2-b1-003]] | Campos específicos da abertura na interface simplificada |
| [[EV-2-b1-004 · Abertura padrão, por e-mail e automática\|EV-2-b1-004]] | Abertura padrão, por e-mail e automática |
| [[EV-2-b1-005 · Ciclo de vida do ticket (tipos, status, priorização, regras)\|EV-2-b1-005]] | Ciclo de vida do ticket (tipos, status, priorização, regras) |
| [[EV-2-b1-006 · Campos específicos do formulário de ticket\|EV-2-b1-006]] | Campos específicos do formulário de ticket |
| [[EV-2-b1-007 · Abas do ticket e followups\|EV-2-b1-007]] | Abas do ticket e followups |
| [[EV-2-b1-008 · Recursos avançados de tickets (collectors, fechamento, satisfação)\|EV-2-b1-008]] | Recursos avançados de tickets (collectors, fechamento, satisfação) |
| [[EV-2-b1-009 · Campos do ticket recorrente\|EV-2-b1-009]] | Campos do ticket recorrente |
| [[EV-2-b1-010 · Atores e papéis de um chamado\|EV-2-b1-010]] | Atores e papéis de um chamado |
| [[EV-2-b1-011 · Categorias ITIL e de tarefa\|EV-2-b1-011]] | Categorias ITIL e de tarefa |
| [[EV-2-b2-001 · Gestão de mudanças — formulário, abas e fluxo\|EV-2-b2-001]] | Gestão de mudanças — formulário, abas e fluxo |
| [[EV-2-b2-002 · Gestão de problemas — formulário e abas\|EV-2-b2-002]] | Gestão de problemas — formulário e abas |
| [[EV-2-b2-003 · Planejamento (agenda) — visões e autorizações\|EV-2-b2-003]] | Planejamento (agenda) — visões e autorizações |
| [[EV-2-b2-004 · Estatísticas do service desk — relatórios de tickets\|EV-2-b2-004]] | Estatísticas do service desk — relatórios de tickets |
| [[EV-2-b2-005 · Matriz de cálculo de prioridade (urgência × impacto)\|EV-2-b2-005]] | Matriz de cálculo de prioridade (urgência × impacto) |
| [[EV-2-b2-006 · Matriz de ciclo de vida por perfil (transições de status)\|EV-2-b2-006]] | Matriz de ciclo de vida por perfil (transições de status) |

### Etapa E3 — Ativos e Inventário (assets)

| ID | Resumo |
|---|---|
| [[EV-2-c1-001 · Módulo Assets e tipos de ativo disponíveis\|EV-2-c1-001]] | Módulo Assets e tipos de ativo disponíveis |
| [[EV-2-c1-002 · Busca global de ativos (Global search)\|EV-2-c1-002]] | Busca global de ativos (Global search) |
| [[EV-2-c1-003 · Formulário e abas de Computador\|EV-2-c1-003]] | Formulário e abas de Computador |
| [[EV-2-c1-004 · Formulário de Monitor e gestão unitária vs global\|EV-2-c1-004]] | Formulário de Monitor e gestão unitária vs global |
| [[EV-2-c1-005 · Formulário e abas de Periférico\|EV-2-c1-005]] | Formulário e abas de Periférico |
| [[EV-2-c1-006 · Formulário e abas de Telefone\|EV-2-c1-006]] | Formulário e abas de Telefone |
| [[EV-2-c1-007 · Formulário e abas de Impressora\|EV-2-c1-007]] | Formulário e abas de Impressora |
| [[EV-2-c1-008 · Formulário de Cartão SIM\|EV-2-c1-008]] | Formulário de Cartão SIM |
| [[EV-2-c1-009 · Ativos não gerenciados e conversão de tipo\|EV-2-c1-009]] | Ativos não gerenciados e conversão de tipo |
| [[EV-2-c2-001 · Equipamentos de rede (network-equipments.rst)\|EV-2-c2-001]] | Equipamentos de rede (network-equipments.rst) |
| [[EV-2-c2-002 · Dispositivos passivos (passives_devices.rst)\|EV-2-c2-002]] | Dispositivos passivos (passives_devices.rst) |
| [[EV-2-c2-003 · PDUs (pdus.rst)\|EV-2-c2-003]] | PDUs (pdus.rst) |
| [[EV-2-c2-004 · Enclosures (enclosures.rst)\|EV-2-c2-004]] | Enclosures (enclosures.rst) |
| [[EV-2-c2-005 · Racks (racks.rst)\|EV-2-c2-005]] | Racks (racks.rst) |
| [[EV-2-c2-006 · Cabos (cables.rst)\|EV-2-c2-006]] | Cabos (cables.rst) |
| [[EV-2-c2-007 · Software, versões e licenças (softwares.rst)\|EV-2-c2-007]] | Software, versões e licenças (softwares.rst) |
| [[EV-2-c2-008 · Instalações e agrupamento de software (softwares.rst)\|EV-2-c2-008]] | Instalações e agrupamento de software (softwares.rst) |
| [[EV-2-c2-009 · Cartuchos (cartridges.rst)\|EV-2-c2-009]] | Cartuchos (cartridges.rst) |
| [[EV-2-c2-010 · Consumíveis (consumables.rst)\|EV-2-c2-010]] | Consumíveis (consumables.rst) |
| [[EV-2-c2-011 · Bancos de dados — stub (databases.rst)\|EV-2-c2-011]] | Bancos de dados — stub (databases.rst) |
| [[EV-2-c3-001 · Aba Antivírus de um Computador\|EV-2-c3-001]] | Aba Antivírus de um Computador |
| [[EV-2-c3-002 · Aba Componentes de Hardware de um Computador\|EV-2-c3-002]] | Aba Componentes de Hardware de um Computador |
| [[EV-2-c3-003 · Aba Conexões Diretas entre hardwares\|EV-2-c3-003]] | Aba Conexões Diretas entre hardwares |
| [[EV-2-c3-004 · Aba Portas de Rede de um Computador\|EV-2-c3-004]] | Aba Portas de Rede de um Computador |
| [[EV-2-c3-005 · Aba Nome de Rede (Network Name)\|EV-2-c3-005]] | Aba Nome de Rede (Network Name) |
| [[EV-2-c3-006 · Aba Sistema Operacional de um Computador\|EV-2-c3-006]] | Aba Sistema Operacional de um Computador |
| [[EV-2-c3-007 · Aba Softwares instalados num Computador\|EV-2-c3-007]] | Aba Softwares instalados num Computador |
| [[EV-2-c3-008 · Aba Volumes de um Computador\|EV-2-c3-008]] | Aba Volumes de um Computador |
| [[EV-2-c3-009 · Aba Virtualização de um host\|EV-2-c3-009]] | Aba Virtualização de um host |
| [[EV-2-c3-010 · Abas Links Externos e Bloqueios (locks)\|EV-2-c3-010]] | Abas Links Externos e Bloqueios (locks) |
| [[EV-2-c3-011 · Abas Itens de Enclosure e Itens de Rack (DCIM)\|EV-2-c3-011]] | Abas Itens de Enclosure e Itens de Rack (DCIM) |
| [[EV-2-c3-012 · Aba Tomadas (Plugs) de um PDU\|EV-2-c3-012]] | Aba Tomadas (Plugs) de um PDU |

### Etapa E4 — Gestão (management)

| ID | Resumo |
|---|---|
| [[EV-2-d1-001 · Índice do módulo Management e itens geridos\|EV-2-d1-001]] | Índice do módulo Management e itens geridos |
| [[EV-2-d1-002 · Contratos — objetivos, campos específicos e abas\|EV-2-d1-002]] | Contratos — objetivos, campos específicos e abas |
| [[EV-2-d1-003 · Fornecedores — definição, distinção fornecedor×fabricante e abas\|EV-2-d1-003]] | Fornecedores — definição, distinção fornecedor×fabricante e abas |
| [[EV-2-d1-004 · Contatos — definição, títulos e vCard\|EV-2-d1-004]] | Contatos — definição, títulos e vCard |
| [[EV-2-d1-005 · Orçamentos — definição, criação e abas\|EV-2-d1-005]] | Orçamentos — definição, criação e abas |
| [[EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis\|EV-2-d1-006]] | Documentos — armazenamento, cabeçalhos e itens vinculáveis |
| [[EV-2-d1-007 · Tipos de arquivo autorizados para upload de documentos\|EV-2-d1-007]] | Tipos de arquivo autorizados para upload de documentos |
| [[EV-2-d1-008 · Licenças de software — objetivos, campos e abas\|EV-2-d1-008]] | Licenças de software — objetivos, campos e abas |
| [[EV-2-d1-009 · Certificados — objetivos, campos e abas\|EV-2-d1-009]] | Certificados — objetivos, campos e abas |
| [[EV-2-d2-001 · Appliances (appliance.rst)\|EV-2-d2-001]] | Appliances (appliance.rst) |
| [[EV-2-d2-002 · Clusters (clusters.rst)\|EV-2-d2-002]] | Clusters (clusters.rst) |
| [[EV-2-d2-003 · Data centers, salas de servidores e racks (data-centers.rst)\|EV-2-d2-003]] | Data centers, salas de servidores e racks (data-centers.rst) |
| [[EV-2-d2-004 · Databases (databases.rst)\|EV-2-d2-004]] | Databases (databases.rst) |
| [[EV-2-d2-005 · Database instances (tabs-database_instances.rst)\|EV-2-d2-005]] | Database instances (tabs-database_instances.rst) |
| [[EV-2-d2-006 · Domains (domains.rst)\|EV-2-d2-006]] | Domains (domains.rst) |
| [[EV-2-d2-007 · Domain records (domains_records.rst)\|EV-2-d2-007]] | Domain records (domains_records.rst) |
| [[EV-2-d2-008 · Phone lines (lines.rst)\|EV-2-d2-008]] | Phone lines (lines.rst) |

### Etapa E5 — Usuários e Administração (users, administration)

| ID | Resumo |
|---|---|
| [[EV-2-e1-001 · Ficha de Usuário — aba Users, impersonate e vcard\|EV-2-e1-001]] | Ficha de Usuário — aba Users, impersonate e vcard |
| [[EV-2-e1-002 · Importação e sincronização de usuários (LDAP e fontes externas)\|EV-2-e1-002]] | Importação e sincronização de usuários (LDAP e fontes externas) |
| [[EV-2-e1-003 · Gestão de Grupos (hierarquia, opções e importação LDAP)\|EV-2-e1-003]] | Gestão de Grupos (hierarquia, opções e importação LDAP) |
| [[EV-2-e1-004 · Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão\|EV-2-e1-004]] | Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão |
| [[EV-2-e1-005 · Aba Administration do perfil (direitos sobre usuários, entidades e regras)\|EV-2-e1-005]] | Aba Administration do perfil (direitos sobre usuários, entidades e regras) |
| [[EV-2-e1-006 · Aba Assistance do perfil (direitos de service desk, simplificada e padrão)\|EV-2-e1-006]] | Aba Assistance do perfil (direitos de service desk, simplificada e padrão) |
| [[EV-2-e1-007 · Aba Configuration do perfil (direitos de exibição de busca)\|EV-2-e1-007]] | Aba Configuration do perfil (direitos de exibição de busca) |
| [[EV-2-e1-008 · Aba Tools do perfil (FAQ, reservas, base de conhecimento, projetos)\|EV-2-e1-008]] | Aba Tools do perfil (FAQ, reservas, base de conhecimento, projetos) |
| [[EV-2-e1-009 · Aba Authorizations da ficha de usuário\|EV-2-e1-009]] | Aba Authorizations da ficha de usuário |
| [[EV-2-e1-010 · Aba Groups da ficha de usuário\|EV-2-e1-010]] | Aba Groups da ficha de usuário |
| [[EV-2-e2-001 · Módulo de Administração e submenus (index)\|EV-2-e2-001]] | Módulo de Administração e submenus (index) |
| [[EV-2-e2-002 · Entidades - conceito, hierarquia e isolamento (multi-tenancy)\|EV-2-e2-002]] | Entidades - conceito, hierarquia e isolamento (multi-tenancy) |
| [[EV-2-e2-003 · Abas da entidade - Endereço e Avançado (regras genéricas e LDAP)\|EV-2-e2-003]] | Abas da entidade - Endereço e Avançado (regras genéricas e LDAP) |
| [[EV-2-e2-004 · Entidade - Notificações e Alarmes (herança)\|EV-2-e2-004]] | Entidade - Notificações e Alarmes (herança) |
| [[EV-2-e2-005 · Entidade - aba Assistência (templates, fechamento, satisfação)\|EV-2-e2-005]] | Entidade - aba Assistência (templates, fechamento, satisfação) |
| [[EV-2-e2-006 · Entidade - abas Ativos, UI, Segurança, Helpdesk home, Usuários e Regras\|EV-2-e2-006]] | Entidade - abas Ativos, UI, Segurança, Helpdesk home, Usuários e Regras |
| [[EV-2-e2-007 · Motor de regras - usos e comportamentos\|EV-2-e2-007]] | Motor de regras - usos e comportamentos |
| [[EV-2-e2-008 · Tipos de regra na administração e mecanismos auxiliares\|EV-2-e2-008]] | Tipos de regra na administração e mecanismos auxiliares |
| [[EV-2-e2-009 · Criação de uma regra - critérios, operadores, regex e AND-OR\|EV-2-e2-009]] | Criação de uma regra - critérios, operadores, regex e AND-OR |
| [[EV-2-e2-010 · Regras de negócio de tickets\|EV-2-e2-010]] | Regras de negócio de tickets |
| [[EV-2-e2-011 · Regras de atribuição de autorizações ao usuário\|EV-2-e2-011]] | Regras de atribuição de autorizações ao usuário |
| [[EV-2-e2-012 · Regras de inventário - atribuição a entidade e importação-vínculo\|EV-2-e2-012]] | Regras de inventário - atribuição a entidade e importação-vínculo |
| [[EV-2-e2-013 · Dicionários de dados - conceito e funcionamento\|EV-2-e2-013]] | Dicionários de dados - conceito e funcionamento |
| [[EV-2-e2-014 · Dicionários globais e de drop-downs\|EV-2-e2-014]] | Dicionários globais e de drop-downs |
| [[EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta\|EV-2-e2-015]] | Formulários nativos - migração e tipos de pergunta |
| [[EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar\|EV-2-e2-016]] | Formulários - visibilidade, catálogo, controle de acesso e item a criar |
| [[EV-2-e2-017 · Logs\|EV-2-e2-017]] | Logs |
| [[EV-2-e2-018 · Fila de e-mails (mailing queue)\|EV-2-e2-018]] | Fila de e-mails (mailing queue) |

### Etapa E6 — Configuração / Setup (config)

| ID | Resumo |
|---|---|
| [[EV-2-f1-001 · Módulo de Configuração (Setup) e seus submenus\|EV-2-f1-001]] | Módulo de Configuração (Setup) e seus submenus |
| [[EV-2-f1-002 · Mecanismo de unicidade de campos\|EV-2-f1-002]] | Mecanismo de unicidade de campos |
| [[EV-2-f1-003 · Links externos, tags e templates Twig\|EV-2-f1-003]] | Links externos, tags e templates Twig |
| [[EV-2-f1-004 · Componentes de hardware configuráveis\|EV-2-f1-004]] | Componentes de hardware configuráveis |
| [[EV-2-f1-005 · Configuração Geral — abas e aparência\|EV-2-f1-005]] | Configuração Geral — abas e aparência |
| [[EV-2-f1-006 · Valores padrão de exibição e assistência\|EV-2-f1-006]] | Valores padrão de exibição e assistência |
| [[EV-2-f1-007 · Configuração global de ativos e inventário\|EV-2-f1-007]] | Configuração global de ativos e inventário |
| [[EV-2-f1-008 · Configuração de assistência\|EV-2-f1-008]] | Configuração de assistência |
| [[EV-2-f1-009 · Limite de upload de documentos\|EV-2-f1-009]] | Limite de upload de documentos |
| [[EV-2-f1-010 · Purga de logs (PurgeLogs)\|EV-2-f1-010]] | Purga de logs (PurgeLogs) |
| [[EV-2-f1-011 · Sistema — logging, CLI, proxy, manutenção, info\|EV-2-f1-011]] | Sistema — logging, CLI, proxy, manutenção, info |
| [[EV-2-f1-012 · Política de senhas (segurança e expiração)\|EV-2-f1-012]] | Política de senhas (segurança e expiração) |
| [[EV-2-f1-013 · Performances e sistemas de cache\|EV-2-f1-013]] | Performances e sistemas de cache |
| [[EV-2-f1-014 · Configuração da API REST\|EV-2-f1-014]] | Configuração da API REST |
| [[EV-2-f1-015 · Análise de impacto por tipo de item\|EV-2-f1-015]] | Análise de impacto por tipo de item |
| [[EV-2-f1-016 · Réplicas SQL\|EV-2-f1-016]] | Réplicas SQL |
| [[EV-2-f1-017 · GLPI Network (chave de registro)\|EV-2-f1-017]] | GLPI Network (chave de registro) |
| [[EV-2-f2-001 · Processo geral de autenticação e criação on-the-fly\|EV-2-f2-001]] | Processo geral de autenticação e criação on-the-fly |
| [[EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD\|EV-2-f2-002]] | Autenticação, sincronização e abas de configuração LDAP-AD |
| [[EV-2-f2-003 · Autenticação via servidor de e-mail IMAP-POP\|EV-2-f2-003]] | Autenticação via servidor de e-mail IMAP-POP |
| [[EV-2-f2-004 · Métodos externos adicionais CAS x509 e SSO delegado\|EV-2-f2-004]] | Métodos externos adicionais CAS x509 e SSO delegado |
| [[EV-2-f2-005 · Conceito e configuração de dropdowns\|EV-2-f2-005]] | Conceito e configuração de dropdowns |
| [[EV-2-f2-006 · Dropdowns comuns localizações status fabricantes blacklists\|EV-2-f2-006]] | Dropdowns comuns localizações status fabricantes blacklists |
| [[EV-2-f2-007 · Dropdowns de assistência categorias soluções projetos\|EV-2-f2-007]] | Dropdowns de assistência categorias soluções projetos |
| [[EV-2-f2-008 · Dropdowns de calendário e períodos de fechamento\|EV-2-f2-008]] | Dropdowns de calendário e períodos de fechamento |
| [[EV-2-f2-009 · Dropdowns de internet redes IP e nomes de rede\|EV-2-f2-009]] | Dropdowns de internet redes IP e nomes de rede |
| [[EV-2-f2-010 · Outros dropdowns tipos modelos documentos SO unicidade login\|EV-2-f2-010]] | Outros dropdowns tipos modelos documentos SO unicidade login |
| [[EV-2-f2-011 · Definições de ativos customizados e criação\|EV-2-f2-011]] | Definições de ativos customizados e criação |
| [[EV-2-f2-012 · Capacidades disponíveis para ativos customizados\|EV-2-f2-012]] | Capacidades disponíveis para ativos customizados |
| [[EV-2-f2-013 · Campos perfis e traduções de ativos customizados\|EV-2-f2-013]] | Campos perfis e traduções de ativos customizados |
| [[EV-2-f3-001 · Visão geral e funcionamento das notificações\|EV-2-f3-001]] | Visão geral e funcionamento das notificações |
| [[EV-2-f3-002 · Definição de notificação e destinatários\|EV-2-f3-002]] | Definição de notificação e destinatários |
| [[EV-2-f3-003 · Opções de alarme por entidade\|EV-2-f3-003]] | Opções de alarme por entidade |
| [[EV-2-f3-004 · Configuração de e-mail (follow-ups) global e por entidade\|EV-2-f3-004]] | Configuração de e-mail (follow-ups) global e por entidade |
| [[EV-2-f3-005 · Templates de notificação (objeto, tabs, tags)\|EV-2-f3-005]] | Templates de notificação (objeto, tabs, tags) |
| [[EV-2-f3-006 · Exemplo de criação de template de ticket\|EV-2-f3-006]] | Exemplo de criação de template de ticket |
| [[EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo\|EV-2-f3-007]] | Ações automáticas (crontasks) — config e catálogo |
| [[EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento\|EV-2-f3-008]] | Receivers (coletores de e-mail), blacklists e regras de roteamento |
| [[EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento\|EV-2-f3-009]] | Níveis de serviço (SLA-OLA) e escalonamento |
| [[EV-2-f3-010 · Instalação, atualização e remoção de plugins\|EV-2-f3-010]] | Instalação, atualização e remoção de plugins |
| [[EV-2-f3-011 · Páginas de Locks não redigidas (stubs)\|EV-2-f3-011]] | Páginas de Locks não redigidas (stubs) |

### Etapa E7 — Config. avançada, abas compartilhadas, ferramentas e campos (advanced, tabs, tools, assets/fields)

| ID | Resumo |
|---|---|
| [[EV-2-g1-001 · Sistema de cache do GLPI (cache.rst)\|EV-2-g1-001]] | Sistema de cache do GLPI (cache.rst) |
| [[EV-2-g1-002 · Paletas customizadas (custom_palettes.rst)\|EV-2-g1-002]] | Paletas customizadas (custom_palettes.rst) |
| [[EV-2-g1-003 · Override de traduções via gettext (override-locales.rst)\|EV-2-g1-003]] | Override de traduções via gettext (override-locales.rst) |
| [[EV-2-g1-004 · Monitoramento de status e health check (status.rst)\|EV-2-g1-004]] | Monitoramento de status e health check (status.rst) |
| [[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)\|EV-2-g1-005]] | Referência da linha de comando bin-console (cli.rst) |
| [[EV-2-g1-006 · Índices de Configuração Avançada e Módulos (index.rst)\|EV-2-g1-006]] | Índices de Configuração Avançada e Módulos (index.rst) |
| [[EV-2-g2-001 · Aba All (todas as informações numa página)\|EV-2-g2-001]] | Aba All (todas as informações numa página) |
| [[EV-2-g2-002 · Aba Changes (mudanças vinculadas ao objeto)\|EV-2-g2-002]] | Aba Changes (mudanças vinculadas ao objeto) |
| [[EV-2-g2-003 · Aba Contacts (contatos associados)\|EV-2-g2-003]] | Aba Contacts (contatos associados) |
| [[EV-2-g2-004 · Aba Contracts (contratos associados)\|EV-2-g2-004]] | Aba Contracts (contratos associados) |
| [[EV-2-g2-005 · Aba Debug (informações de depuração)\|EV-2-g2-005]] | Aba Debug (informações de depuração) |
| [[EV-2-g2-006 · Aba Documents (documentos anexados ao item)\|EV-2-g2-006]] | Aba Documents (documentos anexados ao item) |
| [[EV-2-g2-007 · Aba External links (links externos do item)\|EV-2-g2-007]] | Aba External links (links externos do item) |
| [[EV-2-g2-008 · Aba History (histórico de alterações do item)\|EV-2-g2-008]] | Aba History (histórico de alterações do item) |
| [[EV-2-g2-009 · Aba Items (itens vinculados ao objeto)\|EV-2-g2-009]] | Aba Items (itens vinculados ao objeto) |
| [[EV-2-g2-010 · Aba Management (informações financeiras e administrativas)\|EV-2-g2-010]] | Aba Management (informações financeiras e administrativas) |
| [[EV-2-g2-011 · Aba Notes (notas em texto livre no item)\|EV-2-g2-011]] | Aba Notes (notas em texto livre no item) |
| [[EV-2-g2-012 · Aba Problems (problemas vinculados ao objeto)\|EV-2-g2-012]] | Aba Problems (problemas vinculados ao objeto) |
| [[EV-2-g2-013 · Aba Suppliers (fornecedores vinculados)\|EV-2-g2-013]] | Aba Suppliers (fornecedores vinculados) |
| [[EV-2-g2-014 · Aba Templates (gerar objeto por modelo)\|EV-2-g2-014]] | Aba Templates (gerar objeto por modelo) |
| [[EV-2-g2-015 · Aba Tickets (tickets vinculados ao objeto)\|EV-2-g2-015]] | Aba Tickets (tickets vinculados ao objeto) |
| [[EV-2-g2-016 · Configurações do usuário (índice de preferências)\|EV-2-g2-016]] | Configurações do usuário (índice de preferências) |
| [[EV-2-g2-017 · Substitutos autorizados (delegação de validação)\|EV-2-g2-017]] | Substitutos autorizados (delegação de validação) |
| [[EV-2-g3-001 · Módulo Tools (visão geral)\|EV-2-g3-001]] | Módulo Tools (visão geral) |
| [[EV-2-g3-002 · Base de conhecimento — telas, alvos e busca\|EV-2-g3-002]] | Base de conhecimento — telas, alvos e busca |
| [[EV-2-g3-003 · Gestão de projetos (Project e Project task)\|EV-2-g3-003]] | Gestão de projetos (Project e Project task) |
| [[EV-2-g3-004 · Lembretes pessoais e públicos\|EV-2-g3-004]] | Lembretes pessoais e públicos |
| [[EV-2-g3-005 · Geração de relatórios\|EV-2-g3-005]] | Geração de relatórios |
| [[EV-2-g3-006 · Reservas de equipamentos\|EV-2-g3-006]] | Reservas de equipamentos |
| [[EV-2-g3-007 · Feeds RSS\|EV-2-g3-007]] | Feeds RSS |
| [[EV-2-g3-008 · Aba Aprovações (validação de chamados e mudanças)\|EV-2-g3-008]] | Aba Aprovações (validação de chamados e mudanças) |
| [[EV-2-g3-009 · Aba Cartuchos (ciclo de vida na impressora)\|EV-2-g3-009]] | Aba Cartuchos (ciclo de vida na impressora) |
| [[EV-2-g3-010 · Aba Componentes por família (campos)\|EV-2-g3-010]] | Aba Componentes por família (campos) |
| [[EV-2-g3-011 · Aba Conexões diretas\|EV-2-g3-011]] | Aba Conexões diretas |
| [[EV-2-g3-012 · Tipo de consumível (consumable type)\|EV-2-g3-012]] | Tipo de consumível (consumable type) |
| [[EV-2-g3-013 · Aba Consumíveis (ciclo de vida)\|EV-2-g3-013]] | Aba Consumíveis (ciclo de vida) |
| [[EV-2-g3-014 · Aba Custos (Cost)\|EV-2-g3-014]] | Aba Custos (Cost) |
| [[EV-2-g3-015 · Análise de Impacto (procedimento e conceitos)\|EV-2-g3-015]] | Análise de Impacto (procedimento e conceitos) |
| [[EV-2-g3-016 · Aba Itens (vincular ativos a um objeto)\|EV-2-g3-016]] | Aba Itens (vincular ativos a um objeto) |
| [[EV-2-g3-017 · Aba Base de Conhecimento (vincular artigos)\|EV-2-g3-017]] | Aba Base de Conhecimento (vincular artigos) |
| [[EV-2-g3-018 · Aba Portas de rede (tipos, VLAN, métricas, locks)\|EV-2-g3-018]] | Aba Portas de rede (tipos, VLAN, métricas, locks) |
| [[EV-2-g3-019 · Aba Sistemas operacionais (campos e CLI)\|EV-2-g3-019]] | Aba Sistemas operacionais (campos e CLI) |
| [[EV-2-g3-020 · Modelos de impressora (compartilhar cartuchos)\|EV-2-g3-020]] | Modelos de impressora (compartilhar cartuchos) |
| [[EV-2-g3-021 · Aba Projetos (vincular projeto a um objeto)\|EV-2-g3-021]] | Aba Projetos (vincular projeto a um objeto) |
| [[EV-2-g3-022 · Aba Gestão Remota (Remote Management)\|EV-2-g3-022]] | Aba Gestão Remota (Remote Management) |
| [[EV-2-g3-023 · Aba Sockets (tomadas físicas de cabeamento)\|EV-2-g3-023]] | Aba Sockets (tomadas físicas de cabeamento) |
| [[EV-2-g3-024 · Aba Softwares (instalar e remover)\|EV-2-g3-024]] | Aba Softwares (instalar e remover) |
| [[EV-2-g3-025 · Aba Volumes (partições)\|EV-2-g3-025]] | Aba Volumes (partições) |
| [[EV-2-g3-026 · Abas-stub (contratos e links, por redigir)\|EV-2-g3-026]] | Abas-stub (contratos e links, por redigir) |
| [[EV-2-g4-001 · Campos de identificação de inventário (série, UUID, nº inventário, fonte)\|EV-2-g4-001]] | Campos de identificação de inventário (série, UUID, nº inventário, fonte) |
| [[EV-2-g4-002 · Campos de modelo, fabricante e tipo de ativo\|EV-2-g4-002]] | Campos de modelo, fabricante e tipo de ativo |
| [[EV-2-g4-003 · Campos de rede e usuário alternativo do inventário\|EV-2-g4-003]] | Campos de rede e usuário alternativo do inventário |
| [[EV-2-g4-004 · Campos de atores (usuário, grupo, grupo e técnico responsáveis)\|EV-2-g4-004]] | Campos de atores (usuário, grupo, grupo e técnico responsáveis) |
| [[EV-2-g4-005 · Campos de localização e posição em datacenter\|EV-2-g4-005]] | Campos de localização e posição em datacenter |
| [[EV-2-g4-006 · Campos descritivos (comentários, cor, imagens, referência)\|EV-2-g4-006]] | Campos descritivos (comentários, cor, imagens, referência) |
| [[EV-2-g4-007 · Campo Status de itens\|EV-2-g4-007]] | Campo Status de itens |
| [[EV-2-g4-008 · Campo Tipo de gestão (unitária vs global)\|EV-2-g4-008]] | Campo Tipo de gestão (unitária vs global) |
| [[EV-2-g4-009 · Campos de estoque e consumíveis (limite de alerta, estoque-alvo, tipo de cartucho)\|EV-2-g4-009]] | Campos de estoque e consumíveis (limite de alerta, estoque-alvo, tipo de cartucho) |
| [[EV-2-g4-010 · Credenciais SNMP e sysDescr\|EV-2-g4-010]] | Credenciais SNMP e sysDescr |
| [[EV-2-g4-011 · Campo Portas sem redação na documentação\|EV-2-g4-011]] | Campo Portas sem redação na documentação |

**Total SRC-002: 212 evidências (EV-2) em 7 etapas / 17 subagentes (a1…g4), cobrindo 227 arquivos `.rst` (100%).**

> [!info] Total do vault
> **251 notas de evidência** — 39 sobre SRC-001 (código GLPI 11.0.7) + 212 sobre SRC-002 (documentação do usuário GLPI 11.0).
