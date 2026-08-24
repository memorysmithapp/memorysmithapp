# Engineering Knowledge Vault

> [!info]
> Base de conhecimento viva sobre **Arquitetura de Software, Arquitetura Corporativa, Cloud, IA Generativa e Engenharia de Software**, decomposta em conceitos atômicos permanentes que se conectam entre si.

Este vault não é um repositório de resumos. Cada livro lido, artigo estudado ou experiência prática é **decomposto em conceitos atômicos permanentes** que se conectam entre si. O valor não está nas notas isoladas: está na rede que elas formam.

> **Livros são temporários. Conceitos são permanentes. Conhecimento conectado gera valor.**

## Filosofia

Cinco princípios definem tanto o que entra quanto como é escrito:

1. **Atomic Notes.** Cada nota representa um único conceito. Se uma nota precisa de dois títulos de primeiro nível para explicar coisas diferentes, são duas notas.
2. **Evergreen Notes.** Nenhuma nota está concluída. O campo `maturity` do frontmatter registra em que ponto da maturação a nota está.
3. **Zettelkasten.** As notas se conectam por links `[[wikilink]]`. Uma nota sem links de entrada nem de saída é um sintoma, não um resultado.
4. **PARA.** As pastas separam **fonte** (de onde veio), **conhecimento permanente** (o que ficou), **navegação** (como encontrar) e **aplicação** (onde foi usado).
5. **Curadoria assistida por IA.** A IA propõe extrações, conexões e lacunas; **a curadoria final é sempre humana**.

## Onde cada nota entra

A árvore de pastas do vault, com a descrição de cada pasta, é a regra de entrada: antes de escrever, leia a descrição da pasta de destino. Ela diz o que se guarda ali e o que pertence a outra pasta.

> [!important] A separação Concept × Practice
> `MVP` é um **Concept**: define o que é um mínimo produto viável.
> `Canvas MVP` é uma **Practice**: descreve os 7 blocos que se preenche num workshop.
> A mesma leitura produz os dois, em notas separadas que se linkam.

## Frontmatter obrigatório

Toda nota carrega nove campos. Quando um campo não se aplica, fica presente e vazio, nunca ausente.

```yaml
---
title: Context Graph
aliases: [Execution Context]
tags: [ai, generative-ai, context]
type: concept          # literature | concept | practice | moc | project
maturity: evergreen    # seed | growing | evergreen
reviewed: false        # true somente após revisão humana da revisão vigente
source: Agentic AI, GraphRAG, AI Agent Architectures
author: ChatGPT
created: 2026-07-17
---
```

| `type` | Pasta | Propósito |
|---|---|---|
| `literature` | 01 Literature | Registro de leitura de um capítulo ou obra |
| `concept` | 02 / Concepts | Um conceito atômico: o que é, como funciona, como se relaciona |
| `practice` | 02 / Practices | Uma técnica ou atividade: passos, regras, template |
| `moc` | 03 Maps of Content | Mapa de navegação de um domínio |
| `project` | 04 Projects | Estudo de caso ou aplicação prática |

| `maturity` | Significado |
|---|---|
| `seed` | Rascunho: a ideia foi capturada mas ainda não está bem formada |
| `growing` | Em evolução: utilizável, com lacunas conhecidas ou links pendentes |
| `evergreen` | Madura: autossuficiente, conectada, revisada. Continua aberta a enriquecimento |

Os campos `maturity` e `reviewed` são o padrão de todos os vaults e formam dois eixos independentes. `maturity` é reavaliado a cada escrita: quem cria ou atualiza a nota declara o estágio em que o conteúdo ficou. `reviewed` registra se a revisão vigente passou por revisão humana: somente um humano o escreve como `true`, e qualquer edição posterior de conteúdo o devolve a `false`. Uma nota `evergreen` pode aguardar revisão, e uma nota `seed` pode já ter sido revisada.

## Nomenclatura

- O título da nota **é** o identificador: é o que `[[...]]` resolve.
- Siglas ficam entre parênteses após o nome por extenso: `Model Context Protocol (MCP)`. A sigla vai em `aliases`.
- Conceitos técnicos consagrados ficam em inglês (`Circuit Breaker`, `Data Lake`). Práticas e conceitos de método traduzidos ficam em português.
- Quando um nome canônico colidiria com outra nota, o escopo entra entre parênteses: `Discover (Lifecycle)`.
- Capítulos de obra: `<Obra> NN`, com `NN` de dois dígitos, garantindo ordenação natural.

## Regras de conexão

1. **Toda nota permanente precisa de pelo menos um link de entrada.** Nota órfã, na prática, deixa de existir.
2. **Todo conceito novo entra no MOC do seu domínio** no momento em que é criado.
3. **Links para notas inexistentes são permitidos e desejáveis**: sinalizam a próxima nota a escrever. Mas devem viver num cluster em construção ativa.
4. **Sempre que dois clusters se tocam, construa a ponte.** É onde o Zettelkasten paga.

## Fluxo de trabalho

1. **Capturar a fonte**: uma nota por capítulo em `01 Literature`, com resumo, ideias e a lista de conceitos apresentados.
2. **Extrair os conceitos**: cada conceito relevante vira nota atômica em `Concepts` ou `Practices`. Conceito que já existe é **enriquecido**, nunca duplicado.
3. **Registrar no MOC** do domínio, imediatamente.
4. **Conectar**: preencher `Veja também` / `Ref:` e procurar pontes com clusters existentes.
5. **Revisar**: verificar órfãs e links quebrados fora do cluster ativo.

## Callouts com semântica fixa

`> [!abstract]` definição de abertura · `> [!info]` esclarecimento factual · `> [!tip]` recomendação prática · `> [!important]` distinção que costuma ser confundida · `> [!warning]` armadilha ou anti-padrão · `> [!quote]` citação literal da fonte · `> [!question]` lacuna aberta · `> [!success]` leitura própria sobre o tema.
