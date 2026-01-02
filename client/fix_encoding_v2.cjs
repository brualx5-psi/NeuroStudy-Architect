
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/SearchResourcesModal.tsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Target 1: PubMed
    // We try to match the surrounding context to be sure
    const pubmedBad = "{ key: 'pubmed', label: 'ðŸ ¥ PubMed', color: 'green' }";
    const pubmedGood = "{ key: 'pubmed', label: '🏥 PubMed', color: 'green' }";

    if (content.indexOf(pubmedBad) !== -1) {
        content = content.replace(pubmedBad, pubmedGood);
        console.log('Fixed PubMed emoji');
    } else {
        console.log('Could not find PubMed bad string');
        // Fallback: Try just the label part if indentation differs
        const labelBad = "'ðŸ ¥ PubMed'";
        if (content.indexOf(labelBad) !== -1) {
            content = content.replace(labelBad, "'🏥 PubMed'");
            console.log('Fixed PubMed label only');
        }
    }

    // Target 2: Web/IA
    const webBad = "{ key: 'grounding', label: 'ðŸŒ  Web/IA', color: 'purple' }";
    const webGood = "{ key: 'grounding', label: '🌐 Web/IA', color: 'purple' }";

    if (content.indexOf(webBad) !== -1) {
        content = content.replace(webBad, webGood);
        console.log('Fixed Web/IA emoji');
    } else {
        console.log('Could not find Web/IA bad string');
        const labelBad2 = "'ðŸŒ  Web/IA'";
        if (content.indexOf(labelBad2) !== -1) {
            content = content.replace(labelBad2, "'🌐 Web/IA'");
            console.log('Fixed Web/IA label only');
        }
    }

    // Target 3: The button text 'Use o botão ðŸŒ  PT→EN abaixo'
    const btnTextBad = "Use o botão ðŸŒ  PT→EN abaixo";
    const btnTextGood = "Use o botão 🌐 PT→EN abaixo";

    if (content.indexOf(btnTextBad) !== -1) {
        content = content.replace(btnTextBad, btnTextGood);
        console.log('Fixed Button Text emoji');
    } else {
        console.log('Could not find Button Text bad string');
        // Try part
        const partBad = "ðŸŒ  PT→EN";
        if (content.indexOf(partBad) !== -1) {
            content = content.replace(new RegExp(partBad, 'g'), "🌐 PT→EN");
            console.log('Fixed PT->EN emoji loose');
        }
    }

    // Target 4: The button label itself inside <>
    // <>ðŸŒ  PT→EN</>
    const btnLabelBad = "<>ðŸŒ  PT→EN</>";
    const btnLabelGood = "<>🌐 PT→EN</>";
    if (content.indexOf(btnLabelBad) !== -1) {
        content = content.replace(btnLabelBad, btnLabelGood);
        console.log('Fixed Button Label JSX');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Done.');

} catch (err) {
    console.error('Error:', err);
}
