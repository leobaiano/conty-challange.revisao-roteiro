import { DateTime } from 'luxon';

export const FUSO_MARCA = 'America/Sao_Paulo';

const SOMENTE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface Prazo {
  /** Dia do prazo no fuso da marca, YYYY-MM-DD. */
  dia: string;
  /** Último instante (ms) em que o prazo ainda vale: 23:59:59.999 no fuso da marca. */
  ultimoInstante: DateTime;
  /** Primeiro instante do dia seguinte no fuso da marca. A partir dele o prazo venceu. */
  vencidoEm: DateTime;
}

/**
 * Interpreta o prazo como um dia de calendário no fuso da marca.
 * Aceita só "YYYY-MM-DD": horário ou offset não fazem parte do contrato.
 * Retorna null se o valor não for uma data válida.
 */
export function interpretarPrazo(valor: unknown): Prazo | null {
  if (typeof valor !== 'string' || !SOMENTE_DATA.test(valor)) return null;
  const inicioDoDia = DateTime.fromISO(valor, { zone: FUSO_MARCA });
  if (!inicioDoDia.isValid) return null;
  // startOf('day') em vez de somar 24h: respeita dias com mudança de horário.
  const vencidoEm = inicioDoDia.plus({ days: 1 }).startOf('day');
  return { dia: valor, ultimoInstante: vencidoEm.minus({ milliseconds: 1 }), vencidoEm };
}

/** O prazo vale enquanto o relógio estiver antes do primeiro instante do dia seguinte. */
export function prazoVigente(vencidoEmMs: number, agora: Date): boolean {
  return agora.getTime() < vencidoEmMs;
}
