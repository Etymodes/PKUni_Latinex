import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { brotliDecompressSync } from 'node:zlib';

export function compressedFiles(directory) {
  return { readCompressedFileSync({ filePath, compressionAlgorithm }) {
    assert.equal(compressionAlgorithm, 'br');
    assert.match(filePath, /^data\/[a-z-]+\.br$/);
    const buffer = brotliDecompressSync(fs.readFileSync(path.join(directory, filePath)));
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } };
}
export function loadGenerated(filename, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const wx = { getFileSystemManager: () => compressedFiles(path.dirname(path.dirname(filename))) };
  const require = specifier => {
    assert.match(specifier, /^\.\/[a-z-]+\.js$/, 'Generated code must not depend on Node, TypeScript, or npm.');
    return loadGenerated(path.resolve(path.dirname(filename), specifier), cache);
  };
  vm.runInThisContext(`(function(module,exports,require,wx){\n${fs.readFileSync(filename, 'utf8')}\n})`, { filename })(module,module.exports,require,wx);
  return module.exports;
}
