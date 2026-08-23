---
title: Ligar Notas em Três Granularidades
aliases:
  - Linking Granularity
  - Link de Nota, Heading e Bloco
  - Três Granularidades de Link
tags:
  - obsidian
  - linking
  - markdown
  - pkm
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Um internal link pode apontar para três alvos de tamanho diferente: a nota inteira, um heading dentro dela ou um bloco específico — parágrafo, item de lista, citação. Escolher a granularidade certa é o que separa uma referência vaga ("veja aquela nota") de uma referência verificável ("veja exatamente esta frase"). A cada granularidade corresponde uma sintaxe, e a qualquer uma delas se pode prefixar `!` para transcluir em vez de apenas apontar.

## Dinâmica / Passo a Passo

1. **Link de nota.** Digite `[[` no editor e selecione o arquivo, ou selecione um texto e digite `[[`, ou use **Add internal link** na Command palette. Para nota em pasta, o caminho começa na raiz do vault e usa barra normal mesmo no Windows: `[[Projects/Three laws of motion]]`. Links para formatos não-Markdown exigem a extensão: `[[Figure 1.png]]`.
2. **Link de heading.** Dentro da mesma nota, `[[#` lista os headings do arquivo. Para outra nota, `[[About Obsidian#Links are first-class citizens]]`. Subheadings encadeiam hashes: `[[Help and support#Questions and advice#Report bugs and request features]]`. Para procurar headings em todo o vault, `[[## termo]]` — `[[##` busca genericamente, `[[## team]]` busca headings que contenham *team*.
3. **Link de bloco.** Acrescente `#^` mais o identificador: `[[2023-01-01#^37066d]]`. Digitar o caret (`^`) abre a lista de sugestões, então não é preciso caçar o id na mão. Para buscar blocos no vault inteiro, `[[^^block]]` — a lista é bem maior que a de headings, porque mais coisas contam como bloco.
4. **Coloque o id no lugar certo, que depende do tipo de bloco.** Em *parágrafo simples*, no fim da linha, depois de um espaço: `... uma vez só. ^37066d`. Em *blocos estruturados* (listas, quotations, callouts, tabelas), o id vai em **linha separada**, com uma linha em branco antes e depois. Em *linha específica de uma lista*, direto no bullet.
5. **Prefira ids legíveis.** `^quote-of-the-day` funciona igual ao hash gerado e diz o que é. Block identifiers só aceitam letras latinas, números e hífens.
6. **Transclua com `!`.** `![[Internal links]]` embute a nota; `![[Internal links#^b15695]]` embute o bloco; `![[My note#^my-list-id]]` embute a lista. O conteúdo embutido se mantém atualizado quando o arquivo de origem muda.
7. **Escolha entre display text e alias.** `[[Example|Custom name]]` muda a aparência *naquele lugar*; um `aliases` no frontmatter cria um nome alternativo reutilizável em todo o vault, que aparece na sugestão com um ícone de seta curva e gera o link no formato `[[Artificial Intelligence|AI]]`.

## Regras

- **Partes internas de quotations, callouts e tabelas não são endereçáveis.** *"We do not support links to specific parts of quotations, callouts, and tables."* Você liga o bloco inteiro ou nada.
- **Block references não funcionam fora do Obsidian.** São específicas do app e não fazem parte do Markdown padrão — o link viaja, o alvo não.
- **Evite `# | ^ : %% [[ ]]` no nome da nota.** Uma string com esses caracteres pode simplesmente não funcionar como link.
- **Link dentro de code block não aparece na seção Links** do painel Outgoing links. Você consegue criar o link a partir de uma unlinked mention lá dentro, mas ele não entra na contagem — e portanto some das ferramentas de diagnóstico.
- **Renomear é seguro, mover para outro vault não.** O Obsidian atualiza automaticamente todos os links quando o arquivo é renomeado (desligável em **Settings → Files and links → Automatically update internal links**), mas internal links são locais ao vault.
- **Link para nota inexistente cria a nota no caminho escrito**, ignorando o `Default location for new notes`.

## Exemplo

Uma nota de literatura cita uma definição e quer que a nota permanente aponte para a frase exata, não para a página toda. No arquivo de literatura, marca-se o parágrafo:

```md
Obsidian stores your notes as Markdown-formatted plain text files in a vault. ^def-vault
```

Na nota permanente, três usos distintos do mesmo alvo:

| Intenção | Sintaxe | Efeito |
|---|---|---|
| Apontar para o contexto amplo | `[[Obsidian Help 01]]` | Link de nota; alimenta o backlink |
| Apontar para a seção | `[[Obsidian Help 01#Vault settings]]` | Link de heading; sobrevive à edição do parágrafo |
| Citar a frase e mostrá-la | `![[Obsidian Help 01#^def-vault]]` | Transclusão do bloco; atualiza sozinha |

---
Ref: [[Internal Link (Wikilink)]], [[Block Reference]], [[Embed (Transclusão)]], [[Alias (Obsidian)]], [[Backlink]], [[Obsidian Flavored Markdown (OFM)]], [[Diagnóstico do Grafo de Conhecimento]]
