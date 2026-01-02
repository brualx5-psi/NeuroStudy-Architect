
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/SearchResourcesModal.tsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. PubMed
    // Match: label: '... PubMed'
    // Regex: /label:\s*'[^']*PubMed'/g
    const regexPubMed = /label:\s*'[^']*PubMed'/g;
    if (regexPubMed.test(content)) {
        content = content.replace(regexPubMed, "label: '🏥 PubMed'");
        console.log('Fixed PubMed via Regex');
    } else {
        console.log('Regex PubMed match failed');
    }

    // 2. Web/IA
    // Match: label: '... Web/IA'
    const regexWeb = /label:\s*'[^']*Web\/IA'/g;
    if (regexWeb.test(content)) {
        content = content.replace(regexWeb, "label: '🌐 Web/IA'");
        console.log('Fixed Web/IA via Regex');
    } else {
        console.log('Regex Web/IA match failed');
    }

    // 3. Button Text
    // Match: "Use o botão ... PT→EN abaixo"
    // Regex: /"Use o botão .* PT→EN abaixo"/g
    // Be careful with newlines, but here it's on one line
    const regexBtnText = /"Use o botão [^"]* PT→EN abaixo"/g;
    if (regexBtnText.test(content)) {
        content = content.replace(regexBtnText, '"Use o botão 🌐 PT→EN abaixo"');
        console.log('Fixed Button Text via Regex');
    } else {
        console.log('Regex Button Text match failed');
    }

    // 4. Button Label JSX
    // Match: <>... PT→EN</>
    const regexBtnLabel = /<>.*PT→EN<\/>/g;
    if (regexBtnLabel.test(content)) {
        content = content.replace(regexBtnLabel, "<>🌐 PT→EN</>");
        console.log('Fixed Button Label JSX via Regex');
    } else {
        console.log('Regex Button Label match failed');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Done v3.');

} catch (err) {
    console.error('Error:', err);
}
