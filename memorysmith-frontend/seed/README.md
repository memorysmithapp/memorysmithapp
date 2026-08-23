# Seed de vaults do frontend

Três vaults reais, traduzidos dos experimentos de gestão de conhecimento que originaram o MemorySmith.app, no **formato de export do produto** (`docs/software-vision.md` §12): prefixo numérico codifica a ordem das pastas, `README.md` faz o papel de Guidance na raiz do vault e de descrição dentro de cada pasta, `TEMPLATE.md` faz o papel de Template da pasta, e as notas são copiadas byte a byte, com frontmatter e wikilinks intactos (PP4).

| Vault | Conteúdo | Notas |
|---|---|---|
| `engineering-knowledge` | Base de estudo de engenharia de software: literatura, conceitos e práticas atômicas, MOCs e projetos | ~573 |
| `regulacao-energia` | Regulação do setor elétrico brasileiro: normas, conceitos, fichas de dados abertos e o grafo de contexto (indicadores, séries, insights) | ~166 |
| `glpi-discovery` | Descoberta do GLPI 11 por engenharia reversa e documentação oficial, com contrato de evidência e investigações | ~758 |

## Layout

- `authoring/`: os textos autorais da tradução, por vault: `guidance.md` (vira o `README.md` da raiz) e `templates/*.md` (viram os `TEMPLATE.md` das pastas).
- `tools/build-seed.mjs`: o tradutor. Lê os vaults de origem na máquina do autor, aplica o mapeamento de pastas e gera a saída. Os vaults de origem **não** fazem parte do repositório; o artefato commitado é a saída.
- `vaults/`: a saída gerada, consumida pela camada de dados mockada do frontend. Não editar à mão: alterações se fazem em `authoring/` ou na origem, seguidas de regeração.

## Regerar

```
node memorysmith-frontend/seed/tools/build-seed.mjs
```

O script valida os limites do produto (2.000 notas e 200 pastas por vault, profundidade 6, descrição de pasta entre 1 e 500 caracteres), detecta colisão de slug de nota dentro do vault e reporta avisos ao final.
