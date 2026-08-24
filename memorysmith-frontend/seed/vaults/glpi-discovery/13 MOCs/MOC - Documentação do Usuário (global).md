---
title: MOC - Documentação do Usuário (global)
aliases: [MOC Documentação, MOC SRC-002, índice da documentação do usuário]
tags: [moc, documentacao, global, fonte/src-002]
type: moc
maturity: evergreen
reviewed: false
author: CAD Discovery
created: 2026-07-12
---

# MOC - Documentação do Usuário (global)

Índice mestre do conhecimento extraído da **documentação oficial do usuário do GLPI 11.0**
(fonte `SRC-002` · `codebase/in/doc`, 227 arquivos `.rst`). Este mapa dá a **visão do
usuário/consultor funcional** — como o GLPI se apresenta e se opera pela interface — e é
complementar ao [[MOC - Arquitetura (global)]], que dá a **visão do código** (`SRC-001`).

> [!tip] Duas lentes sobre o mesmo sistema
> `SRC-001` (código) responde *"como foi implementado"*; `SRC-002` (doc) responde *"como se
> usa e configura"*. Onde a doc **responde** a uma investigação aberta do código, o
> cruzamento está em [[Resoluções de investigações do código pela documentação (sessão 2)]].

## Por onde começar
- [[Documentação do Usuário GLPI (escopo e estrutura)]] — o que a doc cobre.
- [[Visão Geral do GLPI]] — o que é o sistema.
- [[Áreas da Interface do GLPI]] · [[Módulos de Navegação do GLPI]] — a interface em blocos.
- [[Glossário oficial (doc)]] — vocabulário oficial do produto.

## E1 — Uso geral, interface e navegação
- [[Interface padrão vs simplificada]] · [[Interface Padrão (Standard)]] · [[Interface Simplificada (Helpdesk-Self-Service)]]
- [[Motor de Busca (Search Engine)]] · [[Busca na Interface (uso do motor de busca)]] · [[Buscas Salvas (Bookmarks)]]
- [[Ações em massa (massive actions)]] · [[Quadro Kanban]] · [[Templates de itens (modelos)]]
- [[Campos das Preferências do Usuário]] · [[Gestão de Senha do Usuário]] · [[Configuração de MFA e 2FA]]

## E2 — Assistência / Service Desk
- [[Módulo de Assistência (Service Desk)]] · [[Interfaces de abertura de chamado]]
- [[Ciclo de vida do ticket (visão do usuário)]] · [[Matriz de ciclo de vida (transições de status por perfil)]]
- [[Matriz de prioridade (configuração urgência × impacto)]] · [[Atores e papéis de um chamado (visão do usuário)]]
- [[Gestão de Mudanças na interface (procedimento)]] · [[Gestão de Problemas na interface (procedimento)]]
- [[Planejamento e Agenda (visões de planning)]] · [[Estatísticas do Service Desk (relatórios)]]

## E3 — Ativos e Inventário
- [[Módulo de Ativos (Assets)]] · [[Abas comuns de um ativo (visão do usuário)]] · [[Campos comuns de um ativo (formulário)]]
- [[Equipamento de Rede (ativo)]] · [[Rack (ativo DCIM)]] · [[Enclosure (chassis modular)]] · [[PDU (Power Distribution Unit)]] · [[Cabo (ativo)]]
- [[Software (ativo, versões e licenças)]] · [[Cartucho (ativo)]] · [[Consumível (ativo)]]
- [[Ativos não gerenciados (unmanaged assets)]] · [[Gestão unitária vs global de ativos (visão do doc)]]
- Abas de hardware: [[Aba Componentes de Hardware (ativos)]] · [[Aba Portas de Rede (ativos)]] · [[Aba Virtualização (ativos)]] · [[Aba Bloqueios (locks de inventário)]]

## E4 — Gestão (Management)
- [[Módulo Management (Gestão) — visão geral]]
- [[Contrato na interface (Contract) — visão do usuário]] · [[Fornecedor na interface (Supplier) — visão do usuário]] · [[Contato na interface (Contact) — visão do usuário]]
- [[Orçamento na interface (Budget) — visão do usuário]] · [[Documento na interface (Document) — visão do usuário]] · [[Licença na interface (License) — visão do usuário]] · [[Certificado na interface (Certificate) — visão do usuário]]
- [[Appliance (aplicação de negócio)]] · [[Cluster (agrupamento de ativos)]] · [[Data center (agrupamento de salas de servidores)]] · [[Instância de banco de dados (database instance)]] · [[Domínio (Internet domain)]] · [[Linha telefônica (phone line)]]
- [[Alertas de renovação e vencimento (contratos, licenças, certificados)]]

## E5 — Usuários e Administração
- [[Módulo de Administração (visão geral)]] · [[Modelo de Entidades na administração (multi-tenancy)]] · [[Recursividade em entidades]]
- [[Ficha de Usuário (abas e visão geral)]] · [[Gestão de Grupos (conceito e opções)]] · [[Perfil de Usuário (conceito e composição)]] · [[Perfis pré-definidos do GLPI]] · [[Permissões padrão de objetos]]
- [[Importação e sincronização de usuários (fluxo)]] · [[Importação de grupos LDAP (fluxo)]] · [[Personificação de usuário (Impersonate)]]
- [[Motor de Regras na Administração (gestão de regras)]] · [[Criação de uma regra (passo a passo)]] · [[Regras de atribuição de autorizações ao usuário]] · [[Regras de negócio de tickets (administração)]]
- [[Dicionários de dados (administração)]] · [[Formulários (módulo nativo)]] · [[Fila de e-mails (mailqueue)]] · [[Logs do sistema (administração)]]

## E6 — Configuração / Setup
- [[Módulo de Configuração (Setup)]] · [[Configuração Geral do GLPI (Setup - General)]] · [[Valores Padrão de Exibição (default values)]]
- [[Unicidade de Campos (fields unicity)]] · [[Links Externos (external links)]] · [[Componentes de Hardware Configuráveis]]
- Autenticação: [[Processo de autenticação e login (visão do administrador)]] · [[Diretório LDAP e Active Directory (configuração)]] · [[Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)]] · [[Autenticação por servidor de e-mail (IMAP-POP)]]
- Dropdowns: [[Catálogo de tipos de dropdown (configuração)]] · [[Dropdowns gerais (localizações, status, fabricantes, blacklists)]] · [[Dropdowns de assistência (categorias, soluções, projetos)]] · [[Dropdowns de Internet e rede (IP, nomes de rede, domínios)]] · [[Dropdowns de calendário e períodos de fechamento]]
- Ativos customizados: [[Definição de Ativo Customizado (Asset Definition) — doc]] · [[Capacidades de ativo customizado (catálogo)]] · [[Criação de um ativo customizado (procedimento)]]
- Notificações: [[Notificações no GLPI (visão de configuração)]] · [[Definição de notificação (estrutura)]] · [[Template de notificação (objeto global)]] · [[Criação de um template de notificação (passo a passo)]]
- Serviço e coleta: [[Níveis de serviço (SLA e OLA) na configuração]] · [[Escalonamento de SLA-OLA (níveis e ações)]] · [[Receiver (coletor de e-mail) — visão de configuração]] · [[Roteamento de tickets de e-mail (regras do coletor)]]
- [[Instalação e atualização de plugins (marketplace)]]

## E7 — Config. avançada, abas compartilhadas, ferramentas e campos
- Operação avançada: [[Interface de Linha de Comando (bin-console)]] · [[Sistema de Cache do GLPI (operacional)]] · [[Monitoramento de Status e Health Check]] · [[OPCache e otimização de PHP]] · [[Override de Locales e Traduções (gettext)]] · [[Paletas Customizadas (temas SCSS)]]
- Comandos CLI: [[Comandos de CLI - Banco de Dados]] · [[Comandos de CLI - Cache e Configuração]] · [[Comandos de CLI - Manutenção e Diagnóstico de Sistema]] · [[Comandos de CLI - Migração de Dados]] · [[Comandos de CLI - Plugins e Marketplace]] · [[Comandos de CLI - Regras, Ativos e Ferramentas]]
- Abas genéricas compartilhadas: [[Abas genéricas dos formulários GLPI]] · [[Aba Todas as informações (All)]] · [[Aba Histórico (History) de alterações]] · [[Aba Documentos (Documents) anexados]] · [[Aba Custos (Cost)]] · [[Aba Gestão (Management) financeira e administrativa]]
- Módulo Tools: [[Módulo Tools (Ferramentas)]] · [[Base de Conhecimento na interface (abas e navegação)]] · [[Gestão de Projetos na interface (Project e Project task)]] · [[Lembretes pessoais e públicos (Reminder)]] · [[Reservar um equipamento (fluxo)]] · [[Feeds RSS na página inicial (RSSFeed)]] · [[Uso da Análise de Impacto (montar o diagrama de dependências)]]
- Campos comuns do ativo: [[Campos comuns do GLPI (índice)]] · [[Identificadores de um ativo (número de série e número de inventário)]] · [[Credenciais SNMP]] · [[Status de itens (campo comum)]] · [[Tipo de gestão (unitária vs global)]]

## Rastreabilidade
- [[Registro de Evidências]] — todas as evidências EV-2 (SRC-002) por etapa.
- [[Resoluções de investigações do código pela documentação (sessão 2)]] — onde a doc responde ao código.

## Lacunas abertas (SRC-002)
A documentação oficial tem **stubs** (páginas não redigidas) e omissões; cada uma virou uma
investigação `INV-2-*`. As principais: [[INV-2-c2-001 · Documentação de Bancos de Dados incompleta (stub)]],
[[INV-2-f3-001 · Documentação de Locks (bloqueio de objetos) ausente]],
[[INV-2-f2-001 · Include de tabs-translation.rst ausente nos dropdowns]],
[[INV-2-g4-001 · Campo Portas de ativo não documentado (ports.rst pendente)]],
[[INV-2-e2-001 · Correspondência entre tipos de regra do doc e o catálogo do código]].
Lista completa no rodapé do [[README]].
