---
title: Claude Cowork Use Cases 03
aliases:
  - Cowork Use Cases — Cadeia de Superfícies
tags:
  - ai
  - claude
  - cowork
  - literature
type: literature
status: evergreen
source: claude.com/resources/use-cases — filtro Product = Claude Cowork
author: Anthropic
created: 2026-08-04
---
# 03 — Cadeia de superfícies e produção em lote

Casos 10 a 13: *Draft a credit memo from spreads and statements* · *Validate reserves and draft filing narrative* · *Adapt a standard textbook page to every reading level* · *Process batches of vendors with Cowork*.

## Resumo executivo

Nesta faixa o Cowork deixa de ser o lugar onde tudo acontece e passa a ser **a primeira estação de uma cadeia**: ele lê, cruza e diagnostica; a edição acontece no add-in da planilha; a narrativa, no add-in do editor. Os casos 12 e 13 mostram a outra face — produzir *n* saídas coordenadas a partir de um insumo, ou *n* execuções do mesmo processo sobre uma lista.

## Principais ideias

### Cada superfície tem a operação certa

Os casos 10 e 11 têm estrutura idêntica sobre domínios diferentes (renovação de crédito · revisão trimestral de reservas):

| Etapa | Superfície | Operação |
|---|---|---|
| Ler pasta + puxar por conector | Cowork | Diagnóstico contra a política |
| Corrigir célula, rodar cenário | Claude para Excel | Mutação verificável |
| Redigir memorando / narrativa | Claude para Word | Entrega |

*"O handoff Excel→Word carrega a conversa, então o rascunho já sabe quais índices se moveram."* Ver [[Continuidade de Contexto entre Superfícies]].

### O brief é o artefato de passagem

Dica repetida nos dois casos: *"encerre a sessão do Cowork pedindo um brief de um parágrafo com as referências de célula e as exceções de política — é isso que você cola na barra lateral do Excel. Mais enxuto que rolar a conversa para trás."*

E as referências são clicáveis: *"quando o Claude sinalizar `Triangles!K47`, clique e o Excel salta para a célula. Confira a fórmula e o padrão ao redor antes de concordar com qualquer mudança."*

### Erro de fórmula × movimento a explicar

A distinção mais fina desta faixa, no caso 11. O brief separa **três problemas de fórmula a corrigir** (fator de desenvolvimento hard-coded, referência à coluna errada, fator de cauda que não fluiu) de **um movimento a explicar na narrativa** (IBNR +$9.6M, dirigido por emergência de sinistros acima do esperado e pelo refresh dos LDFs — *"movimentos reais, não problemas de fórmula; só precisam de narrativa no filing"*).

### O agente diagnostica; você assina

Frase-tese dos dois casos financeiros: *"o Claude puxa os spreads e roda os índices; você toma a decisão de crédito"* · *"o Claude valida as fórmulas e sinaliza as anomalias; você assina as reservas."* Ver [[Human-in-the-Loop]].

### Várias saídas de um insumo, com invariante declarado

O caso 12 pede de uma página de livro: um deck de 8–10 slides, três handouts de um nível de leitura cada, e um exit ticket — *"mantenha todas as versões nos mesmos conceitos e no mesmo padrão. Liste o vocabulário que você simplificou no nível A."* A saída entrega essa lista (`lithosphere` → "camada externa da Terra"; frases abaixo de 15 palavras) **e o que ficou de fora e por quê** (a caixa "Carreiras em Geologia" não faz parte do padrão citado; o mapa em miniatura não reproduziu com nitidez suficiente). Ver [[Especificação de Entregável]].

### Do anexo por conversa ao processo por pasta

Também no caso 12, o degrau explícito: *"no chat você anexa uma página por vez. Num projeto Cowork, o projeto lê uma pasta inteira. Coloque os padrões e as regras de versão nas instruções do projeto uma vez, jogue as páginas-fonte da unidade na pasta, e o mesmo prompt produz o deck e os handouts para cada página."* Ver [[Project Workspace]] e [[Da Conversa à Skill e ao Agendamento]].

### Lote com paralelismo onde as etapas são independentes

Caso 13: onboarding de vários fornecedores numa sessão — ler os documentos da pasta, gerar NDA e MSA a partir dos templates, preencher o formulário no portal via navegador, atualizar a planilha de controle, organizar os arquivos. *"Atualizar o controle e gerar o contrato não dependem um do outro — peça ao Claude para abrir subagentes e rodar em paralelo."* Ver [[Agentes Paralelos]].

## Conceitos apresentados

- [[Continuidade de Contexto entre Superfícies]] — a nota central desta faixa
- [[Especificação de Entregável]] — quantidade, formato, invariante, lista do que mudou
- [[Escolha do Modelo para a Tarefa]] — o caso 12 explicita o critério Opus/Sonnet/Haiku
- [[Da Conversa à Skill e ao Agendamento]] — *"o loop é o mesmo todo ciclo; salve como skill para a próxima renovação começar a um clique"*

## Exemplos

> [!quote] Caso 12 — a lista de mudanças é o objeto de revisão
> *"Sempre que o Claude estiver reescrevendo, simplificando ou adaptando algo que você deu, acrescente ao prompt um pedido de lista do que mudou e do que ficou de fora. Essa lista é o que você revisa. Você confere as decisões que o Claude tomou, em vez de comparar cada saída ao original."*

> [!quote] Caso 13 — sessão autenticada
> *"Instale o Claude no Chrome e adicione como conector na sessão do Cowork. Faça login no portal de compras antes de começar — o Claude trabalha dentro da sua sessão autenticada."*

---
Ref: [[Claude Cowork Use Cases]], [[Continuidade de Contexto entre Superfícies]], [[Especificação de Entregável]], [[Agentes Paralelos]], [[Claude Cowork]]
