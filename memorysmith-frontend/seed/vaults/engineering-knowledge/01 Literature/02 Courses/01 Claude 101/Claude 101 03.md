---
title: Claude 101 03
aliases:
  - "Módulo 3: Ampliando o alcance do Claude"
tags:
  - ai
  - claude
  - integration
  - research
type: literature
status: evergreen
source: Claude 101 — Anthropic Academy, lições 8–10
author: Anthropic
created: 2026-07-31
---
## Módulo 3: Ampliando o alcance do Claude

Cobre as lições *Connecting your tools*, *Enterprise search* e *Research for deep dives*.

## Resumo executivo

Os três mecanismos que tiram o Claude do isolamento da caixa de texto. O conector dá **acesso** às ferramentas; o Enterprise Search transforma esse acesso num ponto único de consulta ao conhecimento da organização; o Research usa esse acesso de forma **agêntica**, decidindo sozinho o que investigar em seguida.

## Principais ideias

### Conector é acesso, e acesso muda a pergunta possível

Um [[Connector]] transforma o assistente em colaborador informado: em vez de você colar o material, o Claude lê a fonte. E não só lê — dependendo da permissão concedida, **age**: cria conteúdo, atualiza registros, executa tarefas dentro da aplicação conectada.

> [!success] A demonstração mais didática do curso
> O curso mostra o mesmo pedido — *"draft a short status update on the budget project for my manager"* — e vai ligando fontes. O pedido não muda; o que muda é **o que você pode pedir que ele considere**. Conector não melhora a resposta: expande o espaço de perguntas.

### MCP é o USB-C da IA

A analogia do curso para o [[Model Context Protocol (MCP)]]: um padrão universal que permite ao Claude conectar-se a muitas aplicações por uma interface única e consistente. Sendo padrão aberto, qualquer desenvolvedor constrói um conector e ele funciona.

Dois tipos: **web connectors** (serviços de nuvem — Google Drive, Notion, Slack, Asana) e **desktop extensions** (rodam localmente pelo app desktop, dando acesso a arquivos locais e aplicações nativas).

### As três garantias de segurança do conector

1. **Acesso escopado** — a permissão é específica ao que o conector precisa, e é granular.
2. **O Claude vê o que você vê** — conectar seu e-mail corporativo não dá acesso à caixa do CEO.
3. **Revogável a qualquer momento** — pelas configurações do Claude ou do próprio serviço.

### Enterprise Search é um projeto pré-montado para a organização inteira

O [[Enterprise Search]] adiciona um *"Ask {Sua Org}"* na barra lateral. Diferente de um chat com conectores ligados, ele é **desenhado para busca**: instruções customizadas, foco em síntese, citação obrigatória de fonte. As perguntas que ele responde bem: *"o que aconteceu enquanto eu estava fora?"*, *"qual é nossa política de trabalho remoto?"*, *"quem eu procuro para aprender o sistema de billing?"*.

Setup em duas etapas: o Owner conecta as ferramentas da organização (documentos e chat são obrigatórios; e-mail é recomendado), depois cada pessoa autentica com a própria conta. A permissão original de cada ferramenta é respeitada.

### Research é investigação agêntica, não busca

O [[Agentic Research]] não faz uma busca: faz **muitas**, cada uma decidida a partir do que a anterior encontrou. Quatro passos — planeja (usando [[Extended Thinking]]), busca em múltiplas frentes, sintetiza, cita. Leva minutos, não segundos, e pode varrer centenas de fontes.

> [!tip] A regra de roteamento
> **Research** quando a resposta exige cruzar muitas fontes e você quer citações verificáveis. **Busca web** quando é um fato pontual e velocidade importa. **[[Extended Thinking|Thinking]]** quando o problema é de raciocínio, não de informação externa. **[[Enterprise Search]]** quando a resposta está *dentro* da empresa.

Como o Research demora, vale investir no prompt: seja específico no objetivo, **declare a estrutura das seções** que você quer, e inclua restrições (orçamento, prazo, geografia). O curso sugere até pedir ao Claude que ajude a escrever o prompt do Research antes de ativá-lo.

## Conceitos apresentados

- [[Connector]] — acesso padronizado a ferramentas externas
- [[Model Context Protocol (MCP)]] — o protocolo por trás dos conectores
- [[Enterprise Search]] — consulta unificada ao conhecimento organizacional
- [[Agentic Research]] — investigação multi-etapa autodirigida
- [[Extended Thinking]] — planejamento antes da execução

---
Ref: [[Claude 101]], [[Retrieval-Augmented Generation (RAG)]], [[Agentic AI]]
