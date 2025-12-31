/**
 * Serviço para buscar artigos no PubMed via E-utilities (NCBI)
 * API gratuita: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 */

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export interface PubMedArticle {
    id: string;
    title: string;
    authors: string;
    journal: string;
    year: string;
    abstract: string;
    doi?: string;
    url: string;
}

/**
 * Busca artigos no PubMed
 * @param query Termo de busca
 * @param maxResults Máximo de resultados (padrão 20)
 */
export const searchPubMed = async (query: string, maxResults: number = 20): Promise<PubMedArticle[]> => {
    try {
        // 1. ESearch - Busca IDs
        const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&sort=relevance&retmode=json`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        const ids = searchData.esearchresult?.idlist;
        if (!ids || ids.length === 0) {
            console.log('[PubMed] Nenhum resultado encontrado');
            return [];
        }

        // 2. ESummary - Busca detalhes dos artigos
        const summaryUrl = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
        const summaryResponse = await fetch(summaryUrl);
        const summaryData = await summaryResponse.json();

        const articles: PubMedArticle[] = [];

        for (const id of ids) {
            const item = summaryData.result?.[id];
            if (!item) continue;

            // Extrai DOI se disponível
            const doi = item.articleids?.find((a: any) => a.idtype === 'doi')?.value;

            articles.push({
                id: id,
                title: item.title || 'Sem título',
                authors: item.authors?.map((a: any) => a.name).slice(0, 3).join(', ') || 'Autor desconhecido',
                journal: item.source || '',
                year: item.pubdate?.split(' ')[0] || '',
                abstract: '', // ESummary não retorna abstract, precisaria de EFetch
                doi: doi,
                url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`
            });
        }

        console.log(`[PubMed] Encontrados ${articles.length} artigos`);
        return articles;

    } catch (error) {
        console.error('[PubMed] Erro na busca:', error);
        return [];
    }
};

/**
 * Busca com filtros específicos para saúde
 * @param query Termo de busca
 * @param filters Filtros adicionais (review, clinical trial, etc)
 */
export const searchPubMedWithFilters = async (
    query: string,
    filters: {
        systematicReview?: boolean;
        metaAnalysis?: boolean;
        clinicalTrial?: boolean;
        guideline?: boolean;
    } = {}
): Promise<PubMedArticle[]> => {
    let searchQuery = query;

    // Adiciona filtros de tipo de publicação
    const typeFilters: string[] = [];
    if (filters.systematicReview) typeFilters.push('systematic review[pt]');
    if (filters.metaAnalysis) typeFilters.push('meta-analysis[pt]');
    if (filters.clinicalTrial) typeFilters.push('clinical trial[pt]');
    if (filters.guideline) typeFilters.push('guideline[pt]');

    if (typeFilters.length > 0) {
        searchQuery = `(${query}) AND (${typeFilters.join(' OR ')})`;
    }

    return searchPubMed(searchQuery, 30);
};
