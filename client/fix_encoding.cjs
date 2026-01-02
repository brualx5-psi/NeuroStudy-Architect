
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/SearchResourcesModal.tsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    const replacements = {
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
        'ðŸ ›ï¸ ': '🛡️',
        'ðŸ“Š': '📊',
        'ðŸ§ ': '🧠',
        'â˜…': '★',
        'â†‘': '↑',
        'âœ“': '✓',
        'â†’': '→',
        'InglÃªs': 'Inglês',
        'EvidÃªncias': 'Evidências',
        'AutomÃ¡tico': 'Automático',
        'CientÃ­ficos': 'Científicos'
    };

    for (const [bad, good] of Object.entries(replacements)) {
        // Use a global regex replacement
        const regex = new RegExp(bad, 'g');
        content = content.replace(regex, good);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully fixed encoding in ' + filePath);

} catch (err) {
    console.error('Error fixing encoding:', err);
}
