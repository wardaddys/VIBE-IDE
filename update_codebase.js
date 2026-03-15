const fs = require('fs');
const path = require('path');

const codebaseStatsPath = path.join(__dirname, 'codebase_v2.md');
let content = fs.readFileSync(codebaseStatsPath, 'utf-8');

const regex = /## ([^\r\n]+)\r?\n\r?\n`\$lang\r?\n([\s\S]*?)\`\`n/g;

let updatedFiles = 0;
const newContent = content.replace(regex, (match, filePath, code) => {
    try {
        const cleanPath = filePath.trim();
        const actualPath = path.join(__dirname, cleanPath);
        const actualCode = fs.readFileSync(actualPath, 'utf-8');
        updatedFiles++;
        return `## ${cleanPath}\n\n\`$lang\n${actualCode}\n\`\`n`;
    } catch (e) {
        console.warn('Could not read file:', filePath.trim());
        return match; // keep original
    }
});

fs.writeFileSync(codebaseStatsPath, newContent, 'utf-8');
console.log(`Successfully updated codebase_v2.md (${updatedFiles} files synced).`);
