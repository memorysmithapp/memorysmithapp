---
title: EV-2-c3-009 · Aba Virtualização de um host
aliases: [EV-2-c3-009]
tags: [evidence, doc, assets, virtualization, vm, uuid]
type: evidence
status: confirmed
source: "SRC-002 · modules/assets/tabs/virtualization.rst · Virtualization"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/assets/tabs/virtualization.rst — "Virtualization"
> A aba `Virtualization` exibe os sistemas de virtualização (máquinas virtuais, contêineres, jails...) associados a um host.
>
> - É possível remontar a VM na aba de ativos ou incluí-la na aba de virtualização do host que a hospeda; a mudança se faz em **Administration > Inventory > Virtualization**.
> - Informações (variam por sistema); para uma VM incluem: Name, Automatic Inventory, Virtualization system, Virtualization model, State, UUID, Processors number, Allocated memory, além do nome da máquina física (o host).
> - GLPI estabelece o vínculo entre host e VM com base no identificador único (**UUID**). Em alguns casos o UUID pode diferir entre a máquina física e a virtual, tornando impossível fazer o vínculo automaticamente. A única forma de vincular manualmente é atribuir o *mesmo* UUID à VM declarada no host e à VM dentro do GLPI.
> - Vários sistemas suportados, incluindo HyperV, VMWare, VirtualBox, WSL, etc.
> - "Add a virtual machine": clicar em **Add a virtual machine** e informar os dados; via **+** pode-se adicionar novo Virtualization system e Virtualization model (geridos em **Setup > Dropdowns > Virtual Machines**). Uma máquina adicionada manualmente terá, por padrão, "automatic inventory: No" — informação que não pode ser modificada.
> - "Delete a virtual machine": clicar na VM (nos ativos ou na aba de virtualização do host), **Put in trashbin**; se a VM era um computador nos ativos, ir à lixeira, marcar a checkbox, **Actions > Delete permanently** (manter ou remover dispositivos conforme necessário). Se a VM ainda está presente no host, será remontada no próximo inventário — é preciso removê-la também do host.
> - Com inventário nativo/terceiro, a informação de virtualização pode ser importada e atualizada automaticamente.
>
> Capturas de tela no doc: `virtualization.png`, `virtualization-import-type.png`, `virtualization-add.png`, `virtualization-manage.png`, `virtualization-delete.png`.

## Sustenta
- [[Aba Virtualização (ativos)]]
- [[Campos de uma Máquina Virtual (ativo)]]
