const fs = require('fs');

const renderYamlPath = 'render.yaml';
let content = fs.readFileSync(renderYamlPath, 'utf8');

const lines = content.split('\n');
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);
  if (lines[i].trim() === 'envVars:') {
    newLines.push('      - key: NODE_VERSION');
    newLines.push('        value: "20"');
  }
}

// Special case for frontend which might not have envVars
const frontendStart = newLines.findIndex(line => line.includes('name: rmf-frontend'));
if (frontendStart !== -1) {
  // Check if it already has envVars (it shouldn't based on my previous check)
  const hasEnvVars = newLines.slice(frontendStart, frontendStart + 10).some(line => line.trim() === 'envVars:');
  if (!hasEnvVars) {
    // Add envVars after startCommand
    const startCmdIndex = newLines.findIndex((line, idx) => idx >= frontendStart && line.includes('startCommand'));
    if (startCmdIndex !== -1) {
      newLines.splice(startCmdIndex + 1, 0, '    envVars:', '      - key: NODE_VERSION', '        value: "20"');
    }
  }
}

fs.writeFileSync(renderYamlPath, newLines.join('\n'));
console.log('Updated render.yaml with NODE_VERSION: 20');
