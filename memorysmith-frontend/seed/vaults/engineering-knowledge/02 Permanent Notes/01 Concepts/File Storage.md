---
title: File Storage
aliases:
  - Armazenamento de Arquivos
tags:
  - storage
  - cloud
type: concept
status: evergreen
created: 2026-07-09
---
File Storage organiza dados em uma estrutura hierárquica composta por diretórios e arquivos.

É o modelo de armazenamento mais familiar para usuários e aplicações tradicionais.

```mermaid
graph TD

Root --> FolderA
Root --> FolderB

FolderA --> File1
FolderA --> File2

FolderB --> File3
```

> [!tip]
> Múltiplos servidores podem acessar simultaneamente o mesmo sistema de arquivos compartilhado.

## Protocolos comuns

- NFS
- SMB/CIFS

## Casos de uso

- Compartilhamento de arquivos
- Home directories
- Sistemas legados
- Conteúdo web

## Exemplos

- Amazon EFS
- Azure Files
- Google Filestore

## Vantagens

- Compartilhamento entre servidores
- Estrutura intuitiva
- Compatível com aplicações legadas

## Limitações

- Escalabilidade inferior ao Object Storage
- Pode apresentar gargalos em grandes volumes

## Veja também

- [[Storage]]
- [[Block Storage]]
- [[Object Storage]]