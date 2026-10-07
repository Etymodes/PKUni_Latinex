# Bilingual learning content

Pikku 1.1.0 shares one canonical question bank and vocabulary bank across the website and WeChat mini program. `lib/content-locale.ts` projects instructional text into English using the `data/content-en-*.json` maps and the French/Arabic starter map. Simplified Chinese uses the canonical copy.

Translate new instructions, explanations, distractor explanations, Chinese gloss options, meanings, parts of speech, usage notes, paired reading/sense glosses and resource descriptions at import time. Preserve target-language passages, readings, transcripts, quotations and original question numbering. Official dictionary names and URLs retain their identity; public dictionary references still use the existing major-dictionary filter. Imported file/exam provenance remains internal to word cards.

Never localize identifiers, canonical lemmas, answer indices or stored review events. Locale switches must not reset answer ordering, drafts, revealed state or pre-feedback prediction evidence. English and Chinese searches index the same canonical records. Question copy is isolated from vocabulary glosses to avoid translating a Japanese option merely because its spelling matches a Chinese meaning.

The mini build uses native WeChat Brotli decoding (base library 2.21.1+) for lossless UTF-16LE JSON. It does not execute data or download code. The complete reconstructed bank and English projections are compared to source in tests, and the build fails at the 2 MiB main-package limit.

Run `node --test tests/*.test.mjs scripts/i18n.test.mjs`, TypeScript, production web build and `node scripts/build-wechat.mjs` before release. Check both UI languages interactively, including question submission, word reveal, same-word dictionary navigation, the three feedback states, locale changes during practice, and RTL target text. Do not describe simulator checks as phone or real-account cross-device verification.

French and Modern Standard Arabic begin with 24 questions and 16 words each. Content spans C/F/G, with no dedicated M questions yet. Recognition tasks do not certify complete communicative competence. The English interface and Chinese interface share the same learning records.
