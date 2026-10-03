// Un file del Drive del coro (spartito, brano, registrazione), servito dal sito: vedi src/area/file.ts
import type { APIRoute } from 'astro';
import { serviFile } from '../../../area/file';

export const prerender = false;
export const GET: APIRoute = ({ params, request }) => serviFile(params.id, request);
