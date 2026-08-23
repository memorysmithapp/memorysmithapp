---
title: Captura Web com Template de Clipper
aliases:
  - Web Clipper Template
  - Captura Web
  - Template de Clipper
tags:
  - obsidian
  - note-taking
  - pkm
  - automation
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Um template de Web Clipper é a entrada do fluxo de literatura: em vez de colar texto numa nota vazia e prometer organizar depois, o clipping já nasce com nome de arquivo padronizado, pasta certa e frontmatter de proveniência — autor, data de publicação, site, URL e contagem de palavras. O trabalho de estruturar acontece uma vez, na definição do template, e não a cada captura.

## Dinâmica / Passo a Passo

1. **Crie o template** em Web Clipper settings → **New template** na sidebar (ou duplique um existente pelo menu **More**). As alterações são salvas automaticamente.
2. **Defina o Behavior:** **Create a new note**, **Add to an existing note** (no topo ou no fim) ou **Add to daily note** (no topo ou no fim, exigindo o plugin Daily notes ativo).
3. **Monte o note name e a note location** com variáveis e filtros — os mesmos que valem em properties e no conteúdo. `{{title|safe_name}}` sanitiza o título para nome de arquivo (com `safe_name:windows`, `safe_name:mac` ou `safe_name:linux` quando quiser as regras de um SO específico); `Clippings/{{date|date:"YYYY"}}` distribui por ano.
4. **Configure os triggers e ordene-os.** Matching simples dispara quando a URL *começa com* o padrão (`https://obsidian.md`); regex vai entre barras, com escape dos caracteres especiais; `schema:@Recipe`, `schema:@Recipe.name` e `schema:@Recipe.name=Cookie` disparam por dados schema.org. Arraste os templates para mudar a ordem de avaliação.
5. **Preencha as properties de proveniência** com preset variables: `{{url}}`, `{{author}}`, `{{published}}` (formatável com o filtro `date`), `{{site}}`, `{{words}}`, `{{description}}`, `{{domain}}`.
6. **Monte o conteúdo.** `{{content}}` traz o conteúdo do artigo, os highlights ou a seleção, em Markdown — mas ele *tenta* extrair o conteúdo principal e nem sempre acerta. Quando errar, use selector variables: `{{selector:h1}}`, `{{selector:.author}}`, `{{selector:img.hero?src}}`, `{{selectorHtml:body|markdown}}`.
7. **Limpe com os filtros de HTML.** `markdown` converte para Obsidian Flavored Markdown; `strip_tags:("p,strong,em")` e `strip_attr:("class")` removem tags e atributos preservando o conteúdo; `strip_md` devolve texto puro.
8. **Use lógica para campos opcionais:** `{% if author %}Author: {{author}}{% endif %}`, o operador de fallback `{{title ?? headline ?? "No title"}}`, `{% for comment in selector:.comment %}` para listas repetidas.
9. **Use prompt variables só onde o formato é inconsistente.** A sintaxe é `{{"a summary of the page"}}`, com Interpreter habilitado, e o resultado aceita filtros: `{{"a summary of the page"|blockquote}}`.
10. **Exporte o `.json`** por **Export** no canto superior direito, ou copie os dados pelo menu **More**; a importação aceita o botão **Import** ou arrastar o arquivo para a área de templates.

## Regras

- **A primeira correspondência vence — deixe o fallback no topo.** *"The first match in your template list determines which template is used."* Se a página não casa com nenhum trigger, o Web Clipper usa o primeiro template da lista.
- **As aspas duplas distinguem prompt de preset variable.** `{{content}}` é preset; `{{"content"}}` é prompt. A doc chama isso de importante, não de detalhe.
- **A ordem de avaliação impede usar prompt dentro de lógica.** Primeiro rodam `{% if %}`, `{% for %}`, `{% set %}` e `{{variáveis}}`; só depois os prompts vão ao Interpreter. Você pode montar o prompt com lógica, mas não condicionar nada ao resultado dele.
- **Prompt variable é o último recurso.** É mais lenta, tem custo e implicações de privacidade conforme o provedor. A regra da doc: não use prompt se os dados estão em formato consistente extraível por outro tipo de variável. Use quando o formato varia entre sites — `{{"author of the book"}}` funciona em qualquer livraria, um selector funciona numa só.
- **Imagens não são baixadas automaticamente.** Elas ficam apontando para a URL da web: economiza espaço, mas quebra offline e quebra se a URL morrer. O comando **Download attachments for current file**, dentro do Obsidian, resolve por arquivo.
- **Reduza o Interpreter context.** Por padrão ele usa o HTML inteiro da página, o que deixa os prompts mais lentos e mais caros; um `{{selectorHtml:#main}}` como contexto do template corta o desperdício.
- **Highlights mudam o `{{content}}`.** As três opções — destacar no conteúdo com `==highlight==`, substituir o conteúdo pela lista de highlights, ou não fazer nada — alteram o que a variável devolve.

## Exemplo

Template de artigo, disparado por regex de domínio, gravando em `01 Literature/Clippings/<ano>`:

```markdown
{{title|safe_name}}

01 Literature/Clippings/{{date|date:"YYYY"}}/
```

Properties:

```yaml
---
title: "{{title}}"
author: "{{author ?? schema:author.name ?? site}}"
source: "{{url}}"
site: "{{site}}"
published: '{{published|date:"YYYY-MM-DD"}}'
words: "{{words}}"
type: literature
status: inbox
created: '{{date|date:"YYYY-MM-DD"}}'
---
```

Conteúdo:

```twig
{% if description %}> {{description}}{% endif %}

{{content}}
```

Nada aqui depende de julgamento no momento da captura. O clipping chega ao vault já filtrável por `[type:literature]` e `[status:inbox]`, e a triagem posterior é uma busca, não uma leitura.

---
Ref: [[Obsidian Web Clipper]], [[Properties (Frontmatter)]], [[Obsidian Flavored Markdown (OFM)]], [[Escrever Frontmatter Consultável]], [[Attachment]], [[Daily Note]], [[Busca Avançada no Obsidian]]
