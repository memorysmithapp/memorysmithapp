---
title: Estratégias de Cache em PWA
aliases:
  - Cache Strategy PWA
  - Workbox Strategies
tags:
  - frontend
  - performance
  - pwa
  - architecture
type: practice
status: evergreen
source: Workbox documentation (Google); Integrated Architecture Guide (PWA + AWS Serverless)
author: Google Chrome Team
created: 2026-07-25
---
Atribuir, a cada tipo de recurso da aplicação, uma estratégia explícita de cache no [[Service Worker]] — decidindo caso a caso o que pode ser servido do dispositivo e o que exige rede.

O resultado é uma aplicação que abre offline sem jamais exibir informação sensível desatualizada.

## Dinâmica / Passo a Passo

1. **Classifique cada recurso** por duas perguntas: *muda com que frequência?* e *qual o dano de exibi-lo desatualizado?*
2. **Atribua a estratégia** correspondente:

   | Recurso | Estratégia | Razão |
   |---|---|---|
   | App shell (JS/CSS com hash) | **Cache First** | Imutável — o nome muda quando o conteúdo muda |
   | `index.html` | **Network First** (timeout curto) | É o ponteiro para a versão nova dos assets |
   | GET de lista e detalhe | **Network First** (timeout ~10 s) | Prefere o atual; cai para o cache offline |
   | GET de dado sensível (financeiro, auditoria) | **Network Only** | Desatualizado aqui é informação errada |
   | Fontes e imagens estáticas | **Cache First** | Nome versionado |
   | Objetos de usuário (uploads) | **Stale While Revalidate** | Exibe rápido, atualiza em segundo plano |
   | POST / PATCH / DELETE | **Network Only** | Mutação nunca é cacheada |

3. **Defina limites por cache**: número máximo de entradas e expiração, para não crescer sem teto.
4. **Trate a mutação offline** com fila de reenvio (Background Sync) e chave de [[Idempotência]] gerada **antes** da primeira tentativa.
5. **Implemente o aviso de atualização**: ao detectar service worker novo em espera, exiba um aviso persistente com ação de recarregar.
6. **Sinalize o estado offline na interface** — o usuário precisa saber que está vendo dado em cache.

## Regras

- **Nenhum recurso sem estratégia declarada.** O padrão implícito é sempre o errado para alguma coisa
- **A chave de idempotência é gerada na camada de serviço, não no hook.** Se nascer no momento do envio, cada retentativa do Background Sync gera uma chave nova — e a operação é executada n vezes no servidor
- **Nunca cacheie resposta autenticada em cache compartilhado** sem particionar por usuário; ao encerrar a sessão, limpe os caches de dados
- **`index.html` em Cache First congela a aplicação** numa versão antiga. É o defeito mais comum de PWA
- **Não force a ativação do worker novo sem consentimento** — a aba em uso passa a falar com assets de outra versão

## Exemplo

Usuário no metrô, sem sinal, abre a aplicação: o app shell vem do cache (Cache First) e a lista de tarefas aparece a partir da última resposta cacheada, com um indicador de "offline". Ele marca uma tarefa como concluída; a mutação é enfileirada com a chave `abc-123`. A rede volta em duas tentativas — as duas com a mesma chave — e o servidor aplica a operação uma vez só.

---
Ref: [[Service Worker]], [[Progressive Web App (PWA)]], [[Estratégias de Cache]], [[Idempotência]], [[Amazon CloudFront]]
