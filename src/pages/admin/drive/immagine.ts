// Un'immagine del Drive condiviso, letta a nome di chi è entrato: per le anteprime dell'area
// (foto del sito non ancora pubblicate, locandine e foto allegate ai concerti). /admin/drive/immagine?id=…
import type { APIRoute } from 'astro';
import { immagineDrive } from '../../../admin/operazioni';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const id = url.searchParams.get('id') ?? '';
  if (!/^[\w-]+$/.test(id)) return new Response('Identificativo non valido', { status: 400 });
  try {
    return await immagineDrive(locals.sessione!, id);
  } catch (e) {
    return new Response((e as Error).message, { status: 404 });
  }
};
