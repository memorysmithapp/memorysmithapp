---
title: Auditoria de Pasta contra Regras
aliases:
  - Folder Audit
  - Conformidade de Ativos
  - Auditoria contra Guideline
tags:
  - ai
  - agent
  - workflow
  - compliance
  - practice
type: practice
status: evergreen
source: Claude Use Cases (Product Cowork) — claude.com/resources/use-cases
author: Anthropic
created: 2026-08-04
---
Técnica para verificar um conjunto grande de artefatos contra um conjunto escrito de regras, produzindo uma lista de violações **triável** — agrupada, com valor esperado, valor encontrado e grau de confiança por item.

Serve a qualquer par *(coleção, documento normativo)*: ativos de marketing contra o manual de marca, documentos contra o framework de controles de uma auditoria, planilha de reservas contra a metodologia declarada, capturas de tela contra regras de acessibilidade.

## Dinâmica / Passo a Passo

1. **Junte os dois lados na mesma pasta.** Os artefatos e o documento de regras precisam estar no mesmo escopo — é o que permite ao agente confrontar um contra o outro. Ver [[Work in a Folder]].
2. **Nomeie as regras a verificar, uma a uma.** Não "verifique a marca": *logo da versão anterior*, *hex fora da paleta (`#0052B3` no lugar de `#004B9F`)*, *texto legal ausente ou abaixo do corpo mínimo*.
3. **Declare o agrupamento da saída.** Por tipo de violação (Logo, Cor, Tipografia, Texto legal, Alegações) — é o eixo pelo qual você vai despachar o trabalho depois.
4. **Declare os campos por achado.** Arquivo · problema · valor da regra · valor encontrado · confiança. Ver [[Especificação de Entregável]].
5. **Hierarquize as regras.** Diga o que é inegociável (texto legal) e o que é tolerável (um hex a poucos pontos). Sem isso, tudo volta com o mesmo peso e a triagem é sua.
6. **Peça a contagem de aprovados e o bloco de "menos certos".** Saber que 189 de 200 passaram é o que dá escala ao resultado; o bloco de baixa confiança é a lista curta que você abre com os próprios olhos.
7. **Encerre no sistema de destino.** A auditoria não termina no chat: vira tarefa no tracker para os itens de alta confiança, planilha de matriz de controles, ou resumo no canal do time.

## Regras

- **Regra não escrita não é auditável.** O insumo é um documento normativo, não a memória de quem pede. Se a regra só existe na sua cabeça, escreva-a antes.
- **Confiança é parte do achado, não um extra.** É o que separa "o rodapé está faltando" de "o dourado pode ser desvio de compressão do JPG". Sem gradação, você revisa tudo ou confia em tudo.
- **A cobertura vale tanto quanto a violação.** Apontar a *ausência* — nenhuma evidência de teste de restauração, continuidade de negócio fora do inventário — costuma ser o achado mais caro.
- **Aponte para a bagunça, não para a versão limpa.** A pasta "a organizar" é exatamente onde a técnica paga; pré-organizar antes de auditar é fazer o trabalho duas vezes.
- **Confirme antes de mutar.** Renomeação em lote e reorganização são escrita. Peça o mapa antes da execução.

## Exemplo

*"Audite todo PNG e JPG desta pasta contra `brand-2025-q2.pdf` e `legal-required-copy.txt`. Sinalize: logo de 2024, hex fora da paleta, texto legal ausente ou abaixo do mínimo. Agrupe por tipo de violação. Para cada um: arquivo, problema, valor da regra, valor do ativo, confiança. Termine com quantos ativos passaram em todas as checagens."*

O retorno vem agrupado, com 10 itens de alta confiança prontos para virar tarefa, um bloco de dois itens "menos certos" para inspeção humana, e 189 aprovados — e a pergunta natural de fechamento: *abrir as tarefas no tracker ou salvar o relatório na pasta?*

---
Ref: [[Work in a Folder]], [[Especificação de Entregável]], [[Claude Cowork]], [[Da Conversa à Skill e ao Agendamento]], [[Human-in-the-Loop]], [[Threat Modeling]]
