---
title: Refatorar Notas com Note Composer
aliases:
  - Note Composer
  - Refatorar Notas
  - Extrair e Mesclar Notas
tags:
  - obsidian
  - zettelkasten
  - pkm
  - note-taking
  - plugin
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Atomicidade não é uma decisão que se toma uma vez, na criação da nota — é um estado que se perde com o tempo. Uma nota permanente cresce até conter três ideias; duas notas escritas com meses de distância acabam dizendo a mesma coisa com palavras diferentes. O Note composer é o core plugin que corrige as duas derivas com as únicas duas operações necessárias: extrair parte de uma nota para uma nova e mesclar uma nota inteira em outra — sempre reapontando os links.

## Dinâmica / Passo a Passo

1. **Extraia uma seleção para nova nota** quando a nota acumulou uma segunda ideia. Em Editing view, selecione o texto, clique com o botão direito e escolha **Extract current selection...** (ou o comando **Note composer: Extract current selection...** na Command palette), depois escolha a nota de destino.
2. **Mescle uma nota inteira** quando duas notas dizem o mesmo. No File explorer, botão direito na nota → **Merge entire file with...**, ou **Note composer: Merge current file with another file...** pela Command palette; selecione a nota de destino e confirme em **Merge**.
3. **Use os três modificadores no seletor de destino** — valem tanto para merge quanto para extract: `Enter` adiciona no **fim** da nota de destino, `Shift+Enter` adiciona no **início**, `Ctrl+Enter` (`Cmd+Enter` no macOS) **cria uma nota nova** com o conteúdo.
4. **Configure o template** informando um **Template file location** nas opções do plugin, com as variáveis disponíveis: `{{content}}` (o conteúdo mesclado ou o texto extraído — se você não incluir a variável, o conteúdo vai para o fim do template), `{{fromTitle}}` (nome da nota de origem), `{{newTitle}}` (nome da nota de destino, útil como heading no topo) e `{{date:FORMAT}}`, por exemplo `{{date:YYYY-MM-DD}}`, com a data de criação da nova nota.
5. **Escolha o que fica para trás no extract.** Por padrão, o texto extraído é substituído por um link para a nota de destino; nas configurações, isso pode virar um embed da nota de destino ou nada.
6. **Verifique o resultado no painel de backlinks** da nota que sumiu no merge: se os links foram reapontados, ela não deixa referências órfãs.

## Regras

- **O merge destrói a origem.** *"Merging notes adds a note to another and removes the first one."* Não é cópia: é movimentação com deleção — e por isso mesmo o plugin reaponta todos os links para a nota resultante.
- **Mantenha a confirmação ligada.** Por padrão o Note composer pede confirmação ao mesclar; a própria doc só admite desligá-la porque o [[File Recovery]] existe como rede.
- **File recovery é rede, não backup.** Snapshots são salvos a no mínimo 5 minutos de distância e guardados por 7 dias por padrão (configurável em **Settings → Core plugins → File recovery**), ficam fora do vault, nas global settings, com o caminho absoluto da nota, **não sincronizam entre dispositivos** e restauram apenas `.md` e `.canvas`.
- **Extract com "nada para trás" quebra a rastreabilidade.** Deixar o link é o padrão porque preserva o caminho de volta; o embed preserva a leitura contínua. Só remova quando o texto extraído realmente não pertencia àquela nota.
- **Refatore pelo critério da atomicidade, não do tamanho.** A pergunta não é "esta nota está longa?", e sim "esta nota tem mais de uma afirmação que outra nota poderia querer citar isoladamente?".

## Exemplo

Uma nota de prática sobre sync cresceu e passou a explicar, na metade, o funcionamento do remote vault — conceito que outras três notas gostariam de citar sozinho. Seleciona-se o trecho, **Extract current selection...**, `Ctrl+Enter` para criar `Remote Vault.md`, e o template do plugin monta o esqueleto:

```markdown
---
title: {{newTitle}}
source: extraído de "{{fromTitle}}"
created: {{date:YYYY-MM-DD}}
---
{{content}}
```

No lugar do trecho fica `[[Remote Vault]]`. Em seguida, descobre-se que uma nota antiga chamada `Vault Remoto` dizia quase o mesmo: botão direito → **Merge entire file with...** → `Remote Vault` → `Shift+Enter` para colocar o conteúdo antigo no topo. A nota antiga some, e os links que apontavam para ela passam a apontar para a nova — a rede se mantém intacta enquanto as unidades mudam de forma.

---
Ref: [[File Recovery]], [[Unique Note (Zettelkasten Prefix)]], [[Internal Link (Wikilink)]], [[Backlink]], [[Embed (Transclusão)]], [[Ligar Notas em Três Granularidades]]
