import { PDFDocument } from 'pdf-lib';

/**
 * Extrai páginas específicas de um PDF
 * @param pdfFile - Arquivo PDF original
 * @param pageNumbers - Array de números de páginas a extrair (1-indexed)
 * @returns Novo File com apenas as páginas selecionadas
 */
export const extractPdfPages = async (pdfFile: File, pageNumbers: number[]): Promise<File> => {
    // Lê o PDF original
    const arrayBuffer = await pdfFile.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);

    // Cria novo documento
    const newPdf = await PDFDocument.create();

    // Total de páginas no PDF original
    const totalPages = sourcePdf.getPageCount();

    // Filtra páginas válidas e converte para 0-indexed
    const validPages = pageNumbers
        .filter(p => p >= 1 && p <= totalPages)
        .map(p => p - 1); // Converte para 0-indexed

    if (validPages.length === 0) {
        throw new Error('Nenhuma página válida selecionada');
    }

    // Copia as páginas selecionadas
    const copiedPages = await newPdf.copyPages(sourcePdf, validPages);
    copiedPages.forEach(page => newPdf.addPage(page));

    // Salva o novo PDF
    const newPdfBytes = await newPdf.save();

    // Cria novo File
    const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
    const newFileName = pdfFile.name.replace('.pdf', `_p${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}.pdf`);

    return new File([blob], newFileName, { type: 'application/pdf' });
};

/**
 * Obtém o número total de páginas de um PDF
 * @param pdfFile - Arquivo PDF
 * @returns Número total de páginas
 */
export const getPdfPageCount = async (pdfFile: File): Promise<number> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    return pdf.getPageCount();
};
