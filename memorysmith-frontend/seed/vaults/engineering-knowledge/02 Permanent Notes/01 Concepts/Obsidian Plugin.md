---
title: Obsidian Plugin
aliases:
  - Core Plugin
  - Community Plugin
  - Plugin do Obsidian
tags:
  - obsidian
  - plugin
  - security
  - local-first
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Plugin** é o que estende o Obsidian com funcionalidades adicionais — os **core plugins**, escritos pela equipe do Obsidian e embutidos no aplicativo, e os **community plugins**, escritos por terceiros e instalados por [[Vault]].

## Conceito

Quase tudo que parece "o Obsidian" é na verdade um core plugin: [[Graph View]], [[Backlink]], [[Search Syntax (Obsidian)|Search]], [[Canvas]], [[Base (Obsidian Bases)|Bases]], [[Daily Note|Daily notes]]. Isso significa que a superfície do produto é composta de partes desligáveis — ativáveis em **Settings → Core plugins**, algumas **desligadas por padrão**.

Community plugins são a mesma coisa em outro regime de confiança: código de terceiros rodando na sua máquina, instalado sob **Settings → Community plugins → Browse**, guardado por vault na pasta `plugins` da [[Configuration Folder]]. Por isso o [[Restricted Mode]] é o estado default do app.

## Core plugins relevantes

| Plugin | O que faz |
|---|---|
| Backlinks | Todos os links e unlinked mentions de uma nota |
| Outgoing links | Links da nota ativa e links potenciais |
| Graph view | Visualiza as relações entre notas |
| Search | Encontra arquivos no vault |
| Quick switcher | Busca, cria e abre notas pelo teclado |
| Command palette | Acessa comandos pelo teclado |
| Canvas | Espaço infinito para dispor ideias |
| Bases | Views customizadas que editam, ordenam e filtram por properties |
| Daily notes | Cria e abre notas pela data corrente |
| Templates | Insere conteúdo pré-definido |
| Unique note creator | Nota com título time-coded |
| Note composer | Une duas notas ou divide uma em duas |
| File recovery | Recupera trabalho a partir de snapshots |
| Format converter | Converte Markdown de outros apps para o formato do Obsidian |
| Workspaces | Salva layouts e alterna entre eles |
| Properties view · Tags view · Outline · Footnotes view | Listas derivadas do vault e da nota ativa |
| Sync · Publish | Serviços pagos, embutidos como plugin |

A equipe também mantém plugins na loja da comunidade, como o **Importer** e o **Maps** (que adiciona a Map view às Bases).

## Modelo de risco

> [!warning]
> Community plugins herdam os **níveis de acesso do próprio Obsidian**: podem acessar arquivos do computador, conectar-se à internet e instalar programas adicionais. Não existe permissão granular.

> [!quote]
> Due to technical limitations, Obsidian cannot reliably restrict plugins to specific permissions or access levels.

Por segurança, **community plugins não atualizam automaticamente** — a atualização é manual, em **Check for updates → Update all** ou por plugin. Plugins instalados permanecem no vault mesmo com o Restricted mode ligado, mas são ignorados.

Todo plugin deve aderir às Obsidian Developer Policies, e o Obsidian escaneia automaticamente cada versão em busca de vulnerabilidades, problemas de qualidade de código e malware. O resultado aparece no **Scorecard** da página do plugin no diretório da comunidade:

- **Health**, em quatro eixos: *hygiene* (README, licença, guia de contribuição, descrição), *maintenance* (commits e releases recentes), *responsiveness* (issues fechadas e contribuidores ativos) e *adoption* (instalações e stars).
- **Review**, o último scan automatizado, em três blocos: *passed checks* (sem dependências vulneráveis conhecidas, sem código ofuscado, atestação de artefato do GitHub verificada, quais APIs do Obsidian usa — Vault Read, Vault Write), *disclosures* (o que o plugin faz que convém saber: acesso ao clipboard, requisições a domínios externos) e *other notes*.
- Semáforo: 🟢 poucas ou nenhuma disclosure, risco baixo · 🟡 algumas, vale checar clipboard e rede · 🔴 várias disclosures ou warnings, revise com cuidado antes de instalar.

Revisão **manual** continua apenas para plugins populares, featured e sinalizados. Itens fora do diretório não passam por esse processo. Para dado sensível, a recomendação da doc é auditoria de segurança independente antes do uso. Ver [[Threat Modeling]].

## Comparação

| | Core plugin | Community plugin |
|---|---|---|
| Autoria | Equipe do Obsidian | Terceiros, em TypeScript sobre a Obsidian API |
| Distribuição | Embutido no app | Instalado do diretório, por vault |
| Onde vive | No aplicativo | `.obsidian/plugins` |
| Ativação | Settings → Core plugins | Exige desligar o Restricted mode |
| Atualização | Junto com o app | **Manual, por segurança** |
| Revisão | Interna | Scan automático + revisão manual seletiva |

## Veja também

- [[Restricted Mode]]
- [[Configuration Folder]]
- [[Threat Modeling]]
- [[Theme (Obsidian)]]
- [[CSS Snippet]]
- [[Vault]]
