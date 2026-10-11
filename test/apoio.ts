import { criarApp } from '../src/app.ts';
import type { Relogio } from '../src/relogio.ts';

/** Relógio controlado pelo teste. */
export class RelogioFixo implements Relogio {
  #agora: Date;

  constructor(iso: string) {
    this.#agora = new Date(iso);
  }

  agora(): Date {
    return new Date(this.#agora);
  }

  ajustar(iso: string): void {
    this.#agora = new Date(iso);
  }
}

export function montar(iso = '2026-03-01T12:00:00-03:00') {
  const relogio = new RelogioFixo(iso);
  const app = criarApp({ relogio });

  const post = async (url: string, payload?: unknown) => {
    const res = await app.inject({ method: 'POST', url, payload: payload as object });
    return { status: res.statusCode, body: res.json() };
  };
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url });
    return { status: res.statusCode, body: res.json() };
  };

  const criarRoteiro = async () => {
    const res = await post('/roteiros', { titulo: 'Campanha verão', conteudo: 'v1: abre na praia' });
    return res.body.id as string;
  };

  return { app, relogio, post, get, criarRoteiro };
}
