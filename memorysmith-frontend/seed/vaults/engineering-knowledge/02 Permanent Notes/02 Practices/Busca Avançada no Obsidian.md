---
title: Busca Avançada no Obsidian
aliases:
  - Advanced Search
  - Busca Avançada
  - Operadores de Busca
tags:
  - obsidian
  - search
  - pkm
  - note-taking
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
A busca do Obsidian é uma linguagem de consulta, não uma caixa de texto: operadores de escopo, de proximidade estrutural e de metadados se combinam com booleanos, parênteses, negação e regex. Escrever a consulta em camadas — primeiro onde, depois o quê, depois quão perto — transforma "procurar uma nota" em "definir um conjunto", e esse conjunto pode virar bookmark, group do graph view ou bloco embutido numa nota.

## Dinâmica / Passo a Passo

1. **Abra a busca** (`Ctrl+Shift+F` no Windows/Linux, `Command+Shift+F` no macOS). Selecionar um texto no editor e chamar o atalho já busca a seleção; abrir com o campo vazio lista os termos recentes.
2. **Delimite o escopo estrutural** com `path:` e `file:` — os únicos operadores que alcançam qualquer arquivo do vault, não só notas e canvases: `path:"Daily notes/2022-07"`, `file:202209`, `file:.jpg`.
3. **Escreva o conteúdo.** Cada palavra é casada de forma independente dentro do arquivo; frase exata vai entre aspas (`"star wars"`), com `\"` para aspas dentro de aspas; `content:"happy cat"` restringe ao corpo.
4. **Aperte a proximidade estrutural**, do mais barato para o mais caro: `line:(mix flour)` exige as palavras na mesma linha, `section:(dog cat)` no mesmo trecho entre dois headings, `block:(dog cat)` no mesmo bloco.
5. **Filtre por metadados.** `tag:#work` para tags; `[aliases]` para notas que têm a property; `[aliases:Name]` para valor exato; `[status:Draft OR Published]` para sub-query dentro do valor; `[aliases:null]` para property existente e vazia; `[duration:<5]` e `[duration:>5]` para comparação.
6. **Recorte tarefas** com `task:call`, `task-todo:call` e `task-done:call`, todos avaliados bloco a bloco.
7. **Negue e agrupe.** `meeting -work` exclui; `meeting -work -meetup` exclui duas; `meeting -(work meetup)` exclui apenas quem tem *as duas*; `meeting (work OR meetup) personal` controla a precedência.
8. **Use regex entre barras** quando o padrão for lexical: `/\d{4}-\d{2}-\d{2}/`, combinável com operador — `path:/\d{4}-\d{2}-\d{2}/`.
9. **Ajuste maiúsculas** pelo ícone **Match case** na barra, ou pelos operadores `match-case:HappyCat` e `ignore-case:ikea`.
10. **Depure com Explain search term**, que quebra a consulta e explica em texto simples — o caminho mais rápido quando um parêntese mudou o sentido sem avisar.
11. **Ordene e extraia.** O dropdown abaixo do campo oferece nome (A-Z / Z-A), modificação e criação, nas duas direções; nos três pontinhos ao lado da contagem estão **Copy search results** e **Bookmark**.
12. **Persista a consulta.** Como bookmark (busca virando item fixo na sidebar), como group do graph view, ou embutida na nota com um code block ` ```query `.

## Regras

- **Comparadores `<` e `>` precisam de colchetes ou aspas.** Fora de `[]` ou `""` eles não filtram.
- **`block:` é o operador caro.** Ele obriga a busca a parsear o Markdown de todos os arquivos e demora mais; prefira `line:` ou `section:` quando a precisão de bloco não for necessária.
- **`tag:` não desce na hierarquia:** `tag:#work` não retorna `#myjob/work`. Em compensação, ignora ocorrências em code blocks e em conteúdo não-Markdown, o que o torna mais rápido e mais preciso que buscar `#work` como texto.
- **`null` significa vazio, não falso.** `[aliases:null]` funciona com `aliases:` sem valor, mas **não** com `""` nem com `[]`.
- **Regex é JavaScript-flavored.** Padrões escritos para outro dialeto podem não casar.
- **Excluded files não retornam.** Arquivos que casam com os padrões de **Settings → Excluded files** ficam fora dos resultados — silenciosamente.
- **A busca lê notas e canvases.** Para path e filename de qualquer outro arquivo, é preciso `path:` ou `file:`.
- **Publish não suporta resultados de busca embutidos.** O bloco ` ```query ` só renderiza dentro do app.

## Exemplo

Encontrar as notas permanentes de prática ainda sem alias definido, fora da pasta de literatura, que mencionem sync na mesma seção em que mencionem backup:

```
path:"02 Permanent Notes" [type:practice] [aliases:null] section:(sync backup) -path:"01 Literature"
```

Rodando **Explain search term** antes de salvar, confirma-se que `-path:` está negando a pasta inteira e não apenas a palavra. O resultado vira bookmark pelos três pontinhos e, embutido numa nota de manutenção, vira um painel vivo:

````markdown
```query
path:"02 Permanent Notes" [type:practice] [aliases:null]
```
````

---
Ref: [[Search Syntax (Obsidian)]], [[Properties (Frontmatter)]], [[Tag (Obsidian)]], [[Escrever Frontmatter Consultável]], [[Diagnóstico do Grafo de Conhecimento]], [[Modelar uma Base sobre o Frontmatter]]
