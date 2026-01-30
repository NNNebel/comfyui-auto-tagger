#!/usr/bin/env node

/**
 * Build script for creating pre-release Eagle plugin package locally
 * Usage: node build-prerelease.js [version]
 * Example: node build-prerelease.js 1.3.2-pre
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get version from command line or use default
const version = process.argv[2] || '1.3.2-pre';
const filename = `ComfyUI-Auto-Tagger-v${version}.eagleplugin`;

console.log(`Building Eagle Plugin: ${filename}`);
console.log('='.repeat(50));

// Clean up previous build
if (fs.existsSync('dist')) {
  console.log('Cleaning up previous build...');
  fs.rmSync('dist', { recursive: true, force: true });
}

// Create directory structure
console.log('Creating directory structure...');
const dirs = [
  'dist/js/metadata-parser/binary-extraction',
  'dist/js/metadata-parser/parsers',
  'dist/js/metadata-parser/integration',
  'dist/_locales'
];

dirs.forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Copy essential files
console.log('Copying essential files...');

// Root files
const rootFiles = ['index.html', 'manifest.json', 'logo.png', 'LICENSE'];
rootFiles.forEach(file => {
  fs.copyFileSync(file, path.join('dist', file));
  console.log(`  ✓ ${file}`);
});

// JavaScript files
const jsFiles = ['js/core.js', 'js/plugin.js'];
jsFiles.forEach(file => {
  fs.copyFileSync(file, path.join('dist', file));
  console.log(`  ✓ ${file}`);
});

// Metadata parser - binary extraction
const binaryFiles = fs.readdirSync('js/metadata-parser/binary-extraction')
  .filter(f => f.endsWith('.js'));
binaryFiles.forEach(file => {
  const src = path.join('js/metadata-parser/binary-extraction', file);
  const dest = path.join('dist/js/metadata-parser/binary-extraction', file);
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${src}`);
});

// Metadata parser - parsers
const parserFiles = fs.readdirSync('js/metadata-parser/parsers')
  .filter(f => f.endsWith('.js'));
parserFiles.forEach(file => {
  const src = path.join('js/metadata-parser/parsers', file);
  const dest = path.join('dist/js/metadata-parser/parsers', file);
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${src}`);
});

// Metadata parser - integration
const integrationFiles = fs.readdirSync('js/metadata-parser/integration')
  .filter(f => f.endsWith('.js'));
integrationFiles.forEach(file => {
  const src = path.join('js/metadata-parser/integration', file);
  const dest = path.join('dist/js/metadata-parser/integration', file);
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${src}`);
});

// Localization files
const localeFiles = fs.readdirSync('_locales')
  .filter(f => f.endsWith('.json'));
localeFiles.forEach(file => {
  const src = path.join('_locales', file);
  const dest = path.join('dist/_locales', file);
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${src}`);
});

// Create release notes (not included in package, for GitHub Release only)
console.log('\nCreating release notes...');
const changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');
const today = new Date().toISOString().split('T')[0];

// Extract the latest version section (from first ## to second ##)
const sections = changelog.split(/^## /m);
let releaseNotes = '';
if (sections.length >= 2) {
  releaseNotes = '## ' + sections[1].split(/^## /m)[0];
  // Replace date placeholder with today's date
  releaseNotes = releaseNotes.replace(/\d{4}-XX-XX/g, today);
  // Add pre-release notice
  releaseNotes = `# Pre-Release v${version}\n\n⚠️ **This is a pre-release version for testing purposes.**\n\n${releaseNotes}`;
}

fs.writeFileSync('RELEASE_NOTES.md', releaseNotes);
console.log('  ✓ RELEASE_NOTES.md (for GitHub Release only)');

// Create zip package
console.log('\nCreating plugin package...');
try {
  // Change to dist directory and create zip
  process.chdir('dist');
  
  const tempZip = '../temp-plugin.zip';
  const finalPath = `../${filename}`;
  
  // Use PowerShell Compress-Archive on Windows
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path * -DestinationPath '${tempZip}' -Force"`, {
      stdio: 'inherit'
    });
    process.chdir('..');
    // Rename .zip to .eagleplugin
    fs.renameSync('temp-plugin.zip', filename);
  } else {
    // Use zip command on Unix-like systems
    execSync(`zip -r "${finalPath}" ./*`, {
      stdio: 'inherit'
    });
    process.chdir('..');
  }
  
  console.log(`  ✓ ${filename}`);
} catch (error) {
  console.error('Error creating zip package:', error.message);
  process.chdir('..');
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log('✅ Build completed successfully!');
console.log(`📦 Package: ${filename}`);
console.log(`📝 Release notes: RELEASE_NOTES.md`);
console.log('\nNext steps:');
console.log('1. Create GitHub pre-release:');
console.log('   - Tag: v1.3.2-pre');
console.log('   - Mark as "Pre-release"');
console.log('   - Upload the .eagleplugin file');
console.log('   - Copy content from RELEASE_NOTES.md');
console.log('2. Test the plugin in Eagle');
console.log('3. If tests pass, create official release: git tag v1.3.2 && git push origin v1.3.2');
