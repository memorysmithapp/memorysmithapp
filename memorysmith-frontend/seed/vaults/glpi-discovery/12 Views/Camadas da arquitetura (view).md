---
title: Camadas da arquitetura (view)
aliases: [Arquitetura em camadas, Camadas GLPI]
tags: [view, arquitetura, dominio/foundation]
type: view
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]"
  - "[[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]]"
  - "[[EV-1-005 · Motor de busca SQL dirigido por SEARCH_OPTION|EV-1-005]]"
author: CAD Discovery
created: 2026-07-10
---

# Camadas da arquitetura (view)

Visão em camadas do GLPI 11 (deriva de [[Kernel e Bootstrap]], [[CommonDBTM (Active Record)]],
[[Motor de Busca (Search Engine)]], [[Organização do código-fonte]]).

```mermaid
flowchart TB
    subgraph Cliente
      UI[Browser / API client]
    end
    subgraph Entrada
      IDX[public/index.php]
      KRN[Kernel Symfony\nMicroKernelTrait]
      FRONT[front/*.php + ajax/*.php\ncontrollers legados]
    end
    subgraph Apresentacao
      TWIG[Templates Twig]
    end
    subgraph Dominio
      CDBTM[CommonDBTM\nActive Record ~1586 classes]
      SEARCH[Search Engine\nSEARCH_OPTION → SQL]
      HOOKS[Plugin Hooks]
      RBAC[Perfis e Direitos]
      ENT[Entidades multi-tenancy]
    end
    subgraph Dados
      DB[(MariaDB / MySQL)]
    end

    UI --> IDX --> KRN
    KRN --> FRONT
    KRN --> TWIG
    FRONT --> CDBTM
    CDBTM --> SEARCH
    CDBTM --> HOOKS
    CDBTM --> RBAC
    CDBTM --> ENT
    CDBTM --> DB
    SEARCH --> DB
```

> [!note]
> Fronteira exata Kernel↔`front/` em aberto: ver
> [[INV-1-001 · Roteamento Symfony vs entrypoints legados]].
