---
title: Campos de configuração de um receiver
aliases: [Receiver config fields, Collector fields]
tags: [dados, receiver, collector, imap, pop, campos, config]
type: entity
status: confirmed
source:
  - "[[EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento|EV-2-f3-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de configuração de um receiver

Parâmetros de um **receiver** (coletor de e-mail), em `Configuration -> Receivers`:

| Campo | Significado |
|---|---|
| Endereço de e-mail | E-mail associado ao receiver (um por receiver). |
| Nome do servidor | Servidor de e-mail. |
| Protocolo/conexão | **IMAP** ou **POP**, com SSL, TLS e validação de certificado. |
| Tamanho máximo de anexos | Nenhuma importação, ou de 1 a 100 Mio. Herdado da config principal (`Setup -> General -> Assistance`). |
| Data de criação do ticket | Alterna entre data de importação e data do e-mail. |
| Diretório de arquivo (archive) | Opcional; pasta na caixa onde e-mails importados e recusados são armazenados. |

Após validar o formulário, há botão para **testar conexão e recuperação de mensagens**. Receivers com erro são indicados acima da lista e exibem o número de erros sucessivos. A importação é feita por uma ação automática (`mailgate`); erros repetidos disparam a ação `mailgateerror` (ver [[Catálogo de ações automáticas (crontasks)]]).

## Ver também
- [[Receiver (coletor de e-mail) — visão de configuração]]
- [[Blacklists de coletor de e-mail]]
- [[Roteamento de tickets de e-mail (regras do coletor)]]
