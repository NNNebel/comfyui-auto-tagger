const fs = require('fs');
const path = require('path');

// Keep release and local prerelease runtime contents identical.
function stagePlugin(destination) {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of ['index.html', 'inspector.html', 'manifest.json', 'logo.png', 'LICENSE', 'js', '_locales']) {
    fs.cpSync(path.join(root, entry), path.join(destination, entry), { recursive: true });
  }
}

if (require.main === module) stagePlugin(path.resolve('dist'));
module.exports = stagePlugin;
