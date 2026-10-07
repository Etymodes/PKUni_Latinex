#!/usr/bin/env node
// Fixed public synthetic examples only. Never calls a community/chat endpoint.
// Default is MOCK transport verification, not a real model capability test.
// Live usage: node scripts/community-ai-smoke.mjs --live
// Required env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
// CLOUDFLARE_D1_DATABASE_ID (existing Pikku DB; migration 0007 must be applied).
// Optional server model: COMMUNITY_AI_MODEL. Token needs Workers AI and D1 access.
// Every live inference uses the production adapter's global daily budget table.
import { pathToFileURL } from 'node:url';
import { classifyCommunityText, translateCommunityText } from '../worker/community-ai.js';
import { communityWordCount } from '../worker/community.js';

export const syntheticCommunityCases = Object.freeze([
  { id: 'latin-macrons', kind: 'classify', language: 'la', text: 'Hodiē cum amīcīs meīs in bibliothēcā linguam Latīnam discō.', expected: ['target'], source: 'la' },
  { id: 'latin-plain', kind: 'classify', language: 'la', text: 'Discipuli hodie in bibliotheca linguam Latinam discunt.', expected: ['target'], source: 'la' },
  { id: 'latin-channel-english', kind: 'classify', language: 'la', text: 'Today I want to study this language with my friends.', expected: ['other'], source: 'en' },
  { id: 'latin-channel-french', kind: 'classify', language: 'la', text: 'Je voudrais apprendre cette langue avec mes amis demain.', expected: ['other'], source: 'fr' },
  { id: 'latin-channel-spanish', kind: 'classify', language: 'la', text: 'Hoy quiero estudiar este idioma con mis amigos en la biblioteca.', expected: ['other'], source: 'es' },
  { id: 'latin-channel-portuguese', kind: 'classify', language: 'la', text: 'Hoje quero estudar esta língua com os meus amigos na biblioteca.', expected: ['other'], source: 'pt' },
  { id: 'japanese-target', kind: 'classify', language: 'ja', text: '今日は友達と一緒に図書館で日本語を勉強します。', expected: ['target'], source: 'ja' },
  { id: 'japanese-channel-chinese', kind: 'classify', language: 'ja', text: '今天我想和朋友一起去图书馆学习日语，然后回家吃晚饭。', expected: ['other'], source: 'zh' },
  { id: 'japanese-borrowed-word', kind: 'classify', language: 'ja', text: '今日は図書館で computer という英語の単語を友達と覚えました。', expected: ['target'], source: 'ja' },
  { id: 'han-only-ambiguous', kind: 'classify', language: 'ja', text: '東京 大阪 京都 名古屋 神戸 奈良 横浜', expected: ['target', 'uncertain'], source: 'ja', mockStatus: 'uncertain' },
  { id: 'ambiguous-latin-word-list', kind: 'classify', language: 'la', text: 'Roma opera vita forma natura cultura', expected: ['target', 'uncertain'], source: 'la', mockStatus: 'uncertain' },
  { id: 'short-five-words', kind: 'classify', language: 'la', text: 'Please read this book now.', expected: ['exempt'], source: 'en' },
  { id: 'short-han-fragment', kind: 'classify', language: 'ja', text: '本日休業', expected: ['exempt'], source: 'ja' },
  { id: 'english-to-chinese', kind: 'translate', locale: 'zh-CN', text: 'Tomorrow we will meet at the station at three in the afternoon.', source: 'en', reference: '明天下午三点我们在车站见面。' },
  { id: 'chinese-to-english', kind: 'translate', locale: 'en', text: '明天下午三点我们在车站见面。', source: 'zh', reference: 'Tomorrow we will meet at the station at three in the afternoon.' },
  { id: 'latin-to-english', kind: 'translate', locale: 'en', text: 'Discipuli hodie in bibliotheca linguam Latinam discunt.', source: 'la', reference: 'The students are studying Latin in the library today.' },
  { id: 'latin-to-chinese', kind: 'translate', locale: 'zh-CN', text: 'Discipuli hodie in bibliotheca linguam Latinam discunt.', source: 'la', reference: '学生们今天在图书馆学习拉丁语。' },
  { id: 'japanese-to-english', kind: 'translate', locale: 'en', text: '今日は友達と一緒に図書館で日本語を勉強します。', source: 'ja', reference: 'Today I will study Japanese in the library with my friends.' },
]);

export async function runCommunityAiDiagnostics(env, { mode = 'LIVE', onResult = () => {} } = {}) {
  const results = [];
  for (const sample of syntheticCommunityCases) {
    env.currentSyntheticCase = sample;
    let result;
    try {
      if (sample.kind === 'classify') {
        const observed = communityWordCount(sample.text, sample.language) <= 5
          ? { status: 'exempt', detectedLanguage: null }
          : await classifyCommunityText(env, sample);
        const statusMatches = sample.expected.includes(observed.status);
        const languageMatches = !['target', 'other'].includes(observed.status) || observed.detectedLanguage === sample.source;
        result = { id: sample.id, expected: sample.expected, observed, pass: statusMatches && languageMatches };
      } else {
        const observed = await translateCommunityText(env, { ...sample, detectedLanguage: sample.source });
        result = { id: sample.id, observed, reference: sample.reference,
          pass: observed.detectedLanguage === sample.source && Boolean(observed.translation),
          requiresHumanMeaningReview: mode === 'LIVE' };
      }
    } catch {
      result = { id: sample.id, pass: false, unavailable: true };
    }
    results.push(result);
    onResult(result);
  }
  return { mode, syntheticCases: results.length, passedChecks: results.filter(row => row.pass).length,
    modelQualityVerified: false,
    note: mode === 'MOCK' ? 'MOCK only: no model was called and no accuracy was measured.'
      : 'LIVE synthetic sample only. Translation meanings require human review; this is not broad Latin support or production accuracy certification.',
    results };
}

function mockEnvironment() {
  let count = 0;
  const env = {
    DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: ++count <= 1000 ? 1 : 0 } }) }) }) },
    AI: { run: async (_model, parameters) => {
      const sample = env.currentSyntheticCase, input = JSON.parse(parameters.messages[1].content);
      let data;
      if (sample.kind === 'translate') data = { translation: sample.reference, detectedLanguage: sample.source, confidence: 'high' };
      else if (input.excerpt) data = { confirmed: true, couldBeTarget: false, detectedLanguage: sample.source, confidence: 'high' };
      else {
        const status = sample.mockStatus || sample.expected[0];
        data = { status, detectedLanguage: status === 'uncertain' ? null : sample.source,
          confidence: status === 'uncertain' ? 'low' : 'high', nonTargetText: status === 'other' ? sample.text : '' };
      }
      return { response: JSON.stringify(data) };
    } },
  };
  return env;
}

function liveEnvironment() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const database = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!token || !/^[a-f0-9]{32}$/i.test(account || '') || !/^[a-f0-9-]{36}$/i.test(database || '')) {
    throw new Error('Live diagnostic not run: set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_D1_DATABASE_ID explicitly. No credential discovery or temporary account is used.');
  }
  let calls = 0;
  async function cloudflare(path, body) {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + path, {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Cloudflare diagnostic request unavailable');
    const data = await response.json();
    if (data.success !== true) throw new Error('Cloudflare diagnostic request unavailable');
    return data.result;
  }
  return {
    COMMUNITY_AI_MODEL: process.env.COMMUNITY_AI_MODEL,
    DB: { prepare: sql => ({ bind: (...params) => ({ run: async () => {
      const result = await cloudflare('/d1/database/' + database + '/query', { sql, params });
      if (!Array.isArray(result) || result[0]?.success === false) throw new Error('Diagnostic budget unavailable');
      return result[0];
    } }) }) },
    AI: { run: async (model, parameters) => {
      if (++calls > 30) throw new Error('Synthetic diagnostic call limit reached');
      return cloudflare('/ai/run/' + model, parameters);
    } },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), live = args.includes('--live');
  if (args.some(arg => !['--live', '--mock'].includes(arg)) || (live && args.includes('--mock'))) {
    console.error('Usage: node scripts/community-ai-smoke.mjs [--mock | --live]');
    process.exitCode = 2;
  } else {
    try {
      const mode = live ? 'LIVE' : 'MOCK';
      console.log(mode === 'MOCK' ? 'MOCK ONLY — transport/fixture checks; no real model or accuracy claim.' : 'LIVE — fixed public synthetic text only; reserves the existing D1 global AI budget.');
      const report = await runCommunityAiDiagnostics(live ? liveEnvironment() : mockEnvironment(), {
        mode, onResult: row => console.log(JSON.stringify(row)),
      });
      console.log(JSON.stringify({ ...report, results: undefined }));
      if (report.passedChecks !== report.syntheticCases) process.exitCode = 1;
    } catch (error) {
      // All errors here are locally authored; never print provider bodies or env.
      console.error(error.message);
      process.exitCode = 2;
    }
  }
}
