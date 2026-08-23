---
title: Checklist de Nova Funcionalidade Full Stack
aliases:
  - New Feature Checklist
  - Definition of Done Full Stack
tags:
  - software-engineering
  - architecture
  - quality
  - devops
type: practice
status: evergreen
source: Integrated Architecture Guide (PWA + AWS Serverless)
author: Heitor Rapcinski
created: 2026-07-25
---
Percorrer uma lista fixa de verificações ao adicionar qualquer funcionalidade nova, garantindo que as decisões arquiteturais já tomadas sejam aplicadas por padrão em vez de redecididas caso a caso.

O resultado é consistência entre funcionalidades escritas por pessoas diferentes em momentos diferentes — e uma revisão de código que discute o problema, não o formato.

## Dinâmica / Passo a Passo

**Passo zero — registrar o nome.** Antes de qualquer código, acrescentar a linha na tabela `funcionalidade ↔ domínio ↔ rota ↔ armazenamento`. É o que impede o frontend e o backend de baterem nomes diferentes para a mesma coisa.

### Backend

- [ ] Stack de infraestrutura própria, com política IAM de menor privilégio por função
- [ ] Camadas separadas: domínio → aplicação → infraestrutura ([[Hexagonal Architecture]])
- [ ] Rotas com autorizador de identidade **e** autorizador de tenant
- [ ] `tenantId` lido do contexto do autorizador — nunca do cabeçalho
- [ ] Prefixo `TENANT#{id}` em toda chave de acesso a dado
- [ ] Resposta segue o envelope do [[Contrato de API Padronizado]], com `requestId` nos erros
- [ ] Timeout explícito, dimensionado pelo tipo de trabalho
- [ ] Idempotência aplicada em POST/PUT/PATCH; consumidores assíncronos usam o `eventId` do evento, não o cabeçalho
- [ ] Evento de domínio publicado com esquema registrado
- [ ] Fila com DLQ para todo consumidor assíncrono
- [ ] Tracing ativo, log estruturado e métrica de negócio ([[Observabilidade em Funções Serverless]])
- [ ] Os quatro alarmes obrigatórios criados
- [ ] Valores que o frontend precisa exportados para o armazenamento de parâmetros
- [ ] Se exige atomicidade entre entidades: transação, não escritas sequenciais
- [ ] Se outros precisam reagir à mudança: stream habilitado
- [ ] Se exige agregação: caminho de exportação e consulta analítica desenhados

### Frontend

- [ ] Fatia própria em `features/{funcionalidade}/` com estrutura completa ([[Feature-Sliced Architecture]])
- [ ] Esquema de validação declarado e tipos derivados dele
- [ ] Serviço chamando o caminho registrado na tabela
- [ ] Fábrica de chaves de consulta — nenhuma string solta
- [ ] Leitura e escrita pela camada de server state ([[Server State e Client State]])
- [ ] Chave de idempotência gerada no serviço, não no hook
- [ ] Rota com carregamento tardio, envolvida por fronteira de erro e fallback de suspensão
- [ ] Componentes a partir do catálogo do design system; sem valores arbitrários de estilo
- [ ] Nenhuma literal de texto — tudo por chave de tradução
- [ ] Navegação por teclado e semântica acessível verificadas
- [ ] Teste de integração do fluxo principal e teste ponta a ponta do caminho feliz
- [ ] Comportamento offline verificado
- [ ] Se há evento em tempo real: confirmar que ele invalida a chave correta
- [ ] Se há upload: fluxo pré-assinado, nunca arquivo pela API
- [ ] Exportação só pela API pública da fatia

## Regras

- **A lista é condição de merge, não sugestão.** Item não aplicável é marcado como tal, com uma linha de justificativa
- **O passo zero vem antes do código.** Nome decidido depois da implementação nunca é corrigido nos dois lados
- **Nenhum item é "a gente faz depois".** DLQ, alarme e timeout adicionados depois de um incidente custam o incidente
- **Quando um item se repete em toda funcionalidade, ele vira abstração** — um construct de infraestrutura, um middleware, um gerador. A lista encolhe com a maturidade da plataforma

## Exemplo

Funcionalidade nova de relatórios. O passo zero registra `relatorios` nos três lugares. O backend é criado com transação desnecessária? Não — o item aponta que só é preciso se houver invariante entre entidades. O item de agregação, esse sim, dispara a decisão: os dados vão para exportação particionada e consulta analítica, em vez de varredura na tabela transacional. A decisão foi tomada pela lista, não descoberta na fatura.

---
Ref: [[Contrato de API Padronizado]], [[Autorização Multi-Tenant Fim a Fim]], [[Observabilidade em Funções Serverless]], [[Feature-Sliced Architecture]], [[Hexagonal Architecture]], [[Server State e Client State]]
