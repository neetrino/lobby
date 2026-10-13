import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiSource = path.join(root, 'apps', 'api', 'src');
const modulesRoot = path.join(apiSource, 'modules');
const importPattern = /(?:from\s+|import\s*(?:\(\s*)?)(['"])([^'"]+)\1/g;
const violations = [];

for (const sourceFile of sourceFiles(apiSource)) {
  if (isTestFile(sourceFile)) {
    continue;
  }
  const sourceModule = owningModule(sourceFile);
  const source = readFileSync(sourceFile, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[2];
    if (!specifier.startsWith('.')) {
      continue;
    }
    const target = path.resolve(path.dirname(sourceFile), specifier);
    const targetModule = owningModule(target);
    if (
      targetModule === undefined ||
      targetModule === sourceModule ||
      isModuleRootEntry(target, targetModule)
    ) {
      continue;
    }
    violations.push(`${relative(sourceFile)} imports private module path ${specifier}`);
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Module boundary violations:\n${violations.map((item) => `- ${item}`).join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write('Module boundaries are valid.\n');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const candidate = path.join(directory, entry);
    return statSync(candidate).isDirectory()
      ? sourceFiles(candidate)
      : /\.(?:ts|tsx)$/.test(entry)
        ? [candidate]
        : [];
  });
}

function owningModule(file) {
  const relativePath = path.relative(modulesRoot, file);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return undefined;
  }
  return relativePath.split(path.sep)[0];
}

function isModuleRootEntry(target, moduleName) {
  const moduleRoot = path.join(modulesRoot, moduleName);
  const normalized = path.normalize(target);
  return normalized === moduleRoot || normalized === path.join(moduleRoot, 'index');
}

function isTestFile(file) {
  return /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file);
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}
