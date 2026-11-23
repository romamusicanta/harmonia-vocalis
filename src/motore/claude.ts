// I modelli di Claude usati dal sito (traduzioni inglesi, lettura delle locandine), con l'API di
// Anthropic e la chiave ANTHROPIC_API_KEY (dal 23/11/2026; prima attraverso l'AI Gateway di Vercel).
// La chiave si legge alla prima richiesta: sulla VPS sta in app.env, in locale in .env.local.
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic();

// Vede le immagini e dà output strutturato: locandine, testi del sito, campi inglesi dei concerti
export const SONNET = anthropic('claude-sonnet-5-5');
// Le frasi dei concerti e dei video tradotte alla build
export const HAIKU = anthropic('claude-haiku-4-5');
