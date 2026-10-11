import { describe, expect, it } from 'vitest';
import { montar } from './apoio.ts';

const PEDIDO = { versao: 1, motivo: 'Trocar a abertura', prazo: '2026-03-10' };

describe('fluxo completo', () => {
  it('criação → pedido de alteração → nova versão → aprovação, sempre com o estado explícito', async () => {
    const t = montar();

    const criado = await t.post('/roteiros', { titulo: 'Campanha verão', conteudo: 'v1' });
    expect(criado.status).toBe(201);
    expect(criado.body).toMatchObject({
      status: 'aguardando_revisao',
      versaoAtual: 1,
      aguardando: 'marca',
      acoesPermitidas: ['aprovar', 'solicitar_alteracao'],
      pedidoPendente: null,
    });
    const id = criado.body.id;

    const pedido = await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    expect(pedido.status).toBe(201);
    expect(pedido.body).toMatchObject({
      status: 'alteracao_solicitada',
      aguardando: 'criador',
      acoesPermitidas: ['enviar_nova_versao'],
      pedidoPendente: { motivo: 'Trocar a abertura', prazo: '2026-03-10' },
    });
    expect(pedido.body.versoes[0].status).toBe('alteracao_solicitada');

    const v2 = await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2' });
    expect(v2.status).toBe(201);
    expect(v2.body).toMatchObject({ status: 'aguardando_revisao', versaoAtual: 2, aguardando: 'marca' });

    const aprovado = await t.post(`/roteiros/${id}/aprovacao`, { versao: 2 });
    expect(aprovado.status).toBe(200);
    expect(aprovado.body).toMatchObject({ status: 'aprovado', aguardando: null, acoesPermitidas: [] });
    expect(aprovado.body.versoes.map((v: { status: string }) => v.status)).toEqual([
      'alteracao_solicitada',
      'aprovada',
    ]);
  });
});

describe('versões antigas', () => {
  it('continuam intactas, com o pedido de alteração que receberam', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2: abre na cidade' });
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, { versao: 2, motivo: 'Mais curto', prazo: '2026-03-12' });
    await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v3: curto' });

    const { body } = await t.get(`/roteiros/${id}`);
    expect(body.versoes).toHaveLength(3);
    expect(body.versoes[0]).toMatchObject({
      numero: 1,
      conteudo: 'v1: abre na praia',
      status: 'alteracao_solicitada',
      solicitacaoAlteracao: { motivo: 'Trocar a abertura', prazo: '2026-03-10' },
    });
    expect(body.versoes[1]).toMatchObject({
      numero: 2,
      conteudo: 'v2: abre na cidade',
      solicitacaoAlteracao: { motivo: 'Mais curto', prazo: '2026-03-12' },
    });
    expect(body.versoes[2]).toMatchObject({ numero: 3, conteudo: 'v3: curto', status: 'em_revisao' });

    const v1 = await t.get(`/roteiros/${id}/versoes/1`);
    expect(v1.body.conteudo).toBe('v1: abre na praia');
  });
});

describe('pedido de alteração', () => {
  it.each([
    ['sem motivo', { versao: 1, prazo: '2026-03-10' }],
    ['com motivo vazio', { versao: 1, motivo: '   ', prazo: '2026-03-10' }],
    ['sem prazo', { versao: 1, motivo: 'Trocar a abertura' }],
    ['com prazo nulo', { versao: 1, motivo: 'Trocar a abertura', prazo: null }],
    ['sem versão', { motivo: 'Trocar a abertura', prazo: '2026-03-10' }],
  ])('%s não passa e não muda o estado', async (_caso, corpo) => {
    const t = montar();
    const id = await t.criarRoteiro();
    const res = await t.post(`/roteiros/${id}/solicitacoes-alteracao`, corpo);
    expect(res.status).toBe(400);
    expect(res.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect((await t.get(`/roteiros/${id}`)).body.status).toBe('aguardando_revisao');
  });

  it('sem corpo não passa', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    expect((await t.post(`/roteiros/${id}/solicitacoes-alteracao`)).status).toBe(400);
  });

  it('não pode ser feito duas vezes antes da nova versão', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    const res = await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('TRANSICAO_INVALIDA');
  });

  it('sobre versão que não é a atual é recusado', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2' });
    const res = await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('VERSAO_DESATUALIZADA');
  });
});

describe('nova versão', () => {
  it('só é aceita depois de um pedido de alteração', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    const res = await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2' });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('TRANSICAO_INVALIDA');
  });

  it('exige conteúdo', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    expect((await t.post(`/roteiros/${id}/versoes`, { conteudo: '' })).status).toBe(400);
  });
});

describe('roteiro aprovado', () => {
  async function aprovado() {
    const t = montar();
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/aprovacao`, { versao: 1 });
    return { t, id };
  }

  it('não aceita nova versão', async () => {
    const { t, id } = await aprovado();
    const res = await t.post(`/roteiros/${id}/versoes`, { conteudo: 'v2' });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('ROTEIRO_APROVADO');
  });

  it('não aceita novo pedido de alteração', async () => {
    const { t, id } = await aprovado();
    const res = await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('ROTEIRO_APROVADO');
  });

  it('não é aprovado de novo e continua igual', async () => {
    const { t, id } = await aprovado();
    const antes = (await t.get(`/roteiros/${id}`)).body;
    const res = await t.post(`/roteiros/${id}/aprovacao`, { versao: 1 });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('ROTEIRO_APROVADO');
    expect((await t.get(`/roteiros/${id}`)).body).toEqual(antes);
  });
});

describe('aprovação', () => {
  it('não acontece enquanto há pedido aguardando nova versão', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    await t.post(`/roteiros/${id}/solicitacoes-alteracao`, PEDIDO);
    const res = await t.post(`/roteiros/${id}/aprovacao`, { versao: 1 });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('TRANSICAO_INVALIDA');
  });

  it('exige informar a versão atual', async () => {
    const t = montar();
    const id = await t.criarRoteiro();
    expect((await t.post(`/roteiros/${id}/aprovacao`, {})).status).toBe(400);
    expect((await t.post(`/roteiros/${id}/aprovacao`, { versao: 2 })).body.erro.codigo).toBe('VERSAO_DESATUALIZADA');
  });
});

describe('erros gerais', () => {
  it('roteiro inexistente responde 404', async () => {
    const t = montar();
    const res = await t.get('/roteiros/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('ROTEIRO_NAO_ENCONTRADO');
  });

  it('criação exige título e conteúdo', async () => {
    const t = montar();
    expect((await t.post('/roteiros', { titulo: 'x' })).status).toBe(400);
    expect((await t.post('/roteiros', { conteudo: 'x' })).status).toBe(400);
  });
});
