---
title: Attachment
aliases:
  - Anexo
  - Arquivo Anexado
tags:
  - obsidian
  - note-taking
  - pkm
  - markdown
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> Um **attachment** é um arquivo em formato aceito que foi **criado fora do vault e adicionado depois** — imagem, áudio, vídeo ou PDF que passa a viver como arquivo comum dentro da pasta do [[Vault]].

## Conceito

A definição do glossário é precisa por exclusão: o que define um attachment não é o tipo do arquivo, mas sua **origem**. Uma nota nasce dentro do vault; um attachment nasce fora e é importado. Uma vez dentro, ele é um arquivo regular, acessível pelo sistema de arquivos como qualquer outro — nada é empacotado, renomeado ou escondido num container proprietário, o que é a expressão concreta do [[Local-first]].

Attachment é o *arquivo*. A referência a ele dentro de uma nota é outra coisa: um [[Embed (Transclusão)|embed]] ou um [[Internal Link (Wikilink)|internal link]]. Um mesmo attachment pode ser referenciado por muitas notas sem ser duplicado.

## Formatos aceitos

| Categoria | Extensões |
|---|---|
| Markdown | `.md` |
| Bases | `.base` |
| JSON Canvas | `.canvas` |
| Imagens | `.avif`, `.bmp`, `.gif`, `.jpeg`, `.jpg`, `.png`, `.svg`, `.webp` |
| Áudio | `.flac`, `.m4a`, `.mp3`, `.ogg`, `.wav`, `.webm`, `.3gp` |
| Vídeo | `.mkv`, `.mov`, `.mp4`, `.ogv`, `.webm` |
| PDF | `.pdf` |

Outros formatos podem ser suportados por community plugins. O suporte a áudio e vídeo depende dos codecs disponíveis no dispositivo.

## Formas de adicionar

- **Colar** o conteúdo direto na nota: o Obsidian cria o arquivo no local padrão de attachments e o embeda
- **Arrastar e soltar** um arquivo do sistema para o editor aberto: o Obsidian copia o arquivo para o local padrão e o embeda
- **Baixar diretamente** para a pasta do vault, por exemplo ao importar do navegador ou de outros apps que salvam no sistema de arquivos

## Default location for new attachments

Por padrão, attachments vão para a raiz do vault. A opção fica em **Settings → Files & Links → Default location for new attachments**:

| Opção | Destino |
|---|---|
| **Vault folder** | Raiz do vault |
| **In the folder specified below** | Uma pasta fixa que você escolhe |
| **Same folder as current file** | A mesma pasta da nota |
| **In subfolder under current folder** | Uma subpasta ao lado da nota; se não existir, o Obsidian a cria |

## Sintaxe de dimensionamento

```markdown
![[Engelbart.jpg|100x145]]     largura x altura
![[Engelbart.jpg|100]]         só largura, mantém a proporção
![[Document.pdf#height=400]]   altura do visualizador de PDF em pixels
![[Document.pdf#page=3]]       abre numa página específica
```

## Comparação

| | Attachment | [[Embed (Transclusão)]] |
|---|---|---|
| Natureza | O arquivo em si | A referência ao arquivo |
| Onde vive | Pasta do vault | Dentro do texto da nota |
| Quantidade | Um por arquivo | Quantas notas quiserem referenciá-lo |
| Apagar remove | O conteúdo | Só a exibição naquela nota |
| Governado por | Default location for new attachments | Sintaxe `![[...]]` |

## Veja também

- [[Embed (Transclusão)]]
- [[Vault]]
- [[Internal Link (Wikilink)]]
- [[Local-first]]
