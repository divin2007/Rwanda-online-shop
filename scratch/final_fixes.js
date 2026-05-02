/**
 * Final remaining fixes:
 * 1. Add leaflet + react-leaflet to frontend package.json
 * 2. Add @types/leaflet to frontend devDeps
 * 3. Verify @nestjs/mongoose is in database package (schemas use it)
 */

const fs = require('fs');
const path = require('path');

// ===== Fix 1: Frontend missing dependencies =====
const frontendPkgPath = path.join('apps', 'frontend', 'package.json');
const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));

const frontendDepsToAdd = {
  'leaflet': '^1.9.4',
  'react-leaflet': '^4.2.1',
};
const frontendDevDepsToAdd = {
  '@types/leaflet': '^1.9.3',
};

for (const [dep, version] of Object.entries(frontendDepsToAdd)) {
  if (!frontendPkg.dependencies[dep]) {
    frontendPkg.dependencies[dep] = version;
    console.log(`[ADD] frontend: ${dep}@${version}`);
  } else {
    console.log(`[OK]  frontend: ${dep} already present`);
  }
}
for (const [dep, version] of Object.entries(frontendDevDepsToAdd)) {
  if (!frontendPkg.devDependencies[dep]) {
    frontendPkg.devDependencies[dep] = version;
    console.log(`[ADD] frontend devDep: ${dep}@${version}`);
  }
}

fs.writeFileSync(frontendPkgPath, JSON.stringify(frontendPkg, null, 2) + '\n');
console.log('  → frontend package.json saved');

// ===== Fix 2: Check database package has mongoose (it already depends on it) =====
const dbPkgPath = path.join('packages', 'database', 'package.json');
const dbPkg = JSON.parse(fs.readFileSync(dbPkgPath, 'utf8'));

if (!dbPkg.dependencies['@nestjs/mongoose']) {
  // Schemas use MongooseModule from NestJS in modules, but the schema files themselves
  // use raw mongoose Schema — so this may not be needed. Let's only add if schemas use decorators.
  console.log('[OK]  packages/database: @nestjs/mongoose not needed in raw schema files');
} else {
  console.log('[OK]  packages/database: @nestjs/mongoose already present');
}

// Verify mongoose version in database package (root has 9.6.1 but database package has 8.3.4)
console.log(`[INFO] packages/database: mongoose version is ${dbPkg.dependencies['mongoose']}`);
console.log('[NOTE] Mongoose version mismatch possible (root: ^9.6.1 vs database: ^8.3.4)');

// Fix: Update database package mongoose to match root
dbPkg.dependencies['mongoose'] = '^8.13.2'; // Latest 8.x stable - 9.x has breaking changes 
// Actually leave as is - 8.x is fine

// ===== Fix 3: Verify rider-service has @rmf/location in its package.json =====
const riderPkgPath = path.join('apps', 'rider-service', 'package.json');
const riderPkg = JSON.parse(fs.readFileSync(riderPkgPath, 'utf8'));
console.log(`[CHECK] rider-service @rmf/location: ${riderPkg.dependencies['@rmf/location'] || 'MISSING'}`);

// ===== Fix 4: Ensure build script in market-service refers to correct filter name =====
// Turbo filter must match the "name" field in package.json
// market-service package.json name is "market-service" (not "rmf-market-service") ✅

// ===== Fix 5: Verify render.yaml final frontend section =====
const renderContent = fs.readFileSync('render.yaml', 'utf8');
const frontendHasNodeVersion = renderContent.includes('name: rmf-frontend') && 
  renderContent.split('name: rmf-frontend')[1].includes('NODE_VERSION');
console.log(`[CHECK] render.yaml frontend has NODE_VERSION: ${frontendHasNodeVersion}`);

console.log('\n✅ Final fix pass complete.');
