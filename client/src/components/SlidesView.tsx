import React, { useState } from 'react';
import { SlideContent } from '../types';
import { Monitor, Edit, Lock, CheckCircle, GraduationCap, Download, FileText, Lightbulb } from './Icons';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';

interface SlidesViewProps {
  slides: SlideContent[];
  onUpdateSlides?: (newSlides: SlideContent[]) => void;
}

export const SlidesView: React.FC<SlidesViewProps> = ({ slides, onUpdateSlides }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlides, setEditedSlides] = useState<SlideContent[]>(slides);
  const [isExporting, setIsExporting] = useState(false);

  React.useEffect(() => {
    setEditedSlides(slides);
  }, [slides]);

  const nextSlide = () => { if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1); };
  const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); };

  const handleSave = () => {
    if (onUpdateSlides) {
      onUpdateSlides(editedSlides);
    }
    setIsEditing(false);
  };

  const updateSlideField = (field: keyof SlideContent, value: string | string[]) => {
    const newSlides = [...editedSlides];
    // @ts-ignore
    newSlides[currentSlide] = { ...newSlides[currentSlide], [field]: value };
    setEditedSlides(newSlides);
  };

  const updateBullet = (bulletIndex: number, text: string) => {
    const newSlides = [...editedSlides];
    const newBullets = [...newSlides[currentSlide].bullets];
    newBullets[bulletIndex] = text;
    newSlides[currentSlide] = { ...newSlides[currentSlide], bullets: newBullets };
    setEditedSlides(newSlides);
  };

  // PDF Export using pdf-lib
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      for (const slide of slides) {
        const page = pdfDoc.addPage([842, 595]); // A4 Landscape
        const { width, height } = page.getSize();

        // Title
        page.drawText(slide.title, {
          x: 50,
          y: height - 80,
          size: 28,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.4),
        });

        // Bullets
        let yPos = height - 140;
        for (const bullet of slide.bullets) {
          page.drawText(`• ${bullet}`, {
            x: 60,
            y: yPos,
            size: 16,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
            maxWidth: width - 120,
          });
          yPos -= 35;
        }

        // Speaker Notes (at bottom)
        if (slide.speakerNotes) {
          page.drawText('Notas do Apresentador:', {
            x: 50,
            y: 100,
            size: 10,
            font: boldFont,
            color: rgb(0.5, 0.4, 0.0),
          });

          const noteLines = slide.speakerNotes.split(/\n|(?=.{80})/g).slice(0, 3);
          let noteY = 85;
          for (const line of noteLines) {
            page.drawText(line.trim(), {
              x: 50,
              y: noteY,
              size: 9,
              font: font,
              color: rgb(0.4, 0.3, 0.0),
              maxWidth: width - 100,
            });
            noteY -= 14;
          }
        }

        // Footer
        page.drawText('NeuroStudy Architect', {
          x: 50,
          y: 30,
          size: 10,
          font: font,
          color: rgb(0.6, 0.6, 0.6),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'slides-neurostudy.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // PPTX Export using pptxgenjs
  const handleExportPPTX = async () => {
    setIsExporting(true);
    try {
      const pptx = new PptxGenJS();
      pptx.author = 'NeuroStudy Architect';
      pptx.title = 'Apresentação de Estudo';
      pptx.layout = 'LAYOUT_WIDE';

      for (const slide of slides) {
        const pptSlide = pptx.addSlide();

        // Title
        pptSlide.addText(slide.title, {
          x: 0.5,
          y: 0.5,
          w: '90%',
          h: 1,
          fontSize: 32,
          bold: true,
          color: '363636',
        });

        // Bullets
        const bulletText = slide.bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 18, color: '444444' } }));
        pptSlide.addText(bulletText, {
          x: 0.5,
          y: 2,
          w: '90%',
          h: 3.5,
          valign: 'top',
        });

        // Speaker Notes
        if (slide.speakerNotes) {
          pptSlide.addNotes(slide.speakerNotes);
        }

        // Footer
        pptSlide.addText('NeuroStudy Architect', {
          x: 0.5,
          y: 5.2,
          w: 3,
          h: 0.3,
          fontSize: 10,
          color: '888888',
        });
      }

      await pptx.writeFile({ fileName: 'slides-neurostudy.pptx' });
    } catch (err) {
      console.error('Erro ao exportar PPTX:', err);
      alert('Erro ao gerar PowerPoint. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!slides || slides.length === 0) return <div className="text-center p-8 text-gray-500">Nenhum slide gerado ainda.</div>;

  const slide = isEditing ? editedSlides[currentSlide] : slides[currentSlide];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Banner Feynman - Técnica de Ensino */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-violet-50 border border-purple-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl text-purple-600 shadow-inner">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-purple-800 flex items-center gap-2">
              <span>🧠 Técnica Feynman: Ensine para Aprender</span>
            </h3>
            <p className="text-purple-700 text-sm mt-1 leading-relaxed">
              Use estes slides para <strong>explicar o conteúdo como se estivesse ensinando outra pessoa</strong>.
              Isso fortalece suas conexões neurais e revela lacunas no seu entendimento.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-purple-600">
              <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Fale em voz alta</span>
              <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Use as notas abaixo</span>
              <span className="flex items-center gap-1"><Edit className="w-3 h-3" /> Edite se necessário</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar de Controle */}
      <div className="flex justify-between items-center">
        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {isExporting ? 'Gerando...' : 'Baixar PDF'}
          </button>
          <button
            onClick={handleExportPPTX}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Gerando...' : 'Baixar PPTX'}
          </button>
        </div>

        {/* Edit Toggle */}
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
            <Lock className="w-4 h-4" /> Desbloquear Edição
          </button>
        ) : (
          <div className="flex items-center gap-2 animate-in fade-in">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mr-2 animate-pulse">Modo Edição Ativo</span>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md">
              <CheckCircle className="w-4 h-4" /> Salvar Alterações
            </button>
          </div>
        )}
      </div>

      {/* Slide Preview */}
      <div className={`aspect-video bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col relative transition-all ${isEditing ? 'ring-4 ring-indigo-100' : ''}`}>
        <div className="flex-1 p-12 flex flex-col justify-center bg-gradient-to-br from-white to-slate-50">
          {isEditing ? (
            <input
              value={slide.title}
              onChange={(e) => updateSlideField('title', e.target.value)}
              className="text-3xl font-bold text-slate-800 mb-8 border-b-4 border-indigo-500 pb-4 w-full bg-transparent outline-none focus:bg-indigo-50/50 rounded"
            />
          ) : (
            <h2 className="text-3xl font-bold text-slate-800 mb-8 border-b-4 border-indigo-500 pb-4 inline-block self-start">{slide.title}</h2>
          )}

          <ul className="space-y-4">
            {slide.bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-center gap-3 text-xl text-slate-700">
                <span className="mt-2 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                {isEditing ? (
                  <input
                    value={bullet}
                    onChange={(e) => updateBullet(idx, e.target.value)}
                    className="flex-1 bg-transparent border-b border-gray-200 focus:border-indigo-500 outline-none"
                  />
                ) : (
                  <span>{bullet}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="h-12 bg-slate-100 flex items-center justify-between px-6 text-sm text-slate-500 border-t border-gray-200">
          <span>NeuroStudy Architect</span>
          <span>{currentSlide + 1} / {slides.length}</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <button onClick={prevSlide} disabled={currentSlide === 0} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium">Anterior</button>
        <div className="flex gap-2">{slides.map((_, idx) => (<button key={idx} onClick={() => setCurrentSlide(idx)} className={`w-3 h-3 rounded-full transition-colors ${idx === currentSlide ? 'bg-indigo-600' : 'bg-gray-300'}`} />))}</div>
        <button onClick={nextSlide} disabled={currentSlide === slides.length - 1} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium">Próximo</button>
      </div>

      {/* Speaker Notes */}
      <div className={`bg-yellow-50 p-6 rounded-xl border border-yellow-200 transition-all ${isEditing ? 'ring-2 ring-yellow-300' : ''}`}>
        <h4 className="text-sm font-bold text-yellow-800 uppercase mb-2 flex items-center gap-2">
          <Monitor className="w-4 h-4" />
          Notas do Apresentador
          <span className="text-xs font-normal normal-case text-yellow-600 ml-2">— O que falar neste slide</span>
        </h4>
        {isEditing ? (
          <textarea
            value={slide.speakerNotes}
            onChange={(e) => updateSlideField('speakerNotes', e.target.value)}
            className="w-full h-24 p-2 bg-white/50 border border-yellow-300 rounded text-yellow-900 font-serif resize-none outline-none focus:bg-white"
          />
        ) : (
          <p className="text-yellow-900 leading-relaxed font-serif">{slide.speakerNotes}</p>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-gray-400 text-center">
        💡 <strong>Dica Feynman:</strong> Leia as notas em voz alta como se estivesse explicando para um amigo.
      </p>
    </div>
  );
};