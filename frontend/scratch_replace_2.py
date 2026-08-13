import os
import re

directory_path = os.path.join(os.path.dirname(__file__), 'src')

def replace_in_file(file_path):
    with open(file_path, 'r') as file:
        content = file.read()

    modified = content
    
    # Text colors
    # Only replace text-white if it's not preceded by bg-primary or bg-blue-500 etc.
    # We can just replace text-white with text-foreground, and then fix the primary buttons.
    # Actually, a simpler regex: replace `text-white` if not `bg-primary ... text-white`
    # Let's just do bulk replacements and then manual fixes if needed, or safer:
    
    modified = re.sub(r'bg-neutral-950', r'bg-surface-1', modified)
    modified = re.sub(r'bg-neutral-900', r'bg-surface-2', modified)
    modified = re.sub(r'bg-neutral-800', r'bg-surface-3', modified)
    modified = re.sub(r'border-neutral-700', r'border-border', modified)
    modified = re.sub(r'text-neutral-600', r'text-text-secondary', modified)
    modified = re.sub(r'text-neutral-500', r'text-text-secondary', modified)
    modified = re.sub(r'text-neutral-400', r'text-text-secondary', modified)
    modified = re.sub(r'text-neutral-300', r'text-foreground', modified)
    
    # We will replace text-white with text-foreground globally, EXCEPT where bg-primary or bg-[#2c6bed] is used.
    # To do this safely, we will just use a function for text-white
    def replacer(match):
        full_match = match.group(0)
        if 'bg-primary' in full_match or 'bg-blue' in full_match or 'bg-green' in full_match or 'bg-red' in full_match:
            return full_match
        else:
            return full_match.replace('text-white', 'text-foreground')
            
    # Match className="..." strings
    modified = re.sub(r'className=(?:\{`|"[^"]*"|`[^`]*`)', replacer, modified)
    
    # Also replace hover states
    modified = modified.replace('hover:bg-neutral-800', 'hover:bg-surface-4')
    modified = modified.replace('hover:text-white', 'hover:text-foreground')

    if content != modified:
        with open(file_path, 'w') as file:
            file.write(modified)
        print(f"Updated {file_path}")

def walk_and_replace(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                replace_in_file(os.path.join(root, file))

walk_and_replace(directory_path)
print("Done")
