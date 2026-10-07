import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../app/community-workspace.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\r?$/gm, '').replace(/^export /gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
}).outputText;
const baseTime = Date.parse('2026-10-07T12:00:00.000Z');
const message = (id = 'm1', text = 'Salve, amice!') => ({ id, text, authorName: 'Learner', mine: false, createdAt: new Date(baseTime).toISOString(), detectedLanguage: 'la' });
const room = (messages = []) => ({ messages, warnings: 0, mutedUntil: null, aiAvailable: true });
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, json: async () => body });
function nodes(tree) { return tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flat(Infinity).flatMap(nodes)] : []; }
function content(tree) { return tree == null || tree === false ? '' : typeof tree !== 'object' ? String(tree) : (tree.children || []).flat(Infinity).map(content).join(' '); }

// Execute the actual component, hooks, effects and asynchronous callback closures.
// apiFetch is always a deferred local mock: this file cannot send a real message.
function harness(props = {}) {
  const slots = [], effects = [], calls = [], timers = new Map(), listeners = new Map();
  let cursor = 0, dirty = true, tree, sequence = 0, now = baseTime, mounted = true, staleWrites = 0;
  const current = { language: 'la', languageName: 'Latin', locale: 'en', authenticated: true, channel: 'language', ...props };
  const context = {
    Languages: 'Languages', MessageCircle: 'MessageCircle', Send: 'Send', Users: 'Users',
    CommunityAvatarBadge: 'CommunityAvatarBadge',
    AbortController, Set, console, process: { env: { NEXT_PUBLIC_AUTH_MODE: 'supabase' } },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    crypto: { randomUUID: () => 'attempt-' + (++sequence) },
    document: { hidden: false, addEventListener: (event, callback) => listeners.set(event, callback), removeEventListener: event => listeners.delete(event) },
    window: { confirm: () => true, setInterval: (callback, ms) => { const id = ++sequence; timers.set(id, { callback, ms }); return id; }, clearInterval: id => timers.delete(id) },
    apiFetch(path, options) {
      let resolve, reject;
      const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
      calls.push({ path, options, body: options.body ? JSON.parse(options.body) : undefined, resolve, reject });
      return pending;
    },
    React: { Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => {
        if (!mounted) staleWrites++;
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(slots[index].value, next)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  vm.createContext(context); vm.runInContext(code, context);
  function render() {
    if (!mounted) return tree;
    let passes = 0;
    do {
      dirty = false; cursor = 0; tree = context.CommunityRoom(current);
      while (effects.length) effects.shift()();
      assert(++passes < 15, 'effects settle');
    } while (dirty);
    return tree;
  }
  async function flush() { await new Promise(setImmediate); render(); }
  const find = predicate => nodes(tree).find(predicate);
  const button = label => find(node => node.type === 'button' && content(node).includes(label));
  render();
  return {
    calls, timers, render, flush, context, tree: () => tree, text: () => content(tree), find, button,
    staleWrites: () => staleWrites,
    setDraft(value) { find(node => node.type === 'textarea').props.onChange({ target: { value } }); render(); },
    submit() { find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); },
    click(label) { const node = button(label); assert(node, label); assert(!node.props.disabled); node.props.onClick(); render(); },
    async reply(call, data, status = 200) { call.resolve(response(data, status)); await flush(); },
    async reject(call, error = Error('offline')) { call.reject(error); await flush(); },
    advance(ms) { now += ms; for (const timer of timers.values()) if (timer.ms === 1000) timer.callback(); render(); },
    poll() { for (const timer of timers.values()) if (timer.ms === 10000) timer.callback(); render(); },
    unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('double submit is one request; an unknown network result retries the same client ID and keeps its draft', async () => {
  const h = harness(); await h.reply(h.calls[0], room());
  h.setDraft('Hodie linguam Latinam cum amicis meis disco.');
  const submit = h.find(node => node.type === 'form').props.onSubmit;
  submit({ preventDefault() {} }); submit({ preventDefault() {} }); h.render();
  const first = h.calls[1]; assert.equal(h.calls.length, 2);
  await h.reject(first);
  assert.equal(h.find(node => node.type === 'textarea').props.value, first.body.text);
  h.submit(); const retry = h.calls[2]; assert.equal(retry.body.clientId, first.body.clientId);
  await h.reply(retry, { message: { ...message('sent', first.body.text), mine: true }, warnings: 0, mutedUntil: null }, 201);
  assert.equal(h.find(node => node.type === 'textarea').props.value, '');
  assert.match(h.text(), /Hodie linguam/);
});

test('503 retains the retry ID; an authoritative warning starts a new attempt for the unchanged draft', async () => {
  const h = harness(); await h.reply(h.calls[0], room());
  h.setDraft('This is a long English sentence today.'); h.submit();
  const original = h.calls[1].body.clientId;
  await h.reply(h.calls[1], { error: 'language_check_unavailable' }, 503);
  h.submit(); assert.equal(h.calls[2].body.clientId, original);
  await h.reply(h.calls[2], { error: 'language_warning', warnings: 1, mutedUntil: null }, 422);
  assert.match(h.text(), /Warning 1\/3/);
  h.submit(); assert.notEqual(h.calls[3].body.clientId, original);
});

test('mute expiry allows unchanged draft to become a new attempt, not a replay of old muted response', async () => {
  const h = harness(); await h.reply(h.calls[0], room());
  h.setDraft('This is another long English sentence today.'); h.submit();
  const original = h.calls[1].body.clientId;
  await h.reply(h.calls[1], { error: 'muted', warnings: 4, mutedUntil: new Date(baseTime + 3600000).toISOString() }, 403);
  assert.equal(h.find(node => node.type === 'textarea').props.disabled, true);
  h.advance(3600001);
  assert.equal(h.find(node => node.type === 'textarea').props.disabled, false);
  h.submit(); assert.notEqual(h.calls[2].body.clientId, original);
});

test('an older GET cannot erase a successful POST and queues a fresh GET after it finishes', async () => {
  const h = harness(); await h.reply(h.calls[0], room());
  h.poll(); const oldGet = h.calls[1];
  h.setDraft('A new message'); h.submit(); const post = h.calls[2];
  const sent = { ...message('sent', 'A new message'), mine: true };
  await h.reply(post, { message: sent, warnings: 0, mutedUntil: null }, 201);
  assert.match(h.text(), /A new message/);
  await h.reply(oldGet, room());
  assert.match(h.text(), /A new message/);
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls[3].options.method, 'GET');
  await h.reply(h.calls[3], room([sent]));
  assert.match(h.text(), /A new message/);
});

test('a completed idempotent send whose message was deleted still clears the draft safely', async () => {
  const h = harness(); await h.reply(h.calls[0], room());
  h.setDraft('Previously sent'); h.submit();
  await h.reply(h.calls[1], { message: null, warnings: 0, mutedUntil: null });
  assert.equal(h.find(node => node.type === 'textarea').props.value, '');
  assert.doesNotMatch(h.text(), /request failed/);
});

test('a late English translation is discarded when the room is unmounted for another UI language', async () => {
  const old = harness(); await old.reply(old.calls[0], room([message()]));
  old.click('Translate to English'); const translation = old.calls[1];
  assert.equal(translation.body.locale, 'en');
  old.unmount(); assert.equal(translation.options.signal.aborted, true);
  const fresh = harness({ locale: 'zh-CN' }); await fresh.reply(fresh.calls[0], room([message()]));
  await old.reply(translation, { translation: 'Hello, friend!' });
  assert.equal(old.staleWrites(), 0);
  assert.doesNotMatch(fresh.text(), /Hello, friend!/);
  fresh.click('译为中文'); assert.equal(fresh.calls[1].body.locale, 'zh-CN');
});

test('late translation and send completions cannot write into a newly signed-out room', async () => {
  const old = harness(); await old.reply(old.calls[0], room([message()]));
  old.click('Translate to English'); const translation = old.calls[1];
  old.setDraft('Salve!'); old.submit(); const post = old.calls[2];
  old.unmount();
  const fresh = harness({ authenticated: false }); await fresh.reply(fresh.calls[0], room([message()]));
  await old.reply(translation, { translation: 'Hello!' });
  await old.reply(post, { message: message('old-send'), warnings: 0, mutedUntil: null });
  assert.equal(old.staleWrites(), 0);
  assert.equal(fresh.find(node => node.type === 'textarea').props.disabled, true);
  assert.equal(fresh.button('Translate to English').props.disabled, true);
  assert.doesNotMatch(fresh.text(), /Hello!/);
  assert.equal(fresh.calls.length, 1, 'signed-out room made only its feed read');
});

test('deletion discards an earlier feed snapshot and removes a resolved moderator report', async () => {
  const h = harness({ isAdmin: true }); await h.reply(h.calls[0], room([message()]));
  h.click('Refresh pending reports');
  await h.reply(h.calls[1], { reports: [{ message: message(), reason: 'Needs review' }] });
  h.poll(); const oldGet = h.calls[2];
  h.click('Delete message and resolve report'); const deletion = h.calls[3];
  assert.equal(deletion.options.method, 'DELETE');
  await h.reply(deletion, { ok: true });
  await h.reply(oldGet, room([message()]));
  assert.doesNotMatch(h.text(), /Salve, amice!/);
});

test('anonymous room never sends or translates, and unsupported languages render coming soon without a room', async () => {
  const h = harness({ authenticated: false }); await h.reply(h.calls[0], room([message()]));
  h.setDraft('Test'); h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.button('Translate to English').props.disabled, true);
  const unavailable = h.context.CommunityWorkspace({ language: 'fr', languageName: 'French', locale: 'en', authenticated: false });
  assert.match(content(unavailable), /Coming soon/);
  assert(!nodes(unavailable).some(node => typeof node.type === 'function' && node.type.name === 'CommunityRoom'));
  // The parent uses keys for language, locale and account; component integration
  // keeps a separate room instance across those changes.
  const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let keyText;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'CommunityWorkspace') {
      keyText = node.attributes.properties.find(p => p.name?.text === 'key')?.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(keyText?.includes('language') && keyText.includes('locale') && keyText.includes('session.user'), 'parent remounts for language, locale and account');
});


test('the static mirror renders the official-site link instead of a live room', () => {
  const h = harness({ authenticated: false });
  h.context.process.env.NEXT_PUBLIC_STATIC_PUBLIC = 'true';
  const requestsBefore = h.calls.length;
  const mirror = h.context.CommunityWorkspace({ language: 'la', languageName: 'Latin', locale: 'en', authenticated: false });
  assert.match(content(mirror), /This static mirror does not provide accounts or live chat/);
  assert(nodes(mirror).some(node => node.type === 'a' && node.props.href === 'https://pikku.qzz.io/'));
  assert(!nodes(mirror).some(node => typeof node.type === 'function' && node.type.name === 'CommunityRoom'));
  assert.equal(h.calls.length, requestsBefore);
});
