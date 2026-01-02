
$path = "src\components\SearchResourcesModal.tsx"
$content = Get-Content -Path $path -Raw -Encoding UTF8

$replacements = @{
    "Ã¡" = "á";
    "Ã¢" = "â";
    "Ã£" = "ã";
    "Ã©" = "é";
    "Ãª" = "ê";
    "Ã­" = "í";
    "Ã³" = "ó";
    "Ãµ" = "õ";
    "Ãº" = "ú";
    "Ã§" = "ç";
    "Ã€" = "À";
    "Ã‰" = "É";
    "ÃŠ" = "Ê";
    "Ã“" = "Ó";
    "Ã”" = "Ô";
    "Ã‘" = "Ñ";
    "Ã±" = "ñ";
    "âœ¨" = "✨";
    "ðŸ ¥" = "🏥";
    "ðŸ“š" = "📚";
    "ðŸŒ " = "🌐";
    "âš–ï¸" = "⚖️";
    "ðŸ ›ï¸ " = "🛡️";
    "ðŸ“Š" = "📊";
    "ðŸ§ " = "🧠";
    "â˜… " = "★";
    "â†‘" = "↑";
    "âœ“" = "✓";
    "â†’" = "→"
}

foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
}

Set-Content -Path $path -Value $content -Encoding UTF8
Write-Host "Encoding fixed."
