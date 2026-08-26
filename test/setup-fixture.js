import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('test/fixtures/sample-setup/.agents/skills/large-skill/SKILL.md');
const base = fs.readFileSync(file, 'utf8').split('\n').slice(0, 9).join('\n');
fs.writeFileSync(file, `${base}\n${Array.from({ length: 405 }, (_, index) => `Reference line ${index + 1}.`).join('\n')}\n`);
