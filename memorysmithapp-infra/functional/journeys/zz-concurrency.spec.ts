import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readConnectorToken } from '../support/connector-state.js';
import { callTool, connectAgent, parsed } from '../support/mcp.js';
import { readState } from '../support/state.js';
import { openAs, writeNotebook, WORDS } from '../web/fixtures.js';

const pt = JSON.parse(readFileSync(new URL('../../../memorysmithapp-frontend/src/i18n/locales/pt_BR.json', import.meta.url), 'utf8'));
const OUT = process.env['OUT'] ?? '/tmp/concurrency';

test('concorrência: pessoa no editor, agente pelo MCP', async ({ page }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const words = WORDS['pt_BR'];
  const state = readState();
  const connector = readConnectorToken();
  const owner = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
  const notebook = await writeNotebook(owner, state);
  const agent = await connectAgent(state.surfaces.mcp, connector.accessToken);
  const report: string[] = [];
  let n = 0;
  const shot = async (name: string) => { n++; await page.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png` }); };
  const step = async (name: string, fn: () => Promise<string | void>) => {
    try { const r = await fn(); report.push(`OK   ${name}${r ? ' — ' + r : ''}`); }
    catch (e) { report.push(`FAIL ${name} — ${(e as Error).message.split('\n').slice(0, 3).join(' ').slice(0, 300)}`); }
    await shot(name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)).catch(() => {});
  };
  const where = { notebook: notebook.notebookId };
  const newNote = async (name: string) => parsed<{ noteId: string; revision: string }>(await callTool(agent, 'create_note', { ...where, folder: notebook.folderId, content: `---\nname: ${name}\n---\n\nTexto inicial.\n` }));
  const agentRead = async (noteId: string) => parsed<{ content: string; revision: string }>(await callTool(agent, 'read_note', { ...where, note: noteId }));
  const agentWrite = async (noteId: string, text: string) => {
    const cur = await agentRead(noteId);
    const a = await callTool(agent, 'update_note', { ...where, note: noteId, content: cur.content.replace('Texto inicial.', `Texto inicial.\n\n${text}`), baseRevision: cur.revision });
    if (a.isError) throw new Error('update_note: ' + a.text);
  };
  const stored = async (noteId: string) => (await agentRead(noteId)).content;
  try {
    await openAs(page, state, state.accounts.owner, 'pt_BR');
    await page.setViewportSize({ width: 1280, height: 800 });
    const toEdit = page.getByRole('button', { name: words.editNote, exact: true });
    const toRead = page.getByRole('button', { name: words.readNote, exact: true });
    const editor = page.locator('.markdown-editor .cm-content');
    const conflict = page.getByText(pt.editor.conflictTitle);
    const elsewhere = page.getByText(pt.note.changedElsewhere);
    const typeAtEnd = async (text: string) => { await editor.click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.type(text, { delay: 40 }); };
    const open = async (noteId: string) => { await page.goto(notebook.page(`/notes/${noteId.toLowerCase()}`)); await expect(toEdit).toBeVisible(); };

    // A: the agent writes while the editor is open; the person's next save finds it.
    const a = await newNote('Concorrência A');
    await open(a.noteId);
    await step('A: pessoa abre o editor; agente escreve pelo MCP; pessoa digita e pausa', async () => {
      await toEdit.click(); await expect(editor).toBeVisible();
      await agentWrite(a.noteId, 'Escrito pelo agente.');
      await typeAtEnd(' Escrito pela pessoa.');
      await expect(conflict).toBeVisible({ timeout: 20_000 });
      await shot('A-aviso');
      return `aviso: "${(await page.getByRole('dialog').innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 220)}"`;
    });
    await step('A: "Salvar mesmo assim" grava a da pessoa e o histórico guarda a do agente', async () => {
      await page.getByRole('button', { name: pt.editor.saveAnyway }).click();
      await expect(page.locator('.edit-save')).toHaveAttribute('data-save', 'saved', { timeout: 15_000 });
      const s = await stored(a.noteId);
      const h = parsed<Array<{ revision: string | null; agentClientId: string | null }>>(await callTool(agent, 'note_history', { ...where, note: a.noteId }));
      expect(s).toContain('Escrito pela pessoa.');
      return `nota agora contém agente=${s.includes('Escrito pelo agente.')} pessoa=${s.includes('Escrito pela pessoa.')}; revisões no histórico=${h.filter((e) => e.revision).length}, do agente=${h.filter((e) => e.agentClientId).length}`;
    });
    await step('A: volta à leitura sem aviso extra', async () => {
      await toRead.click(); await page.waitForTimeout(4000);
      return `aviso "mudou"=${await elsewhere.count()}`;
    });

    // B: the same, but the person discards and reads the agent's version.
    const b = await newNote('Concorrência B');
    await open(b.noteId);
    await step('B: conflito e "Descartar minha edição e recarregar"', async () => {
      await toEdit.click(); await expect(editor).toBeVisible();
      await agentWrite(b.noteId, 'Escrito pelo agente.');
      await typeAtEnd(' Escrito pela pessoa.');
      await expect(conflict).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: pt.editor.reload }).click();
      await page.waitForTimeout(2000);
      const s = await stored(b.noteId);
      const screen = await page.locator('.content-pane').innerText();
      return `gravado: agente=${s.includes('Escrito pelo agente.')} pessoa=${s.includes('Escrito pela pessoa.')}; tela mostra agente=${screen.includes('Escrito pelo agente.')} pessoa=${screen.includes('Escrito pela pessoa.')}`;
    });

    // C: the person only reads; the agent writes; the page says so.
    const c = await newNote('Concorrência C');
    await open(c.noteId);
    await step('C: pessoa só lendo; agente escreve; página avisa e mostra', async () => {
      await agentWrite(c.noteId, 'Escrito pelo agente enquanto a pessoa lia.');
      await expect(page.getByText('Escrito pelo agente enquanto a pessoa lia.')).toBeVisible({ timeout: 45_000 });
      return `aviso "mudou"=${await elsewhere.count()}`;
    });

    // D: the agent writes while a save of the person is in flight (typed, no pause yet).
    const d = await newNote('Concorrência D');
    await open(d.noteId);
    await step('D: pessoa digitando sem pausa; agente escreve no meio; pessoa pausa', async () => {
      await toEdit.click(); await expect(editor).toBeVisible();
      await typeAtEnd(' Primeira parte.');
      await expect(page.locator('.edit-save')).toHaveAttribute('data-save', 'saved', { timeout: 15_000 });
      await editor.click(); await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type(' Segunda', { delay: 40 });
      await agentWrite(d.noteId, 'Escrito pelo agente.');
      await page.keyboard.type(' parte.', { delay: 40 });
      await expect(conflict).toBeVisible({ timeout: 20_000 });
      return 'aviso apareceu';
    });

    // E: the person ticks a box in reading after the agent wrote.
    const e = parsed<{ noteId: string }>(await callTool(agent, 'create_note', { ...where, folder: notebook.folderId, content: `---\nname: Concorrência E\n---\n\nTexto inicial.\n\n- [ ] uma tarefa\n` }));
    await open(e.noteId);
    await step('E: agente escreve; pessoa (sem recarregar) marca a tarefa', async () => {
      await agentWrite(e.noteId, 'Escrito pelo agente.');
      await page.locator('li.task-item', { hasText: 'uma tarefa' }).getByRole('checkbox').check();
      await page.waitForTimeout(5000);
      const s = await stored(e.noteId);
      const status = await page.locator('.write-status').innerText().catch(() => '');
      return `gravado: tarefa marcada=${s.includes('- [x] uma tarefa')} agente preservado=${s.includes('Escrito pelo agente.')}; status="${status.replace(/\s+/g, ' ')}"; aviso "mudou"=${await elsewhere.count()}`;
    });
  } finally {
    await agent.close();
    writeFileSync(`${OUT}/report.txt`, report.join('\n'));
    console.log('\n=== concorrência\n' + report.join('\n'));
  }
});
