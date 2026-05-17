#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const gemini = readFileSync('api/_lib/gemini.ts', 'utf8');

const requiredSnippets = [
  "flash: process.env.GEMINI_MODEL_FLASH || 'gemini-2.5-flash'",
  "pro: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro'",
  "experimental: process.env.GEMINI_MODEL_EXPERIMENTAL || 'gemini-3.1-pro-preview'",
  "const MODEL_PRO_FALLBACK = process.env.GEMINI_MODEL_PRO_FALLBACK || 'gemini-2.5-pro'",
  "const GEMINI_3_VERTEX_LOCATION = process.env.GEMINI_3_VERTEX_LOCATION || process.env.GEMINI_PREVIEW_VERTEX_LOCATION || 'global'",
  "const GEMINI_3_API_VERSION = process.env.GEMINI_3_API_VERSION || process.env.GEMINI_PREVIEW_API_VERSION || 'v1beta'",
  'const getVertexLocationForModel = (model: string) =>',
  'if (isGemini3Model(model)) return GEMINI_3_VERTEX_LOCATION',
  'const getApiVersionForModel = (model: string) =>',
  'const getClient = (location: string = DEFAULT_VERTEX_LOCATION, apiVersion: string = DEFAULT_VERTEX_API_VERSION)',
  'const vertexClients = new Map<string, GoogleGenAI>()',
  'const cacheKey = `${project}:${location}:${apiVersion}`',
  'location=${location} apiVersion=${apiVersion}',
  'const getModelFallback = (model: string, error: any) =>',
  'isModelAvailabilityError(error)',
];

const forbiddenSnippets = [
  "flash: process.env.GEMINI_MODEL_FLASH || 'gemini-2.0-flash'",
  "pro: process.env.GEMINI_MODEL_PRO || 'gemini-pro-latest'",
  'const ai = getClient();',
  'error?.status === 400 ||',
];

const missing = requiredSnippets.filter((snippet) => !gemini.includes(snippet));
const forbidden = forbiddenSnippets.filter((snippet) => gemini.includes(snippet));

if (missing.length || forbidden.length) {
  console.error('Falha na verificação de roteamento Gemini/Vertex.');
  if (missing.length) {
    console.error('\nTrechos obrigatórios ausentes:');
    for (const item of missing) console.error(`- ${item}`);
  }
  if (forbidden.length) {
    console.error('\nTrechos proibidos ainda presentes:');
    for (const item of forbidden) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log('OK: roteamento Gemini/Vertex preparado para 2.5 estável e 3.x global/preview.');
