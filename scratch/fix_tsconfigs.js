const fs = require('fs');
const path = require('path');

const appsDir = path.join(process.cwd(), 'apps');
const services = fs.readdirSync(appsDir).filter(f => fs.statSync(path.join(appsDir, f)).isDirectory() && f !== 'frontend');

services.forEach(service => {
  const tsconfigPath = path.join(appsDir, service, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    console.log(`Updating ${tsconfigPath}...`);
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
    tsconfig.compilerOptions.rootDir = 'src';
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }
});

const packagesDir = path.join(process.cwd(), 'packages');
const packages = fs.readdirSync(packagesDir).filter(f => fs.statSync(path.join(packagesDir, f)).isDirectory());

packages.forEach(pkg => {
  const tsconfigPath = path.join(packagesDir, pkg, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    console.log(`Updating ${tsconfigPath}...`);
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
    tsconfig.compilerOptions.rootDir = 'src';
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }
});
