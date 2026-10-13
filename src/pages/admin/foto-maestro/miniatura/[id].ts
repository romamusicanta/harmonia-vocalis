// Foto del sito → Il Maestro: miniatura di una foto della cartella Sito/Foto/Maestro
import type { APIRoute } from 'astro';
import { miniaturaMaestro } from '../../../../admin/fotoMaestro';

export const prerender = false;
export const GET: APIRoute = ({ params }) => miniaturaMaestro(params.id ?? '');
