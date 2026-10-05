// Amministrazione: miniatura di una foto dei concerti, anche nascosta
import type { APIRoute } from 'astro';
import { serviMiniatura } from '../../../../area/file';

export const prerender = false;
export const GET: APIRoute = ({ params }) => serviMiniatura(params.id, true);
