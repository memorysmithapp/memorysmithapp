---
title: Artifact
aliases:
  - Artefato de IA
  - Artifacts
tags:
  - ai
  - generative-ai
  - claude
  - output
type: concept
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> Um **Artifact** é uma saída autônoma e interativa que o assistente cria numa janela dedicada ao lado da conversa, em vez de despejar o conteúdo dentro do chat.

## Conceito

O artifact resolve um problema de **formato**, não de capacidade: um site funcional, um gráfico interativo ou um documento de dez páginas não se lê bem como bloco de texto rolando dentro de uma conversa. Ao promovê-los a objeto separado, o conteúdo passa a ser renderizado, versionado, copiável, baixável e — o ponto central — **reutilizável fora da conversa que o gerou**.

O critério de promoção é sobre autonomia do conteúdo:

- É significativo e autocontido (tipicamente mais de 15 linhas)
- É algo que você provavelmente vai querer **editar, iterar ou reutilizar**
- Faz sentido **sem** a conversa em volta
- É conteúdo que você vai querer referenciar depois

## Tipos

| Tipo | Serve para |
|---|---|
| Documento (Markdown / texto) | Notas de reunião, relatórios, planos, posts |
| Trecho de código | Código funcional em qualquer linguagem |
| Página HTML | Landing pages, formulários, demos e protótipos num arquivo só |
| Imagem SVG | Logos, ícones, ilustrações vetoriais |
| Diagrama Mermaid | Fluxogramas, diagramas de sequência, Gantt, organogramas |
| Componente React | Calculadoras, dashboards, jogos, visualizações — com lógica real |

> [!warning] Documento Office não é Artifact
> `.docx`, `.xlsx`, `.pptx` e PDF são produzidos por outro caminho — a capacidade de criação de arquivos, apoiada em [[Agent Skill|Skills]] — e voltam como arquivo para download. A distinção importa: artifact renderiza *na* conversa; arquivo sai *da* conversa.

## Comparação

| | Artifact | Resposta no chat | Arquivo gerado |
|---|---|---|---|
| Renderização | Interativa, janela própria | Texto corrido | Nenhuma — abre no app nativo |
| Iteração | Versionada, incremental | Reescreve tudo | Nova versão do arquivo |
| Compartilhamento | Link público ou interno, com *remix* | Copiar e colar | Anexo |
| Melhor para | Protótipo, diagrama, documento vivo | Explicação, resposta curta | Entregável formal |

## Publicação

Publicar torna **só a versão selecionada** pública — a conversa permanece privada. Quem tem o link visualiza e interage sem conta, e pode fazer *remix*: abrir o artifact na própria conversa e evoluí-lo. Artifacts publicados não são indexados por buscadores. A publicação é revogável.

> [!tip] Como pedir um artifact melhor
> Seja específico no comportamento desejado, **descreva quem vai usar** (um fluxograma "para pessoas recém-contratadas" sai diferente de um "para o time de engenharia") e itere um recurso por vez.

## Veja também

- [[Agent Skill]]
- [[Project Workspace]]
- [[Large Language Model (LLM)]]
