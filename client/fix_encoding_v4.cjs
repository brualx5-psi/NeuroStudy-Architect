
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/SearchResourcesModal.tsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Target: Button Text (Raw text, no quotes)
    // Match: Use o botão ... PT→EN abaixo
    const regexBtnText = /Use o botão .* PT→EN abaixo/g;

    if (regexBtnText.test(content)) {
        content = content.replace(regexBtnText, "Use o botão 🌐 PT→EN abaixo");
        console.log('Fixed Button Text via Regex V4');
    } else {
        console.log('Regex Button Text match failed V4');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Done v4.');

} catch (err) {
    console.error('Error:', err);
}
