// Amministrazione: una foto dei concerti intera, anche nascosta
import type { APIRoute } from 'astro';
import { serviFile } from '../../../../area/file';

export const prerender = false;
export const GET: APIRoute = ({ params, request }) => serviFile(params.id, request, true);
