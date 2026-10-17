import fs from 'fs';
import path from 'path';

/** Components and routes read colours from `useAppTheme()`, never raw literals (spec section 3). */
const ROOTS = [path.join(__dirname, '..'), path.join(__dirname, '..', '..', 'app')];
const RAW_COLOUR = /(['"`])(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\1/;

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : walk(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe('token contract', () => {
  const files = ROOTS.flatMap(walk);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [path.relative(path.join(__dirname, '..', '..'), f), f]))('%s has no raw colour literals', (_name, file) => {
    const offending = fs
      .readFileSync(file as string, 'utf8')
      .split('\n')
      .filter((line) => RAW_COLOUR.test(line));
    expect(offending).toEqual([]);
  });
});
