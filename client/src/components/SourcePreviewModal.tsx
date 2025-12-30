import React from 'react';
import { StudySource, InputType } from '../types';
import { X, FileText, Globe, Video, Image as ImageIcon } from './Icons';

interface SourcePreviewModalProps {
  source: StudySource;
  onClose: () => void;
}

export const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({ source, onClose }) => {
  const renderContent = () => {
    switch (source.type) {
      case InputType.PDF:
        // Verifica se o conteúdo já tem o prefixo data URI, senão adiciona
        const pdfSrc = source.content.startsWith('data:')
          ? source.content
          : `data:application/pdf;base64,${source.content}`;
        return (
          <iframe
            src={pdfSrc}
            className="w-full h-full rounded-lg border border-gray-200"
            title="PDF Preview"
          />
        );

      case InputType.IMAGE:
        const imgSrc = source.content.startsWith('data:')
          ? source.content
          : `data:${source.mimeType || 'image/png'};base64,${source.content}`;
        return (
          <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg overflow-auto p-4">
            <img
              src={imgSrc}
              alt={source.name}
              className="max-w-full max-h-full object-contain shadow-lg"
            />
          </div>
        );

      case InputType.VIDEO:
        // Nota: Videos base64 podem ser pesados, mas mantendo a lógica atual:
        const videoSrc = source.content.startsWith('data:')
          ? source.content
          : `data:${source.mimeType || 'video/mp4'};base64,${source.content}`;
        return (
          <div className="flex items-center justify-center h-full bg-black rounded-lg">
            <video controls className="max-w-full max-h-full">
              <source src={videoSrc} type={source.mimeType || 'video/mp4'} />
              Seu navegador não suporta a tag de vídeo.
            </video>
          </div>
        );

      case InputType.URL:
      case InputType.DOI:
        // Extrai domínio da URL para mostrar
        const getDomain = (url: string) => {
          try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            return urlObj.hostname.replace('www.', '');
          } catch { return 'site'; }
        };

        // Verifica se source.content é a URL ou se tem conteúdo extraído
        const isRawUrl = source.content.startsWith('http') || source.content.includes('.com') || source.content.includes('.org');
        const urlToShow = isRawUrl ? source.content : source.name.replace('Link: ', '').replace('...', '');
        const domain = getDomain(urlToShow);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

        return (
          <div className="flex flex-col h-full p-6 space-y-4">
            {/* Card de Preview do Site */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header com favicon e domínio */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50">
                <img
                  src={faviconUrl}
                  alt="Site icon"
                  className="w-8 h-8 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{source.name.replace('Link: ', '').replace('...', '') || domain}</p>
                  <p className="text-xs text-gray-500">{domain}</p>
                </div>
                <a
                  href={isRawUrl ? source.content : urlToShow}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Abrir Site ↗
                </a>
              </div>

              {/* URL completa */}
              <div className="p-4 bg-white">
                <p className="text-xs text-gray-400 uppercase font-bold mb-2">URL Completa</p>
                <p className="text-sm text-indigo-600 break-all bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  {isRawUrl ? source.content : urlToShow}
                </p>
              </div>
            </div>

            {/* Conteúdo extraído (se disponível e não for só URL) */}
            {!isRawUrl && source.content && (
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase font-bold">Conteúdo Extraído</p>
                </div>
                <div className="p-4 overflow-y-auto max-h-[300px]">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {source.content.slice(0, 2000)}
                    {source.content.length > 2000 && (
                      <span className="text-gray-400">... (conteúdo truncado)</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Dica se for só URL */}
            {isRawUrl && (
              <div className="text-center py-8 text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">O conteúdo deste link será processado ao gerar o roteiro de estudo.</p>
              </div>
            )}
          </div>
        );

      case InputType.TEXT:
      default:
        return (
          <div className="w-full h-full bg-gray-50 p-6 rounded-lg overflow-y-auto border border-gray-200 font-mono text-sm whitespace-pre-wrap text-gray-800">
            {source.content}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 shrink-0">
              {source.type === InputType.PDF ? <FileText className="w-5 h-5" /> :
                source.type === InputType.VIDEO ? <Video className="w-5 h-5" /> :
                  source.type === InputType.IMAGE ? <ImageIcon className="w-5 h-5" /> :
                    source.type === InputType.URL ? <Globe className="w-5 h-5" /> :
                      <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-800 truncate max-w-md">{source.name}</h3>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{source.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-4 bg-gray-100 relative">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
