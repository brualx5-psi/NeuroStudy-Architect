/**
 * Consolidated AI Endpoint (Hobby plan friendly)
 *
 * POST /api/ai?action=<route>
 * routes:
 * - roadmap
 * - tool
 * - diagram
 * - diagram-svg
 * - slides
 * - quiz
 * - evaluate
 * - flashcards
 * - chat
 * - web-research
 */

import { sendJson } from './_lib/http.js';

import roadmapHandler from './_handlers/ai/roadmap.js';
import toolHandler from './_handlers/ai/tool.js';
import diagramHandler from './_handlers/ai/diagram.js';
import diagramSvgHandler from './_handlers/ai/diagram-svg.js';
import slidesHandler from './_handlers/ai/slides.js';
import quizHandler from './_handlers/ai/quiz.js';
import evaluateHandler from './_handlers/ai/evaluate.js';
import flashcardsHandler from './_handlers/ai/flashcards.js';
import chatHandler from './_handlers/ai/chat.js';
import webResearchHandler from './_handlers/ai/web-research.js';

const ROUTES: Record<string, (req: any, res: any) => any> = {
  roadmap: roadmapHandler,
  tool: toolHandler,
  diagram: diagramHandler,
  'diagram-svg': diagramSvgHandler,
  slides: slidesHandler,
  quiz: quizHandler,
  evaluate: evaluateHandler,
  flashcards: flashcardsHandler,
  chat: chatHandler,
  'web-research': webResearchHandler,
};

export default async function handler(req: any, res: any) {
  // CORS (safe default)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = String(req.query?.action || '').trim();
  const route = ROUTES[action];
  if (!route) {
    return sendJson(res, 400, { error: 'invalid_action', action });
  }

  return route(req, res);
}
