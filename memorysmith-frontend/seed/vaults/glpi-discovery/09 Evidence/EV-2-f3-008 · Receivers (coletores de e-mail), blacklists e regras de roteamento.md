---
title: EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento
aliases: [EV-2-f3-008]
tags: [evidence, receiver, collector, mailgate, imap, pop, regras, roteamento, blacklist]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/collectors.rst · Receivers"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento

> [!quote] collectors.rst · "Receivers"
> Configuração acessível em `Configuration -> Receivers`. Um **receiver** (coletor) permite importar e-mails de uma caixa postal e transformá-los em tickets do GLPI; um mecanismo de roteamento os leva à entidade de destino. Cada receiver está associado a um endereço de e-mail; pode-se adicionar quantos receivers quiser (mais receivers = importação mais lenta).

> [!quote] Declaração de um receiver
> Fornecer nome do servidor e opções de conexão (**IMAP ou POP**, SSL, TLS, validação de certificado). Pode-se limitar o tamanho máximo de anexos (nenhuma importação, ou de 1 a 100 Mio) — valor herdado da config principal (`Setup -> General -> Assistance`). Uma opção alterna a data de criação do ticket entre data de importação e data do e-mail. Opcionalmente, define-se um diretório de arquivo (archive) na caixa para armazenar e-mails importados e recusados. Receivers com erro são indicados acima da lista, com o número de erros sucessivos exibido no formulário. Após validar o formulário, há botão para testar conexão e recuperação de mensagens. Uma **ação automática** faz a importação (intervalo configurável no formulário de tarefa automatizada); outra ação automática envia notificação quando um coletor falha repetidamente.

> [!warning] Respostas a e-mails gerados pelo GLPI são limpas ao importar de um coletor: todo o conteúdo entre as tags de topo e base é removido. Respostas devem ser feitas antes ou depois da mensagem original.

> [!quote] Blacklists
> Receivers podem usar um mecanismo de blacklist para remover conteúdos recorrentes mas inúteis (ex.: assinaturas de e-mail) e para impedir a importação de e-mails de endereços específicos (útil contra spam ou para tratar aliases).

> [!quote] Regras de atribuição de ticket aberto por receiver (routing)
> Mecanismo de roteamento baseado no **motor de regras** para criar tickets na entidade correta. Se as notificações não estiverem habilitadas, o menu não aparece em **Rules**.
> **Critérios** disponíveis: nome do receiver; requerente; domínio de e-mail (conhecido ou não); cabeçalhos de e-mail (`auto_submitted`, `from`, `in_reply_to`, `received`, `subject`, `to`, `X-Auto-Response-Suppress`, `X-priority`, `X-UCE-Status`); corpo do e-mail.
> Terceiro tipo de critério (dados do usuário/entidade): **known email domain** (domínio corresponde a domínio cadastrado numa entidade — filtra spam); **user: group** (usuário GLPI do remetente pertence a um grupo); **user with profile**; **user with single profile** (único perfil; entidade = entidade padrão nas preferências, senão a regra não casa); **user with the profile only once** (não tem o perfil em várias entidades).
> **Ações**: recusa do ticket (com ou sem notificação ao emissor) ou importação numa entidade (manual, por TAG, por domínio de e-mail, por perfil do usuário). O motor **para na primeira regra que casa**.

## Sustenta
- [[Receiver (coletor de e-mail) — visão de configuração]]
- [[Blacklists de coletor de e-mail]]
- [[Roteamento de tickets de e-mail (regras do coletor)]]
- [[Campos de configuração de um receiver]]
