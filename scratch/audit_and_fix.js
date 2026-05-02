/**
 * Comprehensive audit and fix script for RMF monorepo deployment issues.
 * 
 * FIXES:
 * 1. Adds missing runtime dependencies to service package.json files
 * 2. Fixes module format mismatch: shared packages must use "commonjs" to match services compiled with nodenext
 * 3. Adds "exports" field to shared packages so nodenext resolution can find them
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// FIX 1: Add missing runtime deps to service package.json files
// ============================================================

const serviceDepFixes = {
  'user-service': {
    add: {
      'bcrypt': '^6.0.0',
      '@nestjs/passport': '^11.0.5',
      'passport': '^0.7.0',
      'passport-jwt': '^4.0.1',
      '@rmf/location': '^0.1.0'
    }
  },
  'market-service': {
    add: {
      '@rmf/location': '^0.1.0'
    }
  },
  'seller-service': {
    add: {
      '@rmf/location': '^0.1.0'
    }
  },
  'rider-service': {
    add: {
      '@rmf/location': '^0.1.0'
    }
  },
  'order-service': {
    add: {
      '@rmf/location': '^0.1.0'
    }
  },
  'delivery-service': {
    add: {
      '@rmf/location': '^0.1.0'
    }
  }
};

for (const [service, { add }] of Object.entries(serviceDepFixes)) {
  const pkgPath = path.join('apps', service, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.warn(`  [SKIP] ${pkgPath} not found`);
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.dependencies) pkg.dependencies = {};
  for (const [dep, version] of Object.entries(add)) {
    if (!pkg.dependencies[dep]) {
      pkg.dependencies[dep] = version;
      console.log(`  [ADD] ${service}: added ${dep}@${version}`);
    } else {
      console.log(`  [OK]  ${service}: ${dep} already present`);
    }
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// ============================================================
// FIX 2: Fix CJS/ESM mismatch in shared packages
// Services use "module": "nodenext" which expects CJS packages to have 
// "exports" or "main" entry points with .cjs or correct "type" field.
// Simplest fix: ensure shared packages compile to CJS (they already do)
// and add proper "exports" field so nodenext resolution works.
// ============================================================

const sharedPackages = ['shared-types', 'shared-utils', 'database', 'location'];

for (const pkg of sharedPackages) {
  const pkgJsonPath = path.join('packages', pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.warn(`  [SKIP] ${pkgJsonPath} not found`);
    continue;
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  
  // Ensure "exports" field exists for nodenext resolution
  if (!pkgJson.exports) {
    pkgJson.exports = {
      '.': {
        'require': './dist/index.js',
        'import': './dist/index.js',
        'types': './dist/index.d.ts'
      }
    };
    console.log(`  [ADD] packages/${pkg}: added exports field`);
  } else {
    console.log(`  [OK]  packages/${pkg}: exports already present`);
  }

  // Ensure "type" is NOT set to "module" (must remain commonjs)
  if (pkgJson.type === 'module') {
    delete pkgJson.type;
    console.log(`  [FIX] packages/${pkg}: removed "type": "module"`);
  }

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
}

// ============================================================
// FIX 3: Verify all shared package tsconfigs use commonjs (not nodenext)
// ============================================================

for (const pkg of sharedPackages) {
  const tsconfigPath = path.join('packages', pkg, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) continue;
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
  
  // Shared packages must compile to commonjs for compatibility
  if (tsconfig.compilerOptions.module !== 'commonjs') {
    tsconfig.compilerOptions.module = 'commonjs';
    console.log(`  [FIX] packages/${pkg}: set module to commonjs`);
  } else {
    console.log(`  [OK]  packages/${pkg}: module is already commonjs`);
  }
  
  // Ensure moduleResolution matches commonjs compilation
  if (tsconfig.compilerOptions.moduleResolution === 'nodenext') {
    tsconfig.compilerOptions.moduleResolution = 'node';
    console.log(`  [FIX] packages/${pkg}: set moduleResolution to node`);
  }
  
  // Ensure include covers src/**/*
  if (!tsconfig.include) {
    tsconfig.include = ['src/**/*'];
    console.log(`  [ADD] packages/${pkg}: added include field`);
  }
  
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
}

// ============================================================
// FIX 4: health-check package - check if it's actually used/needed
// ============================================================
const hcPkgPath = path.join('packages', 'health-check', 'package.json');
if (fs.existsSync(hcPkgPath)) {
  const hcPkg = JSON.parse(fs.readFileSync(hcPkgPath, 'utf8'));
  if (!hcPkg.scripts || !hcPkg.scripts.build) {
    hcPkg.scripts = { ...(hcPkg.scripts || {}), build: 'tsc' };
    fs.writeFileSync(hcPkgPath, JSON.stringify(hcPkg, null, 2) + '\n');
    console.log('  [FIX] packages/health-check: added build script');
  }
}

console.log('\n✅ Audit and fix complete.');
