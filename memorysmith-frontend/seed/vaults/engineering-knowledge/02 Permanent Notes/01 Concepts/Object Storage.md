---
title: Object Storage
aliases:
  - Armazenamento de Objetos
tags:
  - storage
  - cloud
  - architecture
type: concept
status: evergreen
created: 2026-07-09
---
Object Storage é um modelo de armazenamento que organiza dados como **objetos**, em vez de arquivos ou blocos.

Cada objeto contém:

- Dados
- Metadados
- Identificador único (Object ID)

É altamente escalável e ideal para grandes volumes de dados não estruturados.

```mermaid
graph TD

Client --> Bucket

Bucket --> Object1
Bucket --> Object2
Bucket --> Object3
```

> [!info]
> O acesso normalmente ocorre via APIs HTTP (REST), e não através de sistemas de arquivos.

## Casos de uso

- Backup
- Data Lake
- Logs
- Imagens
- Vídeos
- Machine Learning

## Vantagens

- Escalabilidade praticamente ilimitada
- Alta durabilidade
- Replicação automática
- Baixo custo

## Limitações

- Maior latência que Block Storage
- Não indicado para bancos de dados transacionais

## Veja também

- [[Block Storage]]
- [[File Storage]]
- [[Data Lake]]