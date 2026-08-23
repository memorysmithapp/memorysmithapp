---
title: Escolha do Modelo para a Tarefa
aliases:
  - Model Routing
  - Opus Sonnet Haiku
  - Match the Model to the Work
tags:
  - ai
  - claude
  - ai-fluency
  - practice
type: practice
status: evergreen
source: Claude Use Cases (Product Cowork) — claude.com/resources/use-cases
author: Anthropic
created: 2026-08-04
---
Critério para escolher a família de modelo antes de disparar a tarefa, a partir de duas dimensões: **densidade do insumo** (quanto há para ler com precisão) e **acabamento da saída** (quão pronto o artefato precisa sair).

## Dinâmica / Passo a Passo

1. **Meça a densidade do insumo.** Uma página fotografada com texto pequeno, rótulos de diagrama e legendas; centenas de imagens a comparar contra um manual; fontes que se contradizem — tudo isso é insumo denso.
2. **Meça o acabamento exigido.** Uma resposta na conversa é um extremo; um conjunto coordenado de `.pptx` + `.xlsx` + `.docx` que vai para um comitê é o outro.
3. **Roteie:**

| Família | Melhor para | Sinal típico |
|---|---|---|
| **Opus** | Leitura minuciosa e arquivo finalizado no fim | Imagem densa como entrada, conjunto de documentos como saída; muitas fontes conflitantes |
| **Sonnet** | Rascunho, planejamento, ida e volta sobre uma ideia | A escolha cotidiana; o trabalho é conversacional ou o entregável é simples |
| **Haiku** | Resposta rápida, reescrita simples | Baixa densidade dos dois lados |

4. **Ligue o [[Extended Thinking|raciocínio estendido]]** quando a tarefa envolver muitas fontes que discordam — o esforço de raciocínio escala com a complexidade antes de o agente começar a construir.
5. **Confirme o modelo no seletor** antes de disparar. Um fluxo desenhado para leitura de imagem em alta resolução perde a premissa se rodar na família errada.

## Regras

- **A capacidade é do modelo; a escala é da superfície.** Ler imagem com precisão é propriedade do modelo — você teria a mesma qualidade em alguns uploads no chat. O [[Claude Cowork]] é o que torna isso praticável na **pasta inteira** e agendável. Confundir os dois leva a culpar a ferramenta errada quando o resultado decepciona.
- **Modelo mais capaz não corrige prompt ruim.** [[Especificação de Entregável|Formato não declarado]] continua sendo escolha do modelo, qualquer que seja a família.
- **Reveja a rota quando a tarefa muda de natureza.** A mesma sessão pode começar exploratória e terminar produzindo documentos; se o acabamento subiu, a escolha inicial merece revisão.

## Exemplo

Adaptar uma página de livro didático fotografada em um deck e três handouts por nível de leitura: a entrada é uma imagem densa (texto pequeno, rótulos de diagrama, box lateral) e a saída é um conjunto de arquivos finalizados — **Opus**. Rascunhar com o agente como ensinar o mesmo conceito, turno a turno, antes de saber o que produzir — **Sonnet**.

---
Ref: [[Extended Thinking]], [[Claude Cowork]], [[Especificação de Entregável]], [[AI Fluency]], [[Escolha da Forma de Trabalho com IA]], [[Large Language Model (LLM)]]
