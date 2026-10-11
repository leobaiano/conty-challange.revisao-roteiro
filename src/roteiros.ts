import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { FUSO_MARCA, interpretarPrazo, prazoVigente } from './prazo.ts';
import type { Relogio } from './relogio.ts';

/**
 * aguardando_revisao   -> a marca precisa aprovar ou pedir alteração da versão atual
 * alteracao_solicitada -> o criador precisa enviar uma nova versão
 * aprovado             -> terminal: nada mais muda
 */
export type StatusRoteiro = 'aguardando_revisao' | 'alteracao_solicitada' | 'aprovado';

/**
 * em_revisao           -> versão atual, esperando decisão da marca
 * alteracao_solicitada -> a marca pediu alteração nesta versão (fica no histórico)
 * aprovada             -> versão aprovada (só uma por roteiro)
 */
export type StatusVersao = 'em_revisao' | 'alteracao_solicitada' | 'aprovada';

export interface SolicitacaoAlteracao {
  motivo: string;
  prazo: string;
  prazoUltimoInstante: string;
  prazoVencidoEm: string;
  solicitadaEm: string;
}

export interface Versao {
  numero: number;
  conteudo: string;
  status: StatusVersao;
  enviadaEm: string;
  /** Para versões que respondem a um pedido: se chegaram antes do prazo vencer. */
  enviadaDentroDoPrazo: boolean | null;
  solicitacaoAlteracao: SolicitacaoAlteracao | null;
  aprovadaEm: string | null;
}

export interface Roteiro {
  id: string;
  titulo: string;
  status: StatusRoteiro;
  versaoAtual: number;
  criadoEm: string;
  aprovadoEm: string | null;
  versoes: Versao[];
}

export type Acao = 'aprovar' | 'solicitar_alteracao' | 'enviar_nova_versao';

export class ErroDominio extends Error {
  readonly codigo: string;
  readonly status: number;

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

const invalido = (mensagem: string) => new ErroDominio(400, 'DADOS_INVALIDOS', mensagem);

export class RepositorioEmMemoria {
  #roteiros = new Map<string, Roteiro>();

  // Cópias na entrada e na saída: ninguém altera o histórico por referência.
  salvar(roteiro: Roteiro): void {
    this.#roteiros.set(roteiro.id, structuredClone(roteiro));
  }

  buscar(id: string): Roteiro | null {
    const roteiro = this.#roteiros.get(id);
    return roteiro ? structuredClone(roteiro) : null;
  }

  listar(): Roteiro[] {
    return [...this.#roteiros.values()].map((r) => structuredClone(r));
  }
}

function corpo(entrada: unknown): Record<string, unknown> {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    throw invalido('O corpo da requisição deve ser um objeto JSON.');
  }
  return entrada as Record<string, unknown>;
}

function textoObrigatorio(dados: Record<string, unknown>, campo: string): string {
  const valor = dados[campo];
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw invalido(`O campo "${campo}" é obrigatório e não pode ser vazio.`);
  }
  return valor.trim();
}

function numeroDaVersao(dados: Record<string, unknown>): number {
  const valor = dados.versao;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1) {
    throw invalido('O campo "versao" é obrigatório e deve ser o número da versão revisada.');
  }
  return valor;
}

function versaoAtual(roteiro: Roteiro): Versao {
  return roteiro.versoes[roteiro.versoes.length - 1];
}

export class ServicoRoteiros {
  #repo: RepositorioEmMemoria;
  #relogio: Relogio;

  constructor(repo: RepositorioEmMemoria, relogio: Relogio) {
    this.#repo = repo;
    this.#relogio = relogio;
  }

  #agoraIso(): string {
    return this.#relogio.agora().toISOString();
  }

  criar(entrada: unknown): Roteiro {
    const dados = corpo(entrada);
    const titulo = textoObrigatorio(dados, 'titulo');
    const conteudo = textoObrigatorio(dados, 'conteudo');
    const agora = this.#agoraIso();
    const roteiro: Roteiro = {
      id: randomUUID(),
      titulo,
      status: 'aguardando_revisao',
      versaoAtual: 1,
      criadoEm: agora,
      aprovadoEm: null,
      versoes: [
        {
          numero: 1,
          conteudo,
          status: 'em_revisao',
          enviadaEm: agora,
          enviadaDentroDoPrazo: null,
          solicitacaoAlteracao: null,
          aprovadaEm: null,
        },
      ],
    };
    this.#repo.salvar(roteiro);
    return roteiro;
  }

  listar(): Roteiro[] {
    return this.#repo.listar();
  }

  obter(id: string): Roteiro {
    const roteiro = this.#repo.buscar(id);
    if (!roteiro) throw new ErroDominio(404, 'ROTEIRO_NAO_ENCONTRADO', 'Roteiro não encontrado.');
    return roteiro;
  }

  solicitarAlteracao(id: string, entrada: unknown): Roteiro {
    const roteiro = this.obter(id);
    this.#exigirRevisaoPendente(roteiro, 'pedir alteração', 'pedido de alteração');
    const dados = corpo(entrada);
    this.#exigirVersaoAtual(roteiro, numeroDaVersao(dados));
    const motivo = textoObrigatorio(dados, 'motivo');
    if (dados.prazo === undefined || dados.prazo === null || dados.prazo === '') {
      throw invalido('O campo "prazo" é obrigatório (dia no formato YYYY-MM-DD).');
    }
    const prazo = interpretarPrazo(dados.prazo);
    if (!prazo) throw invalido('O campo "prazo" deve ser uma data válida no formato YYYY-MM-DD.');

    const agora = this.#relogio.agora();
    if (!prazoVigente(prazo.vencidoEm.toMillis(), agora)) {
      const hoje = DateTime.fromJSDate(agora, { zone: FUSO_MARCA }).toISODate();
      throw new ErroDominio(
        422,
        'PRAZO_VENCIDO',
        `O prazo ${prazo.dia} já passou no fuso ${FUSO_MARCA} (hoje é ${hoje}).`,
      );
    }

    const versao = versaoAtual(roteiro);
    versao.status = 'alteracao_solicitada';
    versao.solicitacaoAlteracao = {
      motivo,
      prazo: prazo.dia,
      prazoUltimoInstante: prazo.ultimoInstante.toISO()!,
      prazoVencidoEm: prazo.vencidoEm.toISO()!,
      solicitadaEm: agora.toISOString(),
    };
    roteiro.status = 'alteracao_solicitada';
    this.#repo.salvar(roteiro);
    return roteiro;
  }

  enviarNovaVersao(id: string, entrada: unknown): Roteiro {
    const roteiro = this.obter(id);
    if (roteiro.status === 'aprovado') throw this.#erroAprovado('nova versão');
    if (roteiro.status !== 'alteracao_solicitada') {
      throw new ErroDominio(
        409,
        'TRANSICAO_INVALIDA',
        `Nova versão só pode ser enviada depois de um pedido de alteração (status atual: ${roteiro.status}).`,
      );
    }
    const conteudo = textoObrigatorio(corpo(entrada), 'conteudo');
    const agora = this.#relogio.agora();
    const pedido = versaoAtual(roteiro).solicitacaoAlteracao!;
    const numero = roteiro.versaoAtual + 1;
    roteiro.versoes.push({
      numero,
      conteudo,
      status: 'em_revisao',
      enviadaEm: agora.toISOString(),
      enviadaDentroDoPrazo: prazoVigente(Date.parse(pedido.prazoVencidoEm), agora),
      solicitacaoAlteracao: null,
      aprovadaEm: null,
    });
    roteiro.versaoAtual = numero;
    roteiro.status = 'aguardando_revisao';
    this.#repo.salvar(roteiro);
    return roteiro;
  }

  aprovar(id: string, entrada: unknown): Roteiro {
    const roteiro = this.obter(id);
    this.#exigirRevisaoPendente(roteiro, 'aprovar', 'nova aprovação');
    this.#exigirVersaoAtual(roteiro, numeroDaVersao(corpo(entrada)));
    const agora = this.#agoraIso();
    const versao = versaoAtual(roteiro);
    versao.status = 'aprovada';
    versao.aprovadaEm = agora;
    roteiro.status = 'aprovado';
    roteiro.aprovadoEm = agora;
    this.#repo.salvar(roteiro);
    return roteiro;
  }

  #exigirRevisaoPendente(roteiro: Roteiro, acao: string, recusadoSeAprovado: string): void {
    if (roteiro.status === 'aprovado') throw this.#erroAprovado(recusadoSeAprovado);
    if (roteiro.status !== 'aguardando_revisao') {
      throw new ErroDominio(
        409,
        'TRANSICAO_INVALIDA',
        `Não é possível ${acao}: já existe pedido de alteração aguardando nova versão do criador.`,
      );
    }
  }

  // A marca diz qual versão revisou; se o criador mandou outra no meio, a decisão não vale.
  #exigirVersaoAtual(roteiro: Roteiro, numero: number): void {
    if (numero !== roteiro.versaoAtual) {
      throw new ErroDominio(
        409,
        'VERSAO_DESATUALIZADA',
        `A versão ${numero} não é a atual (atual: ${roteiro.versaoAtual}).`,
      );
    }
  }

  #erroAprovado(oQue: string): ErroDominio {
    return new ErroDominio(409, 'ROTEIRO_APROVADO', `Roteiro aprovado não aceita ${oQue}.`);
  }
}

const ACOES: Record<StatusRoteiro, { aguardando: 'marca' | 'criador' | null; acoes: Acao[] }> = {
  aguardando_revisao: { aguardando: 'marca', acoes: ['aprovar', 'solicitar_alteracao'] },
  alteracao_solicitada: { aguardando: 'criador', acoes: ['enviar_nova_versao'] },
  aprovado: { aguardando: null, acoes: [] },
};

/** Representação pública: estado + quem deve agir + o que pode ser feito agora. */
export function apresentar(roteiro: Roteiro, agora: Date) {
  const { aguardando, acoes } = ACOES[roteiro.status];
  const pedido =
    roteiro.status === 'alteracao_solicitada' ? versaoAtual(roteiro).solicitacaoAlteracao : null;
  return {
    ...roteiro,
    aguardando,
    acoesPermitidas: acoes,
    pedidoPendente: pedido && {
      ...pedido,
      prazoVencido: !prazoVigente(Date.parse(pedido.prazoVencidoEm), agora),
    },
  };
}
