const fs = require('fs');
const path = require('path');
// JSON file sits next to this validator
const filePath = path.join(__dirname, 'sketch-thru-plan-api.json');

function main() {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error('Read error:', e.message);
    process.exit(1);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    process.exit(1);
  }

  const missing = [];
  const invalid = [];
  let refCount = 0;

  function resolve(pointer) {
    if (typeof pointer !== 'string') {
      invalid.push(String(pointer));
      return null;
    }
    if (!pointer.startsWith('#/')) {
      invalid.push(pointer);
      return null;
    }
    const parts = pointer.slice(2).split('/');
    let cur = json;
    for (const part of parts) {
      if (cur && typeof cur === 'object' && part in cur) {
        cur = cur[part];
      } else {
        missing.push(pointer);
        return null;
      }
    }
    return cur;
  }

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const it of node) walk(it);
      return;
    }
    if ('$ref' in node) {
      refCount++;
      resolve(node['$ref']);
    }
    for (const k of Object.keys(node)) {
      walk(node[k]);
    }
  }

  walk(json);

  // Affiliation enum completeness check
  const affiliation = resolve('#/components/schemas/Affiliation');
  const expectedAff = [
    'pending',
    'unknown',
    'assumedfriend',
    'friend',
    'neutral',
    'suspected',
    'hostile',
  ];
  let affOk = false;
  if (affiliation && affiliation.enum && Array.isArray(affiliation.enum)) {
    affOk = expectedAff.every((v) => affiliation.enum.includes(v));
  }

  const result = {
    file: filePath,
    refCount,
    missing,
    invalid,
    affiliationEnumHasAllExpected: affOk,
    affiliationEnum: affiliation && affiliation.enum,
  };

  if (missing.length || invalid.length || !affOk) {
    console.log('Validation FAILED');
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  } else {
    console.log('Validation OK');
    console.log(JSON.stringify(result, null, 2));
  }
}

main();