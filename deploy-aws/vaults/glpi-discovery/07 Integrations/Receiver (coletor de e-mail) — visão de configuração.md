---
title: Receiver (coletor de e-mail) — visão de configuração
aliases: [Receivers, Mail collector (config), Coletor de e-mail (doc)]
tags: [integracao, receiver, collector, mailgate, imap, pop, email]
type: integration
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento|EV-2-f3-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Receiver (coletor de e-mail) — visão de configuração

Um **receiver** (coletor) importa e-mails de uma caixa postal e os transforma em **tickets** do GLPI. Configuração em `Configuration -> Receivers`. Cada receiver está associado a um endereço de e-mail; pode-se ter quantos quiser (mais receivers = importação mais lenta).

A conexão usa **IMAP ou POP** (com SSL/TLS e validação de certificado). Ver os [[Campos de configuração de um receiver]] para todos os parâmetros.

A importação é realizada pela ação automática **`mailgate`** e os erros repetidos disparam **`mailgateerror`** (ver [[Catálogo de ações automáticas (crontasks)]]). O e-mail importado é roteado à entidade de destino pelo [[Roteamento de tickets de e-mail (regras do coletor)]].

> [!warning] Respostas a e-mails gerados pelo GLPI são **limpas** ao importar: todo o conteúdo entre as tags de topo e base é removido; respostas devem ser feitas antes ou depois da mensagem original.

Complementa os [[Blacklists de coletor de e-mail]]. Esta é a visão de configuração da integração implementada em código como [[Coletor de E-mail (MailCollector)]]; ver também a visão do usuário em [[Collectors de e-mail no Assistance]].

## Ver também
- [[API REST e GraphQL]]
- [[Gestão de Incidentes e Requisições (processo)]]
