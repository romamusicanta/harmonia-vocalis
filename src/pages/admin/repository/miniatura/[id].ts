// Chorus Repository: miniatura di un file, per la finestra «Importa»
import type { APIRoute } from 'astro';
import { miniaturaRepository } from '../../../../admin/repository';
import { inDemo } from '../../../../area/demo';

export const prerender = false;
export const GET: APIRoute = ({ params }) => inDemo() ? new Response('Non nella demo', { status: 403 }) : miniaturaRepository(params.id ?? '');
