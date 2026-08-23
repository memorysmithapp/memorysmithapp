---
title: Iteração sobre a Resposta da IA
aliases:
  - Troubleshooting de Resposta
  - Refinamento Iterativo
tags:
  - ai
  - prompting
  - ai-fluency
  - practice
type: practice
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
Técnica para diagnosticar e corrigir respostas insatisfatórias de um assistente de IA, tratando a primeira resposta como rascunho e não como entrega.

## Dinâmica / Passo a Passo

1. **Nomeie o defeito.** Genérica? longa demais? formato errado? tom errado? afirmação suspeita? Cada sintoma tem causa distinta.
2. **Aplique o antídoto correspondente** (tabela abaixo).
3. **Escolha o movimento**: pedir follow-up (construir sobre a resposta), dar feedback específico (o que gostou e o que não), redirecionar (corrigir a interpretação) ou **editar o próprio prompt** e reenviar.
4. **Saiba desistir da conversa.** Quando o fio se contaminou de tentativas anteriores, abrir chat novo com prompt melhor é mais rápido que consertar.

## Diagnóstico

| Sintoma | Causa | Antídoto |
|---|---|---|
| Resposta genérica | Faltou contexto da sua situação | Adicione público, papel e restrições. Não "escreva um e-mail sobre o atraso", e sim "escreva ao cliente enterprise explicando que a integração atrasa duas semanas; é o segundo atraso e eles foram pacientes" |
| Longa ou curta demais | O assistente está chutando a extensão | Seja explícito: "dois parágrafos", "menos de 100 palavras", "extensão não é problema" |
| Formato ignorado | Ele entendeu o *o quê*, não o *como* | Mostre, não descreva: forneça um exemplo do formato ou detalhe a estrutura |
| Informação confiante e errada | Geração plausível sobre fato específico ou nicho | Peça citação e nível de confiança; ative busca web; verifique o crítico por fora |
| Tom errado | O padrão é prestativo e profissional | Descreva o tom em linguagem simples e dê um exemplo do registro desejado |

## Regras

- **Feedback específico vence feedback genérico.** "Encurte" funciona; "corte os dois primeiros parágrafos e deixe a conclusão mais acionável" funciona melhor.
- **Uma mudança por vez.** Pedir três ajustes juntos torna impossível saber qual funcionou.
- **Editar o prompt original é diferente de mandar outra mensagem.** Editar refaz a resposta com contexto limpo; nova mensagem acumula o histórico.
- **Alucinação é risco calibrável, não erro aleatório.** Ela concentra-se em fato específico e domínio de nicho — que é exatamente onde a verificação deve ir.

## Exemplo

Resposta veio formal demais → *"Está bom, mas o tom está formal demais. Deixe conversacional, como eu escreveria para um colega de outro time."* → resposta ajustada → *"Agora corte para dois parágrafos."*

---
Ref: [[Prompt em Três Camadas]], [[AI Fluency]], [[Eval Leve de Tarefas com IA]], [[Claude 101 01]]
