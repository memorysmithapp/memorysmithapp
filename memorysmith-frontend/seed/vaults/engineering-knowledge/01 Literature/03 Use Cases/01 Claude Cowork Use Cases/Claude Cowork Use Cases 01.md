---
title: Claude Cowork Use Cases 01
aliases:
  - Cowork Use Cases — Arquivos Locais
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
# 01 — Trabalho sobre arquivos locais

Casos 1 a 4: *Organize files across your desktop* · *Prep scattered documents for a compliance audit* · *Audit a folder of visual assets against your guidelines* · *Reconcile transactions across your accounts*.

## Resumo executivo

Os quatro casos compartilham a mesma premissa: o insumo é **uma pasta real, não curada**, e o agente decide sozinho o que abrir. A diferença entre eles é o que se faz com o conteúdo lido — classificar (1, 2), confrontar contra regras (3) ou cruzar entre si (4).

## Principais ideias

### A bagunça é o caso de uso, não um obstáculo

*"Aponte o Cowork para a bagunça, não só para os arquivos organizados. Se você tem uma pasta 'a organizar' com scans e downloads aleatórios, é exatamente por onde começar."* O agente classifica por **conteúdo**; `scan0042.pdf` e `policy_v2_final.docx` são tratáveis. A pré-organização que se faria antes de anexar deixa de existir.

### O escopo da pasta é a unidade de permissão

O padrão recorrente de onboarding é o mesmo nos quatro: baixar o app, iniciar sessão, e **"Work in a folder"** ou o botão `+` para arquivos individuais. A recomendação para quem hesita é começar por uma pasta só e ampliar depois. Ver [[Work in a Folder]].

### Confiança e cobertura fazem parte do achado

O caso 3 entrega cada violação com `arquivo · problema · valor do guia · valor do ativo · confiança`, agrupada por tipo, seguida de *"189 ativos passam em todas as checagens"* e de um bloco **"less certain"** — o dourado que pode ser desvio de compressão do JPG, o verde que talvez seja variante regional aprovada. O caso 2 faz o equivalente pela **ausência**: nenhuma evidência de teste de restauração, continuidade de negócio fora do inventário.

### A auditoria termina fora do chat

Os fechamentos oferecidos são sempre um sistema de destino: abrir as violações de alta confiança como tarefas no tracker, gerar a matriz de controles como planilha na pasta, postar o resumo no canal. Ver [[Auditoria de Pasta contra Regras]].

### Escrita é ação, e o agente para

O caso 1 pergunta antes de apagar o que parece importante e devolve um antes/depois explícito (180+ itens → 5 pastas; 3 arquivos vazios removidos). O caso 2 encerra o diagnóstico com *"quer que eu prossiga com a reorganização?"* — o diagnóstico é lido antes de qualquer mutação.

### Capacidade do modelo × escala da superfície

A distinção mais precisa da fonte, no caso 3: *"a leitura em alta resolução é propriedade do modelo. O Cowork é o que dá ao modelo a pasta inteira — ativos e documentos de referência juntos — e o contexto de trabalho para processar os 200 numa tarefa só."* Ver [[Escolha do Modelo para a Tarefa]].

## Conceitos apresentados

- [[Work in a Folder]] — o modelo de acesso local
- [[Plano Revisável]] — o plano na barra lateral antes da execução
- [[Observabilidade de Sessão Agêntica]] — painéis de progresso, contexto e artifacts; ponto cinza; sessão paralela
- [[Auditoria de Pasta contra Regras]] — a prática destilada dos casos 2 e 3
- [[Da Conversa à Skill e ao Agendamento]] — o fecho do caso 3: skill `brand-compliance-audit` agendada às sextas

## Exemplos

> [!quote] Caso 3 — hierarquia de regras
> *"Se o texto legal é inegociável mas um hex a poucos pontos é aceitável, diga isso no prompt ou nas instruções do projeto. As violações legais virão como prioridade alta e as cores quase-certas como baixa — a saída já sai ordenada do jeito que você triaria."*

> [!quote] Caso 1 — privacidade
> *"O Cowork roda localmente. Ele consegue ver e mover seus arquivos, mas nada é enviado para lugar nenhum."*

---
Ref: [[Claude Cowork Use Cases]], [[Work in a Folder]], [[Auditoria de Pasta contra Regras]], [[Claude Cowork]]
