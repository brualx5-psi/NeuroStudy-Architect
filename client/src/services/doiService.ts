
export interface DoiMetadata {
    title: string;
    authors: string[];
    publisher: string;
    publicationDate: string;
    abstract?: string;
    url: string;
    doi: string;
}

/**
 * Busca metadados de um DOI usando a API do CrossRef
 */
export const fetchDoiMetadata = async (doi: string): Promise<DoiMetadata | null> => {
    try {
        // Limpa o DOI (remove https://doi.org/ se existir)
        const cleanDoi = doi.replace(/https?:\/\/(dx\.)?doi\.org\//, '').trim();

        const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);

        if (!response.ok) {
            console.warn('Erro ao buscar metadados do DOI:', response.statusText);
            return null;
        }

        const data = await response.json();
        const work = data.message;

        // Extrai data de publicação
        let pubDate = '';
        if (work.published?.['date-parts']?.[0]) {
            const parts = work.published['date-parts'][0];
            pubDate = parts.length === 3
                ? `${parts[2]}/${parts[1]}/${parts[0]}` // DD/MM/YYYY
                : parts[0].toString(); // YYYY
        }

        // Extrai autores
        const authors = work.author
            ? work.author.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).filter((n: string) => n)
            : [];

        // Tenta limpar o abstract (vem geralmente com tags XML/HTML)
        let abstract = work.abstract;
        if (abstract) {
            // Remove tags JATS XML comuns no CrossRef (<jats:p>, <jats:bold>, etc)
            abstract = abstract
                .replace(/<jats:title>.*?<\/jats:title>/gi, '') // Remove titulo dentro do abstract
                .replace(/<[^>]+>/g, '') // Remove todas as tags HTML/XML
                .trim();
        }

        return {
            title: work.title?.[0] || 'Título não disponível',
            authors,
            publisher: work['container-title']?.[0] || work.publisher || 'Publisher desconhecido',
            publicationDate: pubDate,
            abstract,
            url: work.URL || `https://doi.org/${cleanDoi}`,
            doi: cleanDoi
        };

    } catch (error) {
        console.error('Exceção ao buscar DOI:', error);
        return null;
    }
};
