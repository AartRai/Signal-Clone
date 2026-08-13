const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = {
  'bg-[#09090b]': 'bg-background',
  'bg-[#0e0e10]': 'bg-surface-1',
  'bg-[#121212]': 'bg-surface-2',
  'bg-[#121214]': 'bg-surface-2',
  'bg-[#161618]': 'bg-surface-3',
  'bg-[#1a1a1c]': 'bg-surface-4',
  'bg-[#1e1e21]': 'bg-surface-5',
  'bg-[#2e2e30]': 'bg-surface-6',
  'bg-[#2c6bed]': 'bg-primary',
  'text-[#f4f4f5]': 'text-foreground',
  'text-[#f2f2f2]': 'text-foreground',
  'text-[#e4e4e7]': 'text-foreground',
  'border-neutral-800': 'border-border',
  'text-neutral-400': 'text-text-secondary',
};

function walkAndReplace(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkAndReplace(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = content;
      
      for (const [search, replace] of Object.entries(replacements)) {
        // Use regex for global replacement
        const regex = new RegExp(search.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
        modified = modified.replace(regex, replace);
      }
      
      if (content !== modified) {
        fs.writeFileSync(fullPath, modified, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  });
}

walkAndReplace(directoryPath);
console.log("Done");
