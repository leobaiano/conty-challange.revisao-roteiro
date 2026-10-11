import { describe, expect, it } from 'vitest';
import { interpretarPrazo } from '../src/prazo.ts';
import { montar } from './apoio.ts';

async function pedirComPrazo(agora: string, prazo: string) {
  const t = montar('2026-03-01T12:00:00-03:00');
  const id = await t.criarRoteiro();
  t.relogio.ajustar(agora);
  return t.post(`/roteiros/${id}/solicitacoes-alteracao`, { versao: 1, motivo: 'Trocar a abertura', prazo });
}

describe('prazo no fuso da marca (America/Sao_Paulo)', () => {
  it('aceita o pedido no último instante do dia do prazo', async () => {
    // 23:59:59.999 em São Paulo = 02:59:59.999Z do dia seguinte
    const res = await pedirComPrazo('2026-03-11T02:59:59.999Z', '2026-03-10');
    expect(res.status).toBe(201);
    expect(res.body.pedidoPendente).toMatchObject({
      prazo: '2026-03-10',
      prazoUltimoInstante: '2026-03-10T23:59:59.999-03:00',
      prazoVencidoEm: '2026-03-11T00:00:00.000-03:00',
      prazoVencido: false,
    });
  });

  it('recusa o pedido no primeiro instante do dia seguinte', async () => {
    const res = await pedirComPrazo('2026-03-11T03:00:00.000Z', '2026-03-10');
    expect(res.status).toBe(422);
    expect(res.body.erro.codigo).toBe('PRAZO_VENCIDO');
  });

  it('não vira o dia quando o UTC já virou mas São Paulo ainda não', async () => {
    // 22:30 do dia 10 em São Paulo; em UTC já é dia 11.
    const res = await pedirComPrazo('2026-03-11T01:30:00Z', '2026-03-10');
    expect(res.status).toBe(201);
  });

  it('recusa prazo de ontem no fuso da marca', async () => {
    // 00:30 do dia 11 em São Paulo (03:30Z): o dia 10 já acabou.
    expect((await pedirComPrazo('2026-03-11T03:30:00Z', '2026-03-10')).status).toBe(422);
  });

  it('aceita prazo para hoje e para o futuro', async () => {
    expect((await pedirComPrazo('2026-03-10T09:00:00-03:00', '2026-03-10')).status).toBe(201);
    expect((await pedirComPrazo('2026-03-10T09:00:00-03:00', '2026-04-01')).status).toBe(201);
  });

  it('usa a regra de fuso real, não um offset fixo de -03:00', () => {
    // Em 2018-11-04 São Paulo entrou em horário de verão: meia-noite pulou para 01:00 (-02:00).
    const prazo = interpretarPrazo('2018-11-03')!;
    expect(prazo.vencidoEm.toISO()).toBe('2018-11-04T01:00:00.000-02:00');
    expect(prazo.vencidoEm.toUTC().toISO()).toBe('2018-11-04T03:00:00.000Z');
  });

  it.each(['10/03/2026', '2026-02-30', '2026-03-10T23:00:00-03:00', 20260310, 'amanhã'])(
    'recusa prazo em formato inválido: %s',
    async (prazo) => {
      const t = montar();
      const id = await t.criarRoteiro();
      const res = await t.post(`/roteiros/${id}/solicitacoes-alteracao`, { versao: 1, motivo: 'x', prazo });
      expect(res.status).toBe(400);
      expect(res.body.erro.codigo).toBe('DADOS_INVALIDOS');
    },
  );
});

describe('pedido pendente com prazo vencido', () => {
  it('aparece como vencido e a versão enviada depois fica marcada fora do prazo', async () => {
    const t = montar('2026-03-10T10:00:00-03:00');
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, { versao: 1, motivo: 'Trocar a abertura', prazo: '2026-03-10' });

    t.relogio.ajustar('2026-03-10T23:59:59.999-03:00');
    expect((await t.get(`/roteiros/${id}`)).body.pedidoPendente.prazoVencido).toBe(false);

    t.relogio.ajustar('2026-03-11T00:00:00.000-03:00');
    expect((await t.get(`/roteiros/${id}`)).body.pedidoPendente.prazoVencido).toBe(true);

    const res = await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2 atrasada' });
    expect(res.status).toBe(201);
    expect(res.body.versoes[1].enviadaDentroDoPrazo).toBe(false);
  });

  it('versão enviada no último instante conta como dentro do prazo', async () => {
    const t = montar('2026-03-10T10:00:00-03:00');
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, { versao: 1, motivo: 'Trocar a abertura', prazo: '2026-03-10' });
    t.relogio.ajustar('2026-03-10T23:59:59.999-03:00');
    const res = await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2 no limite' });
    expect(res.body.versoes[1].enviadaDentroDoPrazo).toBe(true);
  });
});
