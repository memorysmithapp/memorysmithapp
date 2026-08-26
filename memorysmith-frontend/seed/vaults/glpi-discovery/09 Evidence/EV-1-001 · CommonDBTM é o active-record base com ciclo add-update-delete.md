---
title: EV-1-001 · CommonDBTM é o active-record base com ciclo add/update/delete
aliases: [EV-1-001]
tags: [evidence, dominio/foundation, orm, ciclo-de-vida]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/CommonDBTM.php · linhas 68, 336, 760, 1286–1405, 1611–2114"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-001 · CommonDBTM é o active-record base com ciclo add/update/delete

Artefato real que sustenta as notas sobre o ORM e o ciclo de vida de itens.

> [!quote] `src/CommonDBTM.php` (declaração da classe, L68)
> ```php
> class CommonDBTM extends CommonGLPI
> {
>     public $fields = [];   // Data fields of the Item
>     public $input  = [];   // Add/Update fields input
>     public $updates = [];  // Updated fields keys
>     public $oldvalues = [];
>     public $dohistory = false;
> }
> ```

> [!quote] Método `add()` — sequência do ciclo de criação (L1286–1405, resumido)
> ```php
> public function add(array $input, $options = [], $history = true) {
>     if ($DB->isSlave()) { return false; }              // grava só no master
>     $this->input = $input;                             // guarda input p/ hooks
>     Plugin::doHook(Hooks::PRE_ITEM_ADD, $this);        // hook pré-preparação
>     $this->input = $this->prepareInputForAdd($this->input); // validação/negócio
>     Plugin::doHook(Hooks::POST_PREPAREADD, $this);     // hook pós-preparação
>     $this->filterValues(!isCommandLine());             // sanitização
>     $this->assetBusinessRules(RuleAsset::ONADD);       // regras de negócio (assets)
>     // copia p/ $this->fields só as chaves que são colunas reais da tabela
>     // (chaves iniciadas por '_' são transitórias, não persistem)
>     // auto date_creation / date_mod
>     if ($this->checkUnicity(true, $options)) {
>         if ($this->addToDB() !== false) {              // INSERT
>             if ($this->dohistory && $history) { Log::history(...); }
>             $this->post_addItem();                     // efeitos colaterais
>             $this->addMessageOnAddAction();
>             // auto-cria Infocom, etc.
>         }
>     }
> }
> ```

Métodos-âncora do ciclo (assinaturas confirmadas por grep no mesmo arquivo):
`getFromDB()` L336 · `addToDB()` L760 · `updateInDB()` L717 · `add()` L1286 ·
`prepareInputForAdd()` L1611 · `post_addItem()` L1622 · `update()` L1638 ·
`prepareInputForUpdate()` L2033 · `post_updateItem()` L2070 · `delete()` L2114 ·
`restore()` L2328 · `checkEntity()` L3136 · `isEntityAssign()` L3213 · `maybeRecursive()` L3227.

## Sustenta
- [[CommonDBTM (Active Record)]]
- [[Ciclo de vida de um item (add-update-delete)]]
- [[Sistema de Plugins (Hooks)]]
