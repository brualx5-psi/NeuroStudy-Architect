
import os

filepath = r'c:\Users\Stephanie\NeuroStudy-Architect\client\src\components\SearchResourcesModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replacements
replacements = {
    'Ã¡': 'á',
    'Ã¢': 'â',
    'Ã£': 'ã',
    'Ã©': 'é',
    'Ãª': 'ê',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãµ': 'õ',
    'Ãº': 'ú',
    'Ã§': 'ç',
    'Ã€': 'À',
    'Ã‰': 'É',
    'ÃŠ': 'Ê', 
    'Ã“': 'Ó',
    'Ã”': 'Ô',
    'Ã‘': 'Ñ',
    'Ã±': 'ñ',
    'âœ¨': '✨',
    'ðŸ ¥': '🏥',
    'ðŸ“š': '📚',
    'ðŸŒ ': '🌐',
    'âš–ï¸': '⚖️',
    'ðŸ': '🔬', # Guessing generic
    'â†’': '→',
    'Â': '' # Often appears as a spacer
}

# Special specific emoji fixes based on view_file output
# âœ¨ -> ✨
# ðŸ ¥ -> 🏥
# ðŸ“š -> 📚
# ðŸŒ  -> 🌐
# ðŸ ›ï¸ -> 🛡️ (Guideline) - Let's verify line 814
# ðŸ“Š -> 📊 (Evidence level) - line 82
# â˜… -> ★
# â†‘ -> ↑
# âœ“ -> ✓

more_replacements = {
    'ðŸ ›ï¸ ': '🛡️',
    'ðŸ“Š': '📊',
    'ðŸ§ ': '🧠',
    'â˜…': '★',
    'â†‘': '↑',
    'âœ“': '✓',
    'â†’': '→'
}

replacements.update(more_replacements)

new_content = content
for bad, good in replacements.items():
    new_content = new_content.replace(bad, good)

# Fix double spaces if generated
# new_content = new_content.replace('  ', ' ')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("File encoding fixed.")
