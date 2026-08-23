---
title: Obsidian Help 05
aliases:
  - Obsidian Help — Interface, Workspace e Ergonomia
tags:
  - obsidian
  - pkm
  - literature
  - ui
  - note-taking
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 05 — Interface, Workspace e Ergonomia

*Workspace · Sidebar · Tabs · Ribbon · Status bar · Settings · Hotkeys · Appearance · Language settings · Pop-out windows · Drag and drop · Workspaces · Command palette · Slash commands · File explorer · Quick switcher*

## Resumo executivo

A interface aparece na doc como **infraestrutura de fluxo de trabalho**, não como preferência estética: painéis com regras de split assimétricas, três superfícies ortogonais de comando, e uma página de settings que decide onde o material capturado aterrissa e o que o grafo enxerga.

## Principais ideias

### O workspace é um container com split assimétrico

No desktop: ribbon vertical à esquerda, sidebars colapsáveis, tab groups na área central, status bar no canto inferior direito. A assimetria é declarada — sidebar tab groups só dividem **verticalmente**, os da área central dividem *vertically or horizontally* (`Split right`, `Split down`). No mobile a topologia muda de natureza: tabs viram contador na Navigation bar, sidebars viram swipe, o ribbon vira menu. `Stack notes` desliza tabs de um mesmo grupo umas sobre as outras, ideia atribuída às *sliding notes* de Andy Matuschak.

### Linked views acompanham; pinned panes congelam

*Linked views* são tabs que referenciam outra tab e mudam junto com ela; só três plugins servem — [[Graph View]] local, [[Backlink|Backlinks]] e Outline, em **More options → Open linked view**. Pinar faz o oposto: na sidebar, nota ou base pinada fica no lugar e novas notas abrem em tabs separadas, enquanto um *pane* pinado *"stays focused on the last selected note"*. No editor principal, links de uma tab pinada sempre abrem em outra tab. Acompanhar e fixar são decisões opostas sobre a mesma superfície — é essa diferença que torna viável processar uma nota com contexto lateral.

### Três superfícies de comando ortogonais

Command palette (`Ctrl/Cmd+P`) é a exploratória: fuzzy matching resolve `scf` para **S**ave **c**urrent **f**ile, desde a versão 1.8.3 comandos recentes sobem ao topo, e há pinned commands em **Settings → Command palette**. Slash commands é a inline: `/` no início da linha ou após qualquer espaço em branco, mesmo fuzzy matching, saída por `Esc` ou pela tecla `Space`. Hotkeys é a muscular: múltiplas combinações por comando, filtro para listar só o que já tem atalho, exibição sempre no layout US. A doc marca a fronteira — hotkeys não são os system keyboard shortcuts do SO, que ali não são customizáveis.

### `Files and links` é infraestrutura de captura, não cosmético

`Default location for new notes` e `for new attachments` decidem onde o material cru aterrissa, com a exceção precisa de que a preferência **não se aplica** quando o link já traz caminho: `[[Projects/Three laws of motion]]` cria a nota em `Projects`. `New link format` escolhe entre *shortest path when possible*, *relative path to file* e *absolute path in vault*; `Automatically update internal links` decide se renomear reescreve o [[Internal Link (Wikilink)]] ou apenas pergunta. E `Excluded files` define o que o sistema deixa de ver: escondidos em Search, [[Graph View]] e Unlinked Mentions, apenas *deprioritized* no Quick switcher.

### Workspaces materializam modos de trabalho

O core plugin salva *"information about open files and tabs, and the width and visibility of each sidebar"* sob um nome; atualizar é salvar com o mesmo nome, carregar é **Manage workspace layouts**. Capturar, processar e revisar ficam a um comando de distância, em vez de exigirem reconstrução manual de painéis. O ribbon customizado persiste entre sessões e viaja entre dispositivos quando `workspace.json` e `workspace-mobile.json` sincronizam.

### Drag and drop é a ponte com o mundo externo

De fora para dentro há duas conversões distintas: HTML do navegador é convertido automaticamente em Markdown, e arquivos do explorador nativo são **copiados** para a attachment folder e inseridos como internal links — com `Ctrl` (Windows/Linux) ou `Option` (macOS) gerando links `file:///` absolutos sem importar cópia alguma. Internamente, arrastar da Search, dos backlinks ou do file explorer para o editor insere um link no formato configurado; arrastar para fora produz uma URL [[Obsidian URI|`obsidian://`]].

## Conceitos apresentados

- [[Workspace Layout]] — painéis, tab groups e o layout salvo
- [[Live Preview]] — o `Default editing mode` de **Settings → Editor**
- [[Theme (Obsidian)]] — Appearance, accent color, fontes, window frame style
- [[Internal Link (Wikilink)]] — o formato decidido em `New link format`
- [[Attachment]] — onde o material importado aterrissa

## Exemplos

> [!quote] Tabs — a definição de linked view
> *"Linked views are tabs that reference a different tab. When the content of the referenced tab changes, the linked view changes as well."*

> [!quote] Hotkeys — a fronteira com o sistema operacional
> *"Hotkeys are different from system keyboard shortcuts (like `Ctrl+C` for copy), which are provided by your operating system and cannot be customized in Obsidian."*

---
Ref: [[Obsidian Help]], [[Workspace Layout]], [[Internal Link (Wikilink)]], [[Attachment]], [[Busca Avançada no Obsidian]]
