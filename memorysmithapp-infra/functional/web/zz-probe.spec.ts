import { test, expect } from './fixtures.js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const pt = JSON.parse(readFileSync(new URL('../../../memorysmithapp-frontend/src/i18n/locales/pt_BR.json', import.meta.url), 'utf8'));
const W = pt.noteEditor as Record<string, string>;
const OUT = process.env['OUT'] ?? '/tmp/probe';

for (const vp of [{ w: 1280, h: 800, n: 'computador' }, { w: 390, h: 844, n: 'telefone' }]) {
test(`sondagem ${vp.n}`, async ({ app, owner, notebook, words }) => {
  test.setTimeout(600_000);
  test.slow();
  const dir = `${OUT}/${vp.n}`; mkdirSync(dir, { recursive: true });
  const report: string[] = []; const errors: string[] = [];
  app.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let n = 0;
  const shot = async (name: string) => { n++; await app.screenshot({ path: `${dir}/${String(n).padStart(2, '0')}-${name}.png` }); };
  const step = async (name: string, fn: () => Promise<string | void>) => {
    try { const note = await fn(); report.push(`OK   ${name}${note ? ' — ' + note : ''}`); }
    catch (e) { report.push(`FAIL ${name} — ${(e as Error).message.split('\n').slice(0, 3).join(' ').slice(0, 300)}`); }
    await shot(name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)).catch(() => {});
  };
  const path = `/knowledge/notebooks/${notebook.notebookId}`;
  const id = randomBytes(2).toString('hex');
  const content = `---\nname: Sonda ${id}\nstatus: rascunho\n---\n\nPrimeira linha.\n\n> [!note] Um callout\n> Dentro dele, segunda linha.\n> Terceira linha do callout.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [ ] uma tarefa\n\n![logo](https://stg.memorysmith.app/symbol-192.png)\n\nUma palavra alvo aqui.\n\nÚltima linha.\n`;
  const { noteId } = await owner.ok<{ noteId: string }>('POST', `${path}/notes`, { folderId: notebook.folderId, content });
  const stored = async () => (await owner.ok<{ content: string }>('GET', `${path}/notes/${noteId}`)).content;
  await app.setViewportSize({ width: vp.w, height: vp.h });
  await app.goto(notebook.page(`/notes/${noteId.toLowerCase()}`));
  const toEdit = app.getByRole('button', { name: words.editNote, exact: true });
  const toRead = app.getByRole('button', { name: words.readNote, exact: true });
  const editor = app.locator('.markdown-editor .cm-content');
  const save = app.locator('.edit-save');
  const saved = () => expect(save).toHaveAttribute('data-save', 'saved', { timeout: 15_000 });
  const caret = () => app.evaluate(() => {
    const s = (globalThis as any).getSelection(); const node = s.anchorNode;
    const el = node?.nodeType === 3 ? node.parentElement : node;
    const line = el?.closest?.('.cm-line'); const cell = el?.closest?.('td,th');
    return `linha="${(line?.textContent ?? (cell ? 'célula:' + cell.textContent : el?.className ?? '?')).slice(0, 50)}" offset=${s.anchorOffset} foco=${(globalThis as any).document.activeElement?.className?.toString().slice(0, 40)}`;
  });
  // the point of a word on the screen
  const pointOf = (word: string) => app.evaluate((w) => {
    const d = (globalThis as any).document;
    const walker = d.createTreeWalker(d.querySelector('.markdown-editor .cm-content'), 4);
    while (walker.nextNode()) { const t = walker.currentNode; const i = t.textContent.indexOf(w); if (i >= 0) { const r = d.createRange(); r.setStart(t, i); r.setEnd(t, i + w.length); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } }
    return null;
  }, word);
  await toEdit.click(); await expect(editor).toBeVisible();

  await step('callout: clicar na 2ª linha põe o cursor nela', async () => {
    const p = await pointOf('segunda'); expect(p).not.toBeNull();
    await app.mouse.click(p!.x, p!.y); await app.waitForTimeout(500);
    const c1 = await caret();
    await app.keyboard.type('X', { delay: 50 }); await saved();
    const line = (await stored()).split('\n').find((l) => l.includes('X'));
    return `depois do clique: ${c1}; X caiu em: ${JSON.stringify(line)}`;
  });
  await step('callout: clicar na 3ª linha (já revelado) põe o cursor nela', async () => {
    const p = await pointOf('Terceira'); expect(p).not.toBeNull();
    await app.mouse.click(p!.x, p!.y); await app.waitForTimeout(300);
    return await caret();
  });
  await step('tabela: clicar numa célula e digitar', async () => {
    await app.keyboard.press('Escape');
    const p = await pointOf('2'); 
    const cell = editor.locator('td').filter({ hasText: /^2$/ }).first();
    await cell.click(); await app.waitForTimeout(400);
    const c1 = await caret();
    await app.keyboard.type('9', { delay: 50 });
    await app.waitForTimeout(2500);
    const s = await stored();
    return `depois do clique: ${c1}; tabela agora: ${JSON.stringify(s.split('\n').filter((l) => l.startsWith('| 1')).join())}; célula na tela="${await cell.innerText().catch(() => '?')}"`;
  });
  await step('tabela: duplo clique na célula e digitar', async () => {
    const cell = editor.locator('td').nth(1);
    await cell.dblclick(); await app.waitForTimeout(400);
    const c1 = await caret();
    await app.keyboard.type('7', { delay: 50 });
    await app.waitForTimeout(2500);
    return `depois do duplo clique: ${c1}; tabela: ${JSON.stringify((await stored()).split('\n').filter((l) => l.startsWith('| 1')).join())}`;
  });
  await step('lista: Enter duas vezes sai da lista e separa o parágrafo', async () => {
    const p = await pointOf('uma tarefa'); await app.mouse.click(p!.x + 40, p!.y); await app.keyboard.press('End');
    await app.keyboard.press('Enter'); await app.keyboard.press('Enter');
    await app.keyboard.type('Depois da lista.', { delay: 30 }); await saved();
    const s = await stored(); const i = s.indexOf('- [ ] uma tarefa');
    return JSON.stringify(s.slice(i, i + 50));
  });
  await step('negrito numa palavra (duplo clique na palavra)', async () => {
    const p = await pointOf('alvo'); await app.mouse.dblclick(p!.x, p!.y); await app.waitForTimeout(200);
    const sel = await app.evaluate(() => String((globalThis as any).getSelection()));
    await app.getByRole('button', { name: W.bold, exact: true }).first().click(); await saved();
    return `seleção="${sel}" → ${JSON.stringify((await stored()).split('\n').find((l) => l.includes('palavra')))}`;
  });
  await step('propriedade: muda o valor', async () => {
    const input = app.locator('.edit-properties input').filter({ hasNot: app.locator('xx') });
    const all = await app.locator('.edit-properties input, .edit-properties [contenteditable]').evaluateAll((els) => els.map((e: any) => `${e.tagName}:${e.value ?? e.textContent}`));
    const v = app.locator('.edit-properties input').nth(1);
    await v.scrollIntoViewIfNeeded(); await v.click(); await v.fill('revisão'); await v.press('Enter'); await saved();
    return `campos=${JSON.stringify(all)} → ${JSON.stringify((await stored()).split('\n').find((l) => l.startsWith('status')))}`;
  });
  await step('tarefa: marcar no editor', async () => {
    const box = editor.locator('input[type=checkbox]').first(); await box.scrollIntoViewIfNeeded(); await box.click(); await saved();
    return JSON.stringify((await stored()).split('\n').find((l) => l.includes('uma tarefa')));
  });
  await step('imagem: largura pelo campo', async () => {
    const img = editor.locator('img').first(); await img.scrollIntoViewIfNeeded(); await img.hover(); await app.waitForTimeout(300);
    const field = app.getByLabel(W.imageWidth).first();
    await field.fill('96'); await field.press('Enter'); await saved();
    return JSON.stringify((await stored()).split('\n').find((l) => l.includes('logo')));
  });
  await step('desfazer pelo botão', async () => {
    await app.getByRole('button', { name: W.undo, exact: true }).first().click(); await saved();
    return JSON.stringify((await stored()).split('\n').find((l) => l.includes('logo')));
  });
  await step('volta para a leitura: sem aviso de alteração', async () => {
    await toRead.click(); await expect(editor).toHaveCount(0); await app.waitForTimeout(4000);
    return `aviso=${await app.getByText(pt.note.changedElsewhere).count()}`;
  });
  await step('reabre na hora e digita: sem conflito', async () => {
    await toEdit.click(); await expect(editor).toBeVisible();
    const p = await pointOf('Última'); await app.mouse.click(p!.x, p!.y); await app.keyboard.press('End');
    await app.keyboard.type(' (de novo)', { delay: 40 }); await saved();
    return `conflito=${await app.getByText(pt.editor.conflictTitle).count()}`;
  });
  await step('sai da nota com salvamento pendente', async () => {
    await app.keyboard.type(' pendente', { delay: 30 });
    await app.goto(notebook.page(''));
    await expect.poll(stored, { timeout: 15_000 }).toContain('Última linha. (de novo) pendente');
  });
  await step('volta à nota: sem aviso', async () => {
    await app.goto(notebook.page(`/notes/${noteId.toLowerCase()}`)); await app.waitForTimeout(4000);
    return `aviso=${await app.getByText(pt.note.changedElsewhere).count()}`;
  });
  await step('histórico', async () => {
    await app.getByRole('button', { name: words.historyButton, exact: true }).click();
    await expect(app.locator('.history-session').first()).toBeVisible({ timeout: 15_000 });
    const c = await app.locator('.history-session').count(); await app.waitForTimeout(500); await shot('historico'); await app.keyboard.press('Escape');
    return `${c} sessões`;
  });
  await step('telefone/computador: canto fixo ao rolar na leitura (diagnóstico)', async () => {
    return await app.evaluate(() => {
      const d = (globalThis as any).document; const c = d.querySelector('.note-corner');
      const out: string[] = [];
      for (let e = c; e; e = e.parentElement) { const s = (globalThis as any).getComputedStyle(e); if (s.overflow !== 'visible' || s.overflowY !== 'visible' || s.position === 'sticky') out.push(`${e.className?.toString().slice(0, 30) || e.tagName}: overflow=${s.overflow}/${s.overflowY} pos=${s.position} top=${s.top} scrollH=${e.scrollHeight} clientH=${e.clientHeight}`); }
      out.push(`scrollingElement scrollTop=${d.scrollingElement.scrollTop}`);
      return out.join(' || ');
    });
  });
  writeFileSync(`${dir}/report.txt`, report.join('\n') + '\n\nERROS:\n' + (errors.join('\n') || '(nenhum)') + '\n\nFINAL:\n' + (await stored()));
  console.log(`\n=== ${vp.n}\n` + report.join('\n') + '\nerros: ' + (errors.join(' | ') || 'nenhum'));
});
}
