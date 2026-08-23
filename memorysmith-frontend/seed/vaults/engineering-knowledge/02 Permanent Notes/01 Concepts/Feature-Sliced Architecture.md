---
title: Feature-Sliced Architecture
aliases:
  - Feature Slice
  - Arquitetura por Fatias de Funcionalidade
  - Vertical Slice
tags:
  - frontend
  - architecture
  - modularity
  - design
type: concept
status: evergreen
source: Feature-Sliced Design methodology; Integrated Architecture Guide (PWA + AWS Serverless)
author: Comunidade Feature-Sliced Design
created: 2026-07-25
---
> [!abstract]
> Feature-sliced é a organização de código por **domínio de negócio** em vez de por tipo técnico: tudo que uma funcionalidade precisa — tela, hooks, serviços, tipos — vive na mesma pasta.

## Conceito

A organização por camada técnica (`/components`, `/hooks`, `/services`, `/types`) parece limpa e envelhece mal. Alterar uma funcionalidade exige abrir quatro pastas distantes; excluí-la exige caçar os arquivos órfãos espalhados; e nada impede que qualquer arquivo importe qualquer outro, até que tudo dependa de tudo.

Fatiar por domínio inverte o critério: **o que muda junto fica junto**. A fatia é a unidade de leitura, de alteração e de exclusão.

```
src/
├── features/
│   ├── pedidos/
│   │   ├── PedidosPage.tsx
│   │   ├── PedidoForm.tsx
│   │   ├── hooks/usePedidosQuery.ts
│   │   ├── services/pedidos.service.ts
│   │   ├── types/pedidos.types.ts
│   │   └── index.ts          ← API pública da fatia
│   └── notificacoes/
└── shared/                   ← só o que é genuinamente transversal
    ├── api/  components/  hooks/  store/
```

## As duas regras que sustentam o modelo

1. **Nenhuma fatia importa de outra fatia.** Se `pedidos` importa de `clientes`, as duas viraram uma. A comunicação acontece por rota, por store compartilhado, por evento, ou por elevação do que é comum para `shared/`.
2. **A fatia expõe uma API pública** por `index.ts`. O que não está exportado ali é interno, e reorganizar internamente não quebra ninguém.

## Correspondência com o backend

Em uma arquitetura serverless organizada por domínio, a fatia do frontend espelha o domínio Lambda e o caminho da API. A tabela que amarra os três — funcionalidade, domínio, rota — é o artefato que impede a divergência de nomes entre as duas metades do sistema, e deve ser tratada como fonte única de verdade do vocabulário.

| Fatia (frontend) | Domínio (backend) | Rota |
|---|---|---|
| `pedidos` | `pedidos` | `/v1/pedidos` |
| `notificacoes` | `notificacoes` | `/v1/notificacoes` |

É o mesmo raciocínio de [[Bounded Context]] aplicado à camada de apresentação: a fronteira do módulo acompanha a fronteira do domínio, não a da tecnologia.

> [!important] `shared/` é o dreno do modelo
> Toda arquitetura por fatias morre do mesmo jeito: `shared/` cresce até virar o monólito que se queria evitar. O critério de entrada precisa ser estreito — algo só é compartilhado quando **três ou mais** fatias o usam e ele não carrega regra de negócio de nenhuma.

## Veja também

- [[Bounded Context]]
- [[Server State e Client State]]
- [[Domain Driven Design]]
- [[Microservices]]
- [[Backend for Frontend]]
