import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const foreign = 'This sentence contains seven ordinary English words.';
const reply = (extra = {}) => ({ response: JSON.stringify({ status: 'other', detectedLanguage: 'en', confidence: 'high', nonTargetText: foreign, confirmed: true, couldBeTarget: false, translation: 'A test translation.', ...extra }) });
class Statement {
  constructor(db, sql, values = []) { Object.assign(this, { db, sql, values }); }
  bind(...values) { return new Statement(this.db, this.sql, values); }
  execute() { const s = this.db.prepare(this.sql); return /^\s*(SELECT|PRAGMA)\b/i.test(this.sql) ? { results: s.all(...this.values) } : { results: [], meta: { changes: Number(s.run(...this.values).changes) } }; }
  async run() { return this.execute(); }
  async all() { return this.execute(); }
  async first() { return this.db.prepare(this.sql).get(...this.values) ?? null; }
}
let instance = 0;
async function setup(t, withAi = true) {
  const { default: worker, __test } = await import(`../worker/index.js?community-test=${++instance}`);
  const database = new DatabaseSync(':memory:'); t.after(() => database.close());
  let queue = Promise.resolve(), failure = null;
  const DB = { prepare: sql => new Statement(database, sql), batch(statements) {
    assert(statements.length <= 50); assert(statements.every(s => s.values.length <= 100));
    const job = queue.then(() => { database.exec('BEGIN'); try {
      const results = statements.map(s => { if (failure?.test(s.sql)) { failure = null; throw Error('injected failure'); } return s.execute(); });
      database.exec('COMMIT'); return results;
    } catch (error) { database.exec('ROLLBACK'); throw error; } }); queue = job.catch(() => {}); return job;
  } };
  const env = { DB, SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'test-public', GITHUB_ADMIN_LOGINS: 'admin' };
  if (withAi) env.AI = { run: async () => reply() };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const id = options.headers.authorization.replace('Bearer ', '');
    if (!['alice','bob','admin'].includes(id)) return new Response('Unauthorized', { status: 401 });
    return Response.json({ id, email: `${id}@example.test`, user_metadata: { display_name: id }, app_metadata: { provider: id === 'admin' ? 'github' : 'email' }, identities: id === 'admin' ? [{ provider: 'github', identity_data: { user_name: 'admin' } }] : [] });
  });
  await __test.ensureSchema(env);
  async function request(path = '?language=ja&channel=language', method = 'GET', body, account = 'alice', headers = {}) {
    const response = await worker.fetch(new Request(`https://pikku.qzz.io/api/community${path}`, { method, headers: { ...(account ? { authorization: `Bearer ${account}` } : {}), 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }), env);
    return { status: response.status, body: await response.json() };
  }
  const send = (clientId, changes = {}, account = 'alice') => request('/messages', 'POST', { language: 'ja', channel: 'language', text: foreign, clientId, ...changes }, account);
  return { database, env, request, send, failOn: expression => { failure = expression; } };
}
test('migration and runtime schema agree; word counting handles Japanese and exact boundary', async () => {
  const { communitySchema, communityWordCount } = await import('../worker/community.js');
  const db = new DatabaseSync(':memory:'); try {
    db.exec(await readFile(new URL('../migrations/0007_community.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../migrations/0008_community_profiles.sql', import.meta.url), 'utf8'));
    assert.deepEqual(db.prepare('PRAGMA table_info(community_profiles)').all().map(column => column.name), ['user_id', 'avatar_kind', 'avatar_value', 'updated_at'], 'The standalone migration creates the profile schema before runtime initialization');
    for (const sql of communitySchema) db.exec(sql);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'community_%'").get().n, 9);
  } finally { db.close(); }
  assert.equal(communityWordCount('1 2 3 4 5 6 https://example.test/a/b/c/d/e', 'la'), 0);
  assert.equal(communityWordCount('one two three four five', 'la'), 5);
  assert.equal(communityWordCount('one two three four five six', 'la'), 6);
  assert(communityWordCount('今日は友達と図書館で日本語を勉強しました。', 'ja') > 5);
});
test('anonymous reads are public; forged proxy headers cannot authenticate or impersonate community writes', async t => {
  const { request, send } = await setup(t, false);
  assert.deepEqual((await request('?language=ja&channel=language', 'GET', undefined, null)).body, { messages: [], warnings: 0, mutedUntil: null, aiAvailable: false });
  for (const account of [null, 'invalid']) assert.equal((await request('/messages','POST',{language:'la',channel:'study',text:'Salve!',clientId:'forged'},account,{'oai-authenticated-user-email':'admin@example.test'})).status, 401);
  const posted = await send('actual', { text: 'こんにちは', user_id: 'supabase:bob', authorName: 'forged' });
  assert.equal(posted.status, 201); assert.equal(posted.body.message.authorName, 'alice');
  const row = (await request('?language=ja&channel=language','GET',undefined,null)).body.messages[0];
  assert.equal(row.mine, false); assert(!JSON.stringify(row).includes('supabase:')); assert(!JSON.stringify(row).includes('@example.test'));
  assert.equal((await request(`/messages/${row.id}/translate`,'POST',{locale:'en'},null)).status,401);
});
test('server validates rooms, text, IDs and the five-word exemption; client verdicts cannot bypass checks', async t => {
  const { send, request, database } = await setup(t, false);
  for (const changes of [{language:'fr'},{channel:'general'},{text:''},{text:'a'.repeat(1001)},{text:'a\u0000b'},{clientId:'x y'},{clientId:'x'.repeat(129)},{text:1}]) assert.equal((await send('bad',changes)).status,400);
  assert.equal((await request('/messages','POST','{broken')).status,400);
  assert.equal((await request('/messages','POST',' '.repeat(8193))).status,400);
  assert.equal((await request('?language=fr&channel=study')).status,400);
  assert.equal((await send('five',{language:'la',text:'one two three four five'})).status,201);
  assert.equal((await send('six',{language:'la',text:'one two three four five six',detectedLanguage:'la',verdict:'target'})).status,503);
  assert.equal((await send('study',{channel:'study'})).status,201);
  assert.equal(database.prepare('SELECT count(*) AS n FROM community_requests').get().n,2);
});
test('uncertainty and failed detection never publish or penalize; same ID remains retryable', async t => {
  const {send,request,env}=await setup(t);
  env.AI.run=async()=>reply({status:'uncertain',confidence:'low'});
  assert.equal((await send('retryable')).status,503); assert.equal((await request()).body.warnings,0);
  env.AI.run=async()=>{throw Error('model unavailable');};
  assert.equal((await send('retryable')).status,503); assert.equal((await request()).body.messages.length,0);
  env.AI.run=async()=>reply({status:'target',detectedLanguage:'ja'});
  assert.equal((await send('retryable')).status,201); assert.equal((await request()).body.warnings,0);
});
test('concurrent warnings are exactly once; fourth violation mutes both target rooms, not study; expiry resets',async t=>{
  const {send,request,database,env}=await setup(t); let calls=0; env.AI.run=async()=>{calls++;return reply();}; let now=Date.parse('2026-10-07T10:00:00.000Z'); t.mock.method(Date,'now',()=>now);
  const retries=await Promise.all(Array.from({length:4},()=>send('same'))); assert(retries.some(r=>r.status===422&&r.body.warnings===1)); assert(retries.every(r=>r.status===422||r.status===503));
  assert.equal(calls,2,'Concurrent retries share one classification and one confirmation');
  assert.equal((await send('same')).body.warnings,1); assert.equal(calls,2); assert.equal((await send('same',{text:'changed'})).status,409);
  assert.equal((await send('second',{language:'la'})).body.warnings,2);
  const pair=await Promise.all([send('third'),send('fourth',{language:'la'})]); assert.deepEqual(pair.map(r=>[r.status,r.body.warnings]).sort(),[[403,4],[422,3]]);
  const until=new Date(now+3600000).toISOString(); assert.equal((await request()).body.mutedUntil,until); assert.equal((await request('?language=la&channel=language')).body.mutedUntil,until);
  assert.equal((await send('short',{language:'la',text:'Salve'})).status,403); assert.equal((await send('study',{channel:'study'})).status,201);
  assert.equal((await send('other',{},'bob')).body.warnings,1); assert.equal(database.prepare("SELECT count(*) AS n FROM community_messages WHERE channel='language'").get().n,0);
  now+=3599000; assert.equal((await send('blocked',{text:'短文'})).body.mutedUntil,until); now+=1000;
  const reset=(await request()).body; assert.equal(reset.warnings,0); assert.equal(reset.mutedUntil,null); assert.equal((await send('cycle')).body.warnings,1);
});
test('concurrent publication and same-ID conflicts preserve exactly one canonical message',async t=>{
  const {send,database}=await setup(t,false);
  const posts=await Promise.all(Array.from({length:4},()=>send('same',{text:'こんにちは'}))); assert.deepEqual(posts.map(r=>r.status).sort(),[200,200,200,201]); assert.equal(new Set(posts.map(r=>r.body.message.id)).size,1);
  const pair=await Promise.all([send('conflict',{text:'Salve'}),send('conflict',{text:'こんにちは'})]); assert.deepEqual(pair.map(r=>r.status).sort(),[201,409]); assert.equal(database.prepare('SELECT count(*) AS n FROM community_messages').get().n,2);
});
test('database failure rolls back warning and idempotency marker as one transaction',async t=>{
  const {send,request,database,failOn}=await setup(t); failOn(/INSERT OR IGNORE INTO community_messages/);
  assert.equal((await send('rollback')).status,503); assert.equal((await request()).body.warnings,0); assert.equal(database.prepare('SELECT count(*) AS n FROM community_requests').get().n,0); assert.equal((await send('rollback')).body.warnings,1);
});
test('per-account rate limits survive concurrency and completed retries do not consume allowance',async t=>{
  const {send,request}=await setup(t,false); let now=Date.parse('2026-10-07T10:00:00.000Z'); t.mock.method(Date,'now',()=>now);
  const results=await Promise.all(Array.from({length:25},(_,i)=>send(`rate-${i}`,{text:'Salve'}))); assert.equal(results.filter(r=>r.status===201).length,20); assert.equal(results.filter(r=>r.status===429).length,5);
  assert.equal((await send('rate-0',{text:'Salve'})).status,200); assert.equal((await send('bob',{text:'Salve'},'bob')).status,201); now+=60000; assert.equal((await send('reset',{text:'Salve'})).status,201); assert.equal((await request()).body.messages.length,22);
});
test('read feed isolates rooms and returns latest 50 in chronological order',async t=>{
  const {database,request}=await setup(t,false); const insert=database.prepare('INSERT INTO community_messages(id,user_id,author_name,language,channel,text,created_at) VALUES(?,?,?,?,?,?,?)');
  for(let i=0;i<60;i++)insert.run(`row-${i}`,'supabase:alice','alice','ja','study',`Message ${i}`,1000+i); insert.run('other','supabase:alice','alice','la','study','Other',2000);
  const rows=(await request('?language=ja&channel=study')).body.messages; assert.equal(rows.length,50); assert.equal(rows[0].text,'Message 10'); assert.equal(rows.at(-1).text,'Message 59'); assert(rows.every(r=>r.mine&&r.createdAt.endsWith('Z')));
});
test('translation cache is per message and locale; authors/admins can delete and reports are deduplicated',async t=>{
  const {send,request,env,database}=await setup(t); let calls=0; env.AI.run=async()=>{calls++;return reply();};
  const id=(await send('manage',{text:'Salve'})).body.message.id; const path=`/messages/${id}`;
  assert.equal((await request(`${path}/translate`,'POST',{locale:'fr'})).status,400); assert.equal((await request(`${path}/translate`,'POST',{locale:'en'})).body.translation,'A test translation.'); assert.equal((await request(`${path}/translate`,'POST',{locale:'en'},'bob')).status,200); assert.equal(calls,1);
  assert.equal((await request(`${path}/translate`,'POST',{locale:'zh-CN'})).status,200); assert.equal(calls,2); assert.equal((await request(path,'DELETE',undefined,'bob')).status,403);
  for(let i=0;i<2;i++)assert.equal((await request(`${path}/report`,'POST',{reason:'spam'},'bob')).status,200); assert.equal(database.prepare('SELECT count(*) AS n FROM community_reports').get().n,1);
  assert.equal((await request('/reports','GET',undefined,'bob')).status,403); assert.equal((await request('/reports','GET',undefined,'admin')).body.reports.length,1); assert.equal((await request(path,'DELETE',undefined,'admin')).status,200);
  assert.equal((await request()).body.messages.length,0); assert.equal((await request(`${path}/translate`,'POST',{locale:'en'})).status,404); assert.equal((await request('/reports','GET',undefined,'admin')).body.reports.length,0);
  const own=(await send('own',{text:'Salve'})).body.message.id; assert.equal((await request(`/messages/${own}`,'DELETE')).status,200);
});

test('global UTC daily AI cap is atomic across accounts; a half-finished classification never penalizes',async t=>{
  const {send,request,database,env}=await setup(t); let now=Date.parse('2026-10-07T10:00:00.000Z'); t.mock.method(Date,'now',()=>now);
  let calls=0; env.AI.run=async()=>{calls++;return reply();};
  database.prepare('INSERT INTO community_ai_usage(day,count) VALUES(?,?)').run('2026-10-07',999);
  const denied=await send('half'); assert.equal(denied.status,503); assert.equal((await request()).body.warnings,0); assert.equal(calls,1);
  assert.equal(database.prepare('SELECT count FROM community_ai_usage WHERE day=?').get('2026-10-07').count,1000);
  assert.equal((await send('another',{},'bob')).status,503); assert.equal(calls,1);
  now+=86400000; assert.equal((await send('half')).status,422); assert.equal(calls,3);
  assert.equal((await send('half')).body.warnings,1); assert.equal(calls,3,'Completed idempotent warning retry must not spend AI calls');
  database.prepare('UPDATE community_ai_usage SET count=998 WHERE day=?').run('2026-10-08');
  env.AI.run=async()=>{calls++;return reply({status:'target',detectedLanguage:'ja'});};
  const results=await Promise.all(Array.from({length:6},(_,i)=>send(`global-${i}`,{},i%2?'bob':'alice')));
  assert.equal(results.filter(r=>r.status===201).length,2); assert.equal(results.filter(r=>r.status===503).length,4); assert.equal(calls,5);
  assert.equal(database.prepare('SELECT count FROM community_ai_usage WHERE day=?').get('2026-10-08').count,1000);
});
test('concurrent translation requests share one inference and cached translations still work at the global cap',async t=>{
  const {send,request,database,env}=await setup(t); const now=Date.parse('2026-10-07T10:00:00.000Z'); t.mock.method(Date,'now',()=>now);
  let calls=0; env.AI.run=async()=>{calls++;return reply();};
  const id=(await send('translate-lock',{text:'Salve'})).body.message.id; const path=`/messages/${id}/translate`;
  const results=await Promise.all(['alice','bob','admin'].map(account=>request(path,'POST',{locale:'en'},account)));
  assert(results.some(r=>r.status===200)); assert(results.every(r=>r.status===200||(r.status===503&&r.body.error==='request_pending'))); assert.equal(calls,1);
  database.prepare('UPDATE community_ai_usage SET count=1000 WHERE day=?').run('2026-10-07');
  assert.equal((await request(path,'POST',{locale:'en'},'bob')).status,200); assert.equal(calls,1);
  assert.equal((await request(path,'POST',{locale:'zh-CN'})).status,503); assert.equal(calls,1);
});


test('avatar shared validator accepts only exact ASCII initials or the twelve named presets', async () => {
  const { communityAvatarPresets, defaultCommunityAvatar, isCommunityAvatar, normalizeCommunityAvatar, communityAvatarText } = await import('../lib/community-avatar.ts');
  assert.equal(communityAvatarPresets.length, 12);
  assert.equal(new Set(communityAvatarPresets.map(item => item.id)).size, 12);
  assert.deepEqual(defaultCommunityAvatar, { kind: 'preset', value: 'cat' });
  for (const value of ['A', 'Z', 'AB', 'XY', 'Aa', 'Ab', 'Abc', 'Zzz']) {
    assert(isCommunityAvatar({ kind: 'initials', value }), value);
    assert.equal(communityAvatarText({ kind: 'initials', value }), value);
  }
  for (const preset of communityAvatarPresets) {
    assert(preset.zh && preset.en && preset.emoji);
    assert(isCommunityAvatar({ kind: 'preset', value: preset.id }));
    assert.equal(communityAvatarText({ kind: 'preset', value: preset.id }), preset.emoji);
  }
  for (const value of ['', 'a', 'ab', 'abc', 'ABC', 'ABc', 'aB', 'AaaB', 'Abcd', ' A', 'A ', 'A\n', 'AB\r\n', 'A\u2028', 'A\u200b', 'Ａ', 'Ä', '猫', '🐱', 'A1', 'A_', 'https://example.test/a.png']) {
    assert.equal(isCommunityAvatar({ kind: 'initials', value }), false, JSON.stringify(value));
  }
  for (const value of [null, [], {}, { kind: 'url', value: 'https://example.test/a.png' }, { kind: 'preset', value: 'Cat' }, { kind: 'preset', value: 'toString' }, { kind: 'preset', value: '🐱' }, { kind: 'preset', value: 'cat', url: 'https://example.test/a.png' }, { kind: 'initials', value: 12 }, { value: 'A', other: true }]) {
    assert.equal(isCommunityAvatar(value), false);
    assert.deepEqual(normalizeCommunityAvatar(value), defaultCommunityAvatar);
    assert.equal(communityAvatarText(value), '🐱');
  }
  const fallback = normalizeCommunityAvatar(null); fallback.value = 'dog';
  assert.deepEqual(normalizeCommunityAvatar(null), { kind: 'preset', value: 'cat' }, 'Fallback values do not share mutable returned state');
});

test('avatar profiles require verified login and PUT only affects the authenticated account', async t => {
  const { request, database } = await setup(t, false);
  for (const account of [null, 'invalid']) for (const method of ['GET', 'PUT']) {
    assert.equal((await request('/profile', method, method === 'PUT' ? { avatar: { kind: 'initials', value: 'AB' } } : undefined, account, { 'oai-authenticated-user-email': 'alice@example.test' })).status, 401);
  }
  assert.equal(database.prepare('SELECT count(*) AS n FROM community_profiles').get().n, 0);
  assert.deepEqual((await request('/profile')).body, { avatar: { kind: 'preset', value: 'cat' } });
  assert.equal(database.prepare('SELECT count(*) AS n FROM community_profiles').get().n, 0, 'Reading the default does not create a profile');
  assert.deepEqual((await request('/profile','PUT',{ avatar: { kind: 'initials', value: 'AB' }, userId: 'supabase:bob', user_id: 'supabase:bob' })).body, { avatar: { kind: 'initials', value: 'AB' } });
  assert.deepEqual((await request('/profile','GET',undefined,'bob')).body.avatar, { kind: 'preset', value: 'cat' });
  assert.equal((await request('/profile','PUT',{ avatar: { kind: 'preset', value: 'fox' } },'bob',{ 'oai-authenticated-user-email': 'alice@example.test' })).status,200);
  assert.deepEqual((await request('/profile')).body.avatar, { kind: 'initials', value: 'AB' });
  assert.deepEqual((await request('/profile','GET',undefined,'bob')).body.avatar, { kind: 'preset', value: 'fox' });
  assert.equal(database.prepare('SELECT count(*) AS n FROM community_profiles').get().n, 2);
});

test('invalid avatar writes are rejected without changing saved profile, warnings or learning records', async t => {
  const { request, database } = await setup(t, false);
  await request('/profile','PUT',{ avatar: { kind: 'initials', value: 'Abc' } });
  database.prepare('INSERT INTO community_state(user_id,warnings,muted_until) VALUES(?,?,?)').run('supabase:alice',4,Date.now()+3600000);
  database.prepare('INSERT INTO vocab_stats_by_language(user_email,language,lemma,seen,correct) VALUES(?,?,?,?,?)').run('supabase:alice','ja','猫',7,3);
  const before = database.prepare('SELECT * FROM community_profiles').get();
  const invalid = [null, [], {}, { kind: 'preset', value: 'unknown' }, { kind: 'preset', value: 'https://example.test/a.png' }, { kind: 'image', value: 'cat' }, { kind: 'initials', value: 'ABC' }, { kind: 'initials', value: 'A\n' }, { kind: 'initials', value: 'Ａ' }, { kind: 'initials', value: 'A', url: 'data:image/png;base64,AA' }];
  for (const avatar of invalid) { const result = await request('/profile','PUT',{avatar}); assert.equal(result.status,400); assert.equal(result.body.error,'invalid_avatar'); }
  assert.equal((await request('/profile','PUT','{broken')).status,400);
  assert.deepEqual(database.prepare('SELECT * FROM community_profiles').get(), before);
  assert.equal((await request('/profile','PUT',{avatar:{kind:'preset',value:'panda'}})).status,200, 'An existing chat mute does not prohibit avatar changes');
  assert.equal(database.prepare('SELECT warnings FROM community_state WHERE user_id=?').get('supabase:alice').warnings,4);
  assert.deepEqual({ ...database.prepare('SELECT seen,correct FROM vocab_stats_by_language WHERE user_email=?').get('supabase:alice') },{seen:7,correct:3});
});

test('historical public messages, idempotent receipts and reports all show the current author avatar', async t => {
  const { request, send, database } = await setup(t, false);
  const first = await send('avatar-post',{text:'Salve'});
  const id = first.body.message.id;
  assert.deepEqual(first.body.message.avatar,{kind:'preset',value:'cat'});
  const bob = await send('bob-post',{text:'こんにちは'},'bob');
  const original = database.prepare('SELECT * FROM community_messages WHERE id=?').get(id);
  await request(`/messages/${id}/report`,'POST',{reason:'Review'},'bob');
  await request('/profile','PUT',{avatar:{kind:'initials',value:'Ab'}});
  let rows = (await request('?language=ja&channel=language','GET',undefined,null)).body.messages;
  assert.deepEqual(rows.find(row=>row.id===id).avatar,{kind:'initials',value:'Ab'});
  assert.deepEqual(rows.find(row=>row.id===bob.body.message.id).avatar,{kind:'preset',value:'cat'});
  assert(!JSON.stringify(rows).includes('supabase:')); assert(!JSON.stringify(rows).includes('@example.test'));
  assert.deepEqual((await send('avatar-post',{text:'Salve'})).body.message.avatar,{kind:'initials',value:'Ab'});
  assert.deepEqual((await request('/reports','GET',undefined,'admin')).body.reports[0].message.avatar,{kind:'initials',value:'Ab'});
  await request('/profile','PUT',{avatar:{kind:'preset',value:'grapes'}});
  rows=(await request()).body.messages;
  assert.deepEqual(rows.find(row=>row.id===id).avatar,{kind:'preset',value:'grapes'});
  assert.deepEqual(database.prepare('SELECT * FROM community_messages WHERE id=?').get(id),original,'Changing a profile never rewrites message identity or content');
  database.prepare("UPDATE community_profiles SET avatar_value='https://invalid.test/a' WHERE user_id=?").run('supabase:alice');
  assert.deepEqual((await request('/profile')).body.avatar,{kind:'preset',value:'cat'},'Unexpected stored values are never surfaced as external URLs');
  assert.deepEqual((await request()).body.messages.find(row=>row.id===id).avatar,{kind:'preset',value:'cat'});
});
