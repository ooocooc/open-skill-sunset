import os from 'node:os';
import path from 'node:path';

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function redactAbsolutePath(value, homeDirectory = os.homedir()) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) return value;
  const absolute = path.resolve(value);
  const home = path.resolve(homeDirectory);
  if (isInside(home, absolute)) {
    const relative = path.relative(home, absolute).split(path.sep).join('/');
    return relative ? `$HOME/${relative}` : '$HOME';
  }
  return `$ABSOLUTE/${path.basename(absolute)}`;
}
