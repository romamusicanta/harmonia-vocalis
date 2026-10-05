// Area coristi: miniatura di una foto dei concerti (non nascosta), per la galleria
import type { APIRoute } from 'astro';
import { serviMiniatura } from '../../../../area/file';

export const prerender = false;
export const GET: APIRoute = ({ params }) => serviMiniatura(params.id);
