---
title: Especificação de Entregável
aliases:
  - Deliverable Spec
  - Especificação de Saída
  - Output Contract
tags:
  - ai
  - agent
  - workflow
  - ai-fluency
  - practice
type: practice
status: evergreen
source: Claude Use Cases (Product Cowork) — claude.com/resources/use-cases
author: Anthropic
created: 2026-08-04
---
Técnica para declarar, dentro do próprio pedido, **o que volta**: quantos arquivos, em que formato, com que estrutura interna, quais campos por item, e o que precisa permanecer constante entre versões. É a diferença entre receber prosa que você reformata e receber material que já está no formato de uso.

Complementa [[Prompt em Três Camadas]]: a camada de regras diz *como se comportar*; a especificação de entregável diz *que objeto produzir*.

## Dinâmica / Passo a Passo

1. **Diga quantos e em que formato.** "Um deck de 8–10 slides, três handouts de uma página em `.docx`, um worksheet" — não "materiais para a aula".
2. **Declare o eixo de agrupamento** da saída estruturada: por tipo de violação, por área de controle, por fonte, por prioridade.
3. **Declare os campos por item.** Arquivo · problema · valor esperado · valor encontrado · confiança. É o que transforma prosa em algo triável.
4. **Diga o que é invariante entre versões.** "Todas as versões cobrem os mesmos conceitos e o mesmo padrão; muda o vocabulário e o tamanho da frase."
5. **Peça o registro do que mudou e do que ficou de fora.** Sempre que o agente reescrever, simplificar ou adaptar algo seu, peça a lista das decisões tomadas — ela é o que você revisa, em vez de comparar cada saída ao original.
6. **Peça a rastreabilidade quando a saída for factual.** Um documento-fonte com as citações ao lado do deck e da planilha; a discrepância registrada quando duas fontes divergirem.
7. **Diga onde salvar.** O arquivo nasce na pasta de trabalho, não no chat. Ver [[Work in a Folder]].

## Regras

- **Formato pedido é formato entregue.** Instrução explícita de estrutura é seguida com precisão; instrução ausente vira escolha do modelo — e o retrabalho é seu.
- **A lista de mudanças é o objeto de revisão.** Você audita decisões (*"`lithosphere` → 'camada externa da Terra'; frases abaixo de 15 palavras; a caixa de carreiras ficou de fora porque não está no padrão citado"*), não o diff completo.
- **O que ficou de fora vale tanto quanto o que entrou.** O item omitido — e o porquê — é onde mora o erro silencioso.
- **Um pedido, entregáveis coordenados.** Deck, planilha de cálculo e documento com fontes devem sair da mesma execução, ou divergem na primeira revisão.
- **Especificar não é engessar.** Com as regras escritas uma vez, adicionar a quarta versão é uma linha — o agente mantém as regras anteriores.

## Exemplo

*"Da página do livro, monte: um deck de 8–10 slides com o diagrama redesenhado em slide próprio; três versões de um handout de uma página (níveis A, B, C) — mesmos conceitos, vocabulário e tamanho de frase diferentes; e um exit ticket de 3 questões, igual para todos. Mantenha todas as versões nos mesmos conceitos e no mesmo padrão. Liste o vocabulário que você simplificou no nível A."*

---
Ref: [[Prompt em Três Camadas]], [[Work in a Folder]], [[Artifact]], [[Auditoria de Pasta contra Regras]], [[Síntese Multi-Fonte]], [[Iteração sobre a Resposta da IA]]
