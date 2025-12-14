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
         return (
             <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                 <Globe className="w-16 h-16 text-indigo-300" />
                 <h3 className="text-xl font-bold text-gray-700">{source.type} Link</h3>
                 <a 
                    href={source.content} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline break-all bg-indigo-50 p-4 rounded-lg border border-indigo-100"
                 >
                    {source.content}
                 </a>
                 <p className="text-sm text-gray-500">Clique no link para abrir em uma nova aba.</p>
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
                {source.type === InputType.PDF ? <FileText className="w-5 h-5"/> : 
                 source.type === InputType.VIDEO ? <Video className="w-5 h-5"/> :
                 source.type === InputType.IMAGE ? <ImageIcon className="w-5 h-5"/> :
                 source.type === InputType.URL ? <Globe className="w-5 h-5"/> :
                 <FileText className="w-5 h-5"/>}
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
