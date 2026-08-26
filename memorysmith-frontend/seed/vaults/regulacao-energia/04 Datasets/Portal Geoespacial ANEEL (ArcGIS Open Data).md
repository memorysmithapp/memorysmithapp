---
title: Portal Geoespacial ANEEL (ArcGIS Open Data)
aliases:
  - dadosabertos-aneel.opendata.arcgis.com
  - SIG-R
  - Portal geoespacial da ANEEL
tags:
  - aneel
  - geoespacial
  - arcgis
  - bdgd
  - sig-r
  - fonte
type: dataset
maturity: seed
reviewed: false
source: https://dadosabertos-aneel.opendata.arcgis.com/
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: yearly
data_source: https://dadosabertos-aneel.opendata.arcgis.com/search?tags=distribuicao
coverage: não verificado
---

> [!abstract]
> Terceiro repositório de dados da ANEEL, em ArcGIS Hub, onde ficam as camadas georreferenciadas do setor — em particular os Geodatabases da **BDGD** de cada distribuidora, que o portal CKAN apenas referencia por link.

> [!info] Catalogado em 2026-07-27 · Cobertura: não verificada · Cadência: anual (envio da BDGD)

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL |
| Endereço | https://dadosabertos-aneel.opendata.arcgis.com/ |
| Plataforma | ArcGIS Hub / Open Data |
| Descoberto via | Recursos do tipo `link` do conjunto [[Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)]] no CKAN |

### Recursos referenciados a partir do CKAN

| Recurso | URL |
|---|---|
| Repositório dos Geodatabases da BDGD | https://dadosabertos-aneel.opendata.arcgis.com/search?tags=distribuicao |
| Manual de Instruções da BDGD | https://dadosabertos-aneel.opendata.arcgis.com/documents/f0d5c43ac67d4f5eb2ddffa4589501b2/explore |
| Módulo 10 do PRODIST — SIG-R | https://dadosabertos-aneel.opendata.arcgis.com/documents/d1c5d3c76780476f972cd864d930f5fa/explore |

## Como obter

O ArcGIS Hub expõe API própria, distinta da do CKAN:

```bash
# busca no catálogo Hub
curl -s "https://dadosabertos-aneel.opendata.arcgis.com/api/search/v1/collections/dataset/items?q=distribuicao"

# camadas de um serviço ArcGIS REST
curl -s "<feature-service-url>/query?where=1%3D1&outFields=*&f=geojson"
```

Rotina reexecutável: **ainda não escrita.**

## Ressalvas do dado

> [!warning] Ficha aberta a partir de referência, não de inspeção
> Esta nota foi criada porque o CKAN aponta para cá. **O portal não foi inspecionado nesta rodada** — quantidade de camadas, cobertura por distribuidora, ano-base disponível e formato de download não foram verificados. Tudo abaixo do bloco Identificação é premissa.

> [!important] Volume e formato
> A BDGD é entregue em Geodatabase (`.gdb`), por distribuidora e por ano-base. É o conjunto mais pesado do ecossistema ANEEL e o único que exige stack geoespacial (GDAL/OGR, GeoPandas ou ArcGIS). Não cabe em memória por distribuidora grande.

> [!question] Perguntas abertas
> - Quantas distribuidoras e quantos anos-base estão publicados?
> - Há endpoint estável de download por distribuidora, ou o acesso é só pela interface?
> - As entidades do Módulo 10 (SSDMT, SSDBT, UNTRMT, UCAT/UCMT/UCBT, CRVCRG, ENERGIA) estão todas presentes na versão pública?

## Derivados

_Nenhum._

---

Fonte: ANEEL · MOC: [[Dados - Distribuição e Rede]] · Ref: [[Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)]], [[Portal de Dados Abertos ANEEL (CKAN)]]
