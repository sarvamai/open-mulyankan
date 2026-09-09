#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { recoverStructuredOutput, extractObject } = require('./lib/json-utils');

const logPath = process.argv[2];
const outPath = process.argv[3] || '/tmp/native-review.txt';

if (!logPath || !fs.existsSync(logPath)) {
  process.exit(1);
}

const log = fs.readFileSync(logPath, 'utf8');
const sources = [
  log,
  fs.existsSync('/tmp/native-review-stdout.txt')
    ? fs.readFileSync('/tmp/native-review-stdout.txt', 'utf8')
    : '',
].filter(Boolean);

for (const src of sources) {
  const recovered =
    recoverStructuredOutput(src, { requiredKeys: ['findings'] }) ||
    recoverStructuredOutput(src, { requiredKeys: ['summary'] });
  if (recovered) {
    fs.writeFileSync(outPath, recovered);
    console.log(`Recovered ${Buffer.byteLength(recovered, 'utf8')} bytes to ${outPath}`);
    process.exit(0);
  }
}

// Last resort: grab largest JSON blob with findings key
const idx = log.lastIndexOf('"findings"');
if (idx !== -1) {
  const start = log.lastIndexOf('{', idx);
  if (start !== -1) {
    const obj = extractObject(log.slice(start));
    if (obj && Array.isArray(obj.findings)) {
      fs.writeFileSync(outPath, JSON.stringify(obj));
      console.log('Recovered findings JSON from log slice');
      process.exit(0);
    }
  }
}

process.exit(1);
