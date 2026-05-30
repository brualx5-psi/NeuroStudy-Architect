import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { StudyGuide, Checkpoint } from '../types';

// A4 portrait points
const PW = 595;
const PH = 842;
const MX = 50; // horizontal margin

// Vertical zones
const HEADER_SEP_Y = PH - 36; // separator line under header
const CONTENT_TOP = PH - 52; // where content starts
const CONTENT_BOTTOM = 56;   // content must not go below this
const FOOTER_LINE_Y = 40;
const FOOTER_TEXT_Y = 26;

const CW = PW - MX * 2; // content width = 495

// Color palette
const C = {
  title:      rgb(0.13, 0.14, 0.28),
  heading:    rgb(0.18, 0.20, 0.45),
  body:       rgb(0.12, 0.12, 0.12),
  meta:       rgb(0.50, 0.50, 0.55),
  accent:     rgb(0.30, 0.38, 0.80),
  cardBg:     rgb(0.95, 0.96, 1.00),
  cardBorder: rgb(0.72, 0.76, 0.94),
  cpBg:       rgb(0.97, 0.97, 0.99),
  cpBorder:   rgb(0.77, 0.80, 0.94),
  hr:         rgb(0.82, 0.85, 0.92),
};

// Normalize characters that fall outside WinAnsiEncoding
function san(text: string): string {
  return (text || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x00-\xFF]/g, ' ');
}

// Strip common markdown syntax so it doesn't appear raw in the PDF
function stripMd(text: string): string {
  return san(text)
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '- ')
    .trim();
}

class PdfLayout {
  private pages: PDFPage[] = [];
  private pdfDoc!: PDFDocument;
  private font!: PDFFont;
  private bold!: PDFFont;
  private curY = CONTENT_TOP;
  private guide!: StudyGuide;

  init(guide: StudyGuide, pdfDoc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.guide = guide;
    this.pdfDoc = pdfDoc;
    this.font = font;
    this.bold = bold;
    this.newPage();
  }

  private newPage() {
    const page = this.pdfDoc.addPage([PW, PH]);
    this.pages.push(page);
    this.paintChrome(page);
    this.curY = CONTENT_TOP;
  }

  private get pg(): PDFPage {
    return this.pages[this.pages.length - 1];
  }

  private paintChrome(page: PDFPage) {
    const isFirst = this.pages.length === 1;
    page.drawText('NeuroStudy', {
      x: MX, y: PH - 28,
      size: 9, font: this.font, color: C.meta,
    });
    if (!isFirst && this.guide?.title) {
      const t = san(this.guide.title.length > 55 ? this.guide.title.slice(0, 52) + '...' : this.guide.title);
      const tW = this.font.widthOfTextAtSize(t, 8);
      page.drawText(t, { x: PW - MX - tW, y: PH - 28, size: 8, font: this.font, color: C.meta });
    }
    page.drawLine({ start: { x: MX, y: HEADER_SEP_Y }, end: { x: PW - MX, y: HEADER_SEP_Y }, thickness: 0.4, color: C.hr });
  }

  private paintFooters() {
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      page.drawLine({ start: { x: MX, y: FOOTER_LINE_Y }, end: { x: PW - MX, y: FOOTER_LINE_Y }, thickness: 0.4, color: C.hr });
      const label = `${i + 1} / ${total}`;
      const w = this.font.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: PW - MX - w, y: FOOTER_TEXT_Y, size: 8, font: this.font, color: C.meta });
    });
  }

  // Wrap text using real font metrics instead of fixed character count
  private wrap(text: string, size: number, maxW: number): string[] {
    const clean = stripMd(text);
    if (!clean) return [''];
    const words = clean.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let curr = '';
    for (const w of words) {
      const candidate = curr ? `${curr} ${w}` : w;
      if (this.font.widthOfTextAtSize(candidate, size) > maxW) {
        if (curr) lines.push(curr);
        curr = w;
      } else {
        curr = candidate;
      }
    }
    if (curr) lines.push(curr);
    return lines.length ? lines : [''];
  }

  // Ensure at least `needed` points remain; add page if not
  private ensure(needed: number) {
    if (this.curY - needed < CONTENT_BOTTOM) this.newPage();
  }

  gap(n = 8) { this.curY -= n; }

  // Flowing body text — handles its own page breaks line by line
  bodyText(raw: string, size = 10, indent = 0, color = C.body) {
    const lines = this.wrap(raw, size, CW - indent);
    const lh = size + 4;
    for (const line of lines) {
      this.ensure(lh + 2);
      this.pg.drawText(san(line), { x: MX + indent, y: this.curY, size, font: this.font, color });
      this.curY -= lh;
    }
  }

  boldText(raw: string, size = 10, indent = 0, color = C.heading) {
    this.ensure(size + 6);
    this.pg.drawText(san(stripMd(raw)), { x: MX + indent, y: this.curY, size, font: this.bold, color });
    this.curY -= size + 4;
  }

  sectionHeading(label: string) {
    this.gap(12);
    this.ensure(24);
    const y0 = this.curY;
    this.pg.drawText(san(label), { x: MX, y: y0, size: 12, font: this.bold, color: C.heading });
    const w = Math.min(this.bold.widthOfTextAtSize(san(label), 12) + 20, CW);
    this.pg.drawLine({ start: { x: MX, y: y0 - 3 }, end: { x: MX + w, y: y0 - 3 }, thickness: 1.5, color: C.accent });
    this.curY -= 20;
    this.gap(4);
  }

  hLine(color = C.hr, thickness = 0.5) {
    this.ensure(8);
    this.pg.drawLine({ start: { x: MX, y: this.curY }, end: { x: PW - MX, y: this.curY }, thickness, color });
    this.curY -= 8;
  }

  // Info card with colored left accent — used for Objetivo and Alinhamento
  card(label: string, text: string) {
    const CP = 10;
    const innerW = CW - CP * 2 - 4;
    const lines = this.wrap(text, 10, innerW);
    const LH = 14;
    const cardH = CP + 13 + lines.length * LH + CP;

    this.ensure(cardH + 16);
    this.gap(8);

    const boxY = this.curY - cardH;
    this.pg.drawRectangle({ x: MX, y: boxY, width: CW, height: cardH, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 0.6 });
    this.pg.drawRectangle({ x: MX, y: boxY, width: 3, height: cardH, color: C.accent });

    this.curY -= CP;
    this.pg.drawText(san(label.toUpperCase()), { x: MX + CP + 4, y: this.curY, size: 8, font: this.bold, color: C.accent });
    this.curY -= 13;

    for (const l of lines) {
      this.pg.drawText(san(l), { x: MX + CP + 4, y: this.curY, size: 10, font: this.font, color: C.body });
      this.curY -= LH;
    }
    this.curY -= CP;
    this.gap(6);
  }

  // Checkpoint block — collects all fields in a bordered box
  checkpoint(cp: Checkpoint, idx: number) {
    const CP = 10;
    const innerW = CW - CP * 2;
    const LH_BODY = 13;
    const LH_LABEL = 11;

    const titleText = stripMd(`Checkpoint ${idx + 1} — ${cp.mission || ''}`);
    const titleLines = this.wrap(titleText, 10, innerW);

    const fields: Array<{ label: string; lines: string[] }> = [];
    if (cp.timestamp || cp.sourceLocator) fields.push({ label: 'Momento/fonte', lines: this.wrap(cp.sourceLocator || cp.timestamp, 9, innerW - 4) });
    if (cp.lookFor) fields.push({ label: 'O que procurar', lines: this.wrap(cp.lookFor, 9, innerW - 4) });
    if (cp.noteExactly) fields.push({ label: 'Escreva exatamente isso', lines: this.wrap(cp.noteExactly, 9, innerW - 4) });
    if (cp.drawExactly && cp.drawLabel !== 'none') fields.push({ label: 'Sugestão de desenho', lines: this.wrap(cp.drawExactly, 9, innerW - 4) });
    if (cp.question) fields.push({ label: 'Pergunta reflexiva', lines: this.wrap(cp.question, 9, innerW - 4) });

    let H = CP;
    H += titleLines.length * 14;
    H += 4;
    for (const f of fields) {
      H += LH_LABEL + f.lines.length * LH_BODY + 4;
    }
    H += CP;

    this.ensure(H + 16);
    this.gap(10);

    const boxY = this.curY - H;
    this.pg.drawRectangle({ x: MX, y: boxY, width: CW, height: H, color: C.cpBg, borderColor: C.cpBorder, borderWidth: 0.5 });
    // Top accent stripe inside top of card
    this.pg.drawRectangle({ x: MX, y: boxY + H - 3, width: CW, height: 3, color: C.accent });

    this.curY -= CP;
    for (const tl of titleLines) {
      this.pg.drawText(san(tl), { x: MX + CP, y: this.curY, size: 10, font: this.bold, color: C.heading });
      this.curY -= 14;
    }
    this.curY -= 4;

    for (const { label, lines } of fields) {
      this.pg.drawText(san(label) + ':', { x: MX + CP, y: this.curY, size: 8, font: this.bold, color: C.accent });
      this.curY -= LH_LABEL;
      for (const l of lines) {
        this.pg.drawText(san(l), { x: MX + CP + 4, y: this.curY, size: 9, font: this.font, color: C.body });
        this.curY -= LH_BODY;
      }
      this.curY -= 4;
    }
    this.curY -= CP;
    this.gap(6);
  }

  titleBlock() {
    const g = this.guide;
    // Main title — large, dark navy
    for (const l of this.wrap(g.title || 'Roteiro', 20, CW)) {
      this.ensure(28);
      this.pg.drawText(san(l), { x: MX, y: this.curY, size: 20, font: this.bold, color: C.title });
      this.curY -= 26;
    }
    // Subject chip/badge
    if (g.subject) {
      this.gap(4);
      const subj = san(stripMd(g.subject));
      const chipW = Math.min(this.font.widthOfTextAtSize(subj, 9) + 16, CW);
      this.pg.drawRectangle({ x: MX, y: this.curY - 14, width: chipW, height: 17, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 0.5 });
      this.pg.drawText(subj, { x: MX + 8, y: this.curY - 11, size: 9, font: this.font, color: C.heading });
      this.curY -= 22;
    }
    this.gap(8);
    this.hLine(C.accent, 1.5);
    this.gap(6);
  }

  generate(): Promise<Uint8Array> {
    const g = this.guide;

    this.titleBlock();

    // Objetivo da Aula / Objetivo do Livro
    const overview = g.overview || (g as any).summary || '';
    const overviewLabel = g.bookChapters?.length ? 'Objetivo do Livro' : 'Objetivo da Aula';
    if (overview) this.card(overviewLabel, overview);

    // Alinhamento com o Módulo
    if (g.moduleAlignment) this.card('Alinhamento com o Módulo', g.moduleAlignment);

    // Conceitos Fundamentais
    if (g.coreConcepts?.length) {
      this.sectionHeading('Conceitos Fundamentais');
      g.coreConcepts.forEach((c, i) => {
        this.ensure(40);
        this.gap(6);
        this.boldText(`${i + 1}. ${c.concept}`, 10, 4, C.heading);
        this.bodyText(c.definition, 10, 16);
        if (c.tools?.feynman) {
          this.gap(2);
          this.pg.drawText('Feynman:', { x: MX + 16, y: this.curY, size: 8, font: this.bold, color: C.accent });
          this.curY -= 11;
          this.bodyText(c.tools.feynman, 9, 20);
        }
      });
    }

    // Conceitos de Suporte
    if (g.supportConcepts?.length) {
      this.sectionHeading('Conceitos de Suporte');
      g.supportConcepts.forEach((c, i) => {
        this.ensure(40);
        this.gap(6);
        this.boldText(`${i + 1}. ${c.concept}`, 10, 4, C.heading);
        this.bodyText(c.definition, 10, 16);
      });
    }

    // Capítulos (modo livro)
    if (g.bookChapters?.length) {
      this.sectionHeading('Capítulos');
      g.bookChapters.forEach((ch, i) => {
        this.gap(10);
        this.ensure(30);
        this.boldText(`${i + 1}. ${ch.title}`, 11, 0, C.heading);

        // paretoChunk como conteúdo principal
        const body = ch.paretoChunk || ch.content || '';
        if (body) this.bodyText(body, 10, 8);

        // Conceitos locais do capítulo
        if (ch.coreConcepts?.length) {
          this.gap(6);
          this.pg.drawText('Conceitos:', { x: MX + 8, y: this.curY, size: 8, font: this.bold, color: C.accent });
          this.curY -= 12;
          ch.coreConcepts.forEach((c, ci) => {
            this.ensure(24);
            this.boldText(`${ci + 1}. ${c.concept}`, 9, 12, C.heading);
            if (c.definition) this.bodyText(c.definition, 9, 20);
          });
        }

        // Pergunta de reflexão
        if (ch.reflectionQuestion) {
          this.gap(4);
          this.ensure(28);
          this.pg.drawText('Reflexão:', { x: MX + 8, y: this.curY, size: 8, font: this.bold, color: C.accent });
          this.curY -= 12;
          this.bodyText(ch.reflectionQuestion, 9, 16, C.meta);
        }

        this.hLine(C.hr, 0.4);
      });
    }

    // Checkpoints
    if (g.checkpoints?.length) {
      this.sectionHeading('Checkpoints');
      g.checkpoints.forEach((cp, i) => this.checkpoint(cp, i));
    }

    this.paintFooters();
    return this.pdfDoc.save();
  }
}

export async function exportGuidePdf(guide: StudyGuide): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const layout = new PdfLayout();
  layout.init(guide, pdfDoc, font, bold);
  const bytes = await layout.generate();

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (guide.title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'neurostudy';
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
