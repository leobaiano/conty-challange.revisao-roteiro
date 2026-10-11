import Fastify, { type FastifyError } from 'fastify';
import { ErroDominio, RepositorioEmMemoria, ServicoRoteiros, apresentar } from './roteiros.ts';
import { relogioDoSistema, type Relogio } from './relogio.ts';

interface Opcoes {
  relogio?: Relogio;
  logger?: boolean;
}

export function criarApp({ relogio = relogioDoSistema, logger = false }: Opcoes = {}) {
  const app = Fastify({ logger });
  const servico = new ServicoRoteiros(new RepositorioEmMemoria(), relogio);
  const responder = (roteiro: Parameters<typeof apresentar>[0]) => apresentar(roteiro, relogio.agora());

  type ComId = { Params: { id: string } };

  app.post('/roteiros', async (req, reply) => {
    reply.code(201);
    return responder(servico.criar(req.body));
  });

  app.get('/roteiros', async () => servico.listar().map(responder));

  app.get<ComId>('/roteiros/:id', async (req) => responder(servico.obter(req.params.id)));

  app.get<{ Params: { id: string; numero: string } }>('/roteiros/:id/versoes/:numero', async (req) => {
    const versao = servico.obter(req.params.id).versoes.find((v) => String(v.numero) === req.params.numero);
    if (!versao) throw new ErroDominio(404, 'VERSAO_NAO_ENCONTRADA', 'Versão não encontrada.');
    return versao;
  });

  app.post<ComId>('/roteiros/:id/versoes', async (req, reply) => {
    reply.code(201);
    return responder(servico.enviarNovaVersao(req.params.id, req.body));
  });

  app.post<ComId>('/roteiros/:id/solicitacoes-alteracao', async (req, reply) => {
    reply.code(201);
    return responder(servico.solicitarAlteracao(req.params.id, req.body));
  });

  app.post<ComId>('/roteiros/:id/aprovacao', async (req) => responder(servico.aprovar(req.params.id, req.body)));

  app.setErrorHandler((erro: FastifyError | ErroDominio, _req, reply) => {
    if (erro instanceof ErroDominio) {
      return reply.code(erro.status).send({ erro: { codigo: erro.codigo, mensagem: erro.message } });
    }
    const status = erro.statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: erro.message } });
    }
    app.log.error(erro);
    return reply.code(500).send({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.' } });
  });

  return app;
}
