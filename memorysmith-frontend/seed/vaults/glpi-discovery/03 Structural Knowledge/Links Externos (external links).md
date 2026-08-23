---
title: Links Externos (external links)
aliases: [External links, Links externos]
tags: [links-externos, configuracao, integracao-leve]
type: concept
status: confirmed
source: "[[EV-2-f1-003 · Links externos, tags e templates Twig|EV-2-f1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

**Links externos** associam elementos do GLPI a aplicações externas. Ficam visíveis na aba **Links** dos formulários e podem gerar tanto um simples hyperlink quanto o **download de um conteúdo** dinâmico (ex.: arquivo `.rdp` para acesso remoto).

## Tipos de link
- **Específico**: adicionado a um objeto (name, URL, icon, abrir em aba diferente).
- **Genérico**: aplicável a todos os elementos de um tipo de objeto, configurado em **Setup > External Links** (ou botão *Configure XXXX links*). Cada link pode ser associado a **um ou mais tipos** de elemento.

## Substituição por tags
O conteúdo/URL usa **tags** substituídas pelos valores do elemento — ver [[Tags de Substituição em Links Externos]]. As tags agora usam **templates Twig** — ver [[Migração de Links Externos para templates Twig (GLPI 11)]].

## Exemplos de uso
- Acesso remoto RDP: link de protocolo `{{NAME}}.rdp` com conteúdo de arquivo RDP e tags `{{IP}}`, `{{NAME}}`, `{{DOMAIN}}`.
- Link web: `https://{{IP}}`.
- Controle remoto VNC via navegador: `https://{{IP}}:5900` ou `https://{{NAME}}.{{DOMAIN}}:5900` (porta padrão 5900).

> [!note]
> Ao usar tags de portas de rede (IP, MAC), um hardware com várias portas gera tantos links quantas portas houver. Relaciona-se a [[Rede (portas, IP, VLAN)]].
