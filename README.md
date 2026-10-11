# Revisão de roteiro

API para a marca e o criador revisarem um roteiro em versões, com estado explícito e histórico.

## Como rodar

Requer Node.js 22.18+ (roda TypeScript direto, sem build).

```bash
npm install
npm test            # testes (vitest)
npm run typecheck   # tsc
npm start           # API em http://localhost:3000 (PORT para mudar)
npm run exemplos    # regenera docs/exemplos.md com chamadas reais
```

## Modelo

Um **roteiro** tem uma lista de **versões** que só cresce. Toda resposta traz o estado, quem deve agir e o que dá para fazer agora:

```json
{ "status": "alteracao_solicitada", "aguardando": "criador", "acoesPermitidas": ["enviar_nova_versao"], "pedidoPendente": { ... } }
```

| Status do roteiro      | Quem age | Ações possíveis                          |
|------------------------|----------|------------------------------------------|
| `aguardando_revisao`   | marca    | `aprovar`, `solicitar_alteracao`         |
| `alteracao_solicitada` | criador  | `enviar_nova_versao`                     |
| `aprovado`             | ninguém  | nenhuma (terminal)                       |

Cada versão tem seu status (`em_revisao`, `alteracao_solicitada`, `aprovada`). O pedido de alteração fica guardado na versão que ele pediu para mudar, então o histórico mostra o que foi pedido em cada versão e o que veio em resposta.

## Endpoints

| Método | Rota                                     | Corpo                                    |
|--------|------------------------------------------|------------------------------------------|
| POST   | `/roteiros`                              | `{ titulo, conteudo }` → versão 1        |
| GET    | `/roteiros` · `/roteiros/:id`            |                                          |
| GET    | `/roteiros/:id/versoes/:numero`          |                                          |
| POST   | `/roteiros/:id/solicitacoes-alteracao`   | `{ versao, motivo, prazo: "YYYY-MM-DD" }`|
| POST   | `/roteiros/:id/versoes`                  | `{ conteudo }`                           |
| POST   | `/roteiros/:id/aprovacao`                | `{ versao }`                             |

Erros vêm como `{ "erro": { "codigo", "mensagem" } }`:
`400 DADOS_INVALIDOS` (motivo/prazo/versão ausente ou inválido), `404`, `409 ROTEIRO_APROVADO`, `409 TRANSICAO_INVALIDA`, `409 VERSAO_DESATUALIZADA`, `422 PRAZO_VENCIDO`.

Exemplos completos de request e response: [docs/exemplos.md](docs/exemplos.md).

## Regras e decisões

- **Prazo é um dia, não um instante.** Só aceita `YYYY-MM-DD`; horário ou offset são recusados. O dia é interpretado em `America/Sao_Paulo` com a regra de fuso real (Luxon/IANA), não com `-03:00` fixo.
- **O prazo vale enquanto `agora < 00:00 do dia seguinte em São Paulo`.** Isso inclui 23:59:59.999 e qualquer fração depois dele. A resposta mostra `prazoUltimoInstante` e `prazoVencidoEm`.
- **Pedido com prazo já passado é recusado** (`422`). Prazo para hoje é aceito.
- **A marca informa a `versao` que está aprovando ou mandando alterar.** Se não for a versão atual, a resposta é `409`. Assim ninguém aprova uma versão que não viu.
- **Nova versão só depois de um pedido de alteração.** Enquanto a versão atual está em revisão, o criador espera.
- **Se o prazo de um pedido pendente vence**, o pedido continua no histórico com `prazoVencido: true`. O criador ainda pode enviar a versão, que fica marcada com `enviadaDentroDoPrazo: false`. Preferi registrar o atraso a travar o roteiro, porque o enunciado não diz o que fazer nesse caso.
- **Aprovação é terminal.** Depois dela, nova versão, novo pedido e nova aprovação respondem `409 ROTEIRO_APROVADO`, e o roteiro não muda.
- O relógio é injetado (`Relogio`), e os testes controlam o instante exato.

## Testes

- `test/prazo.test.ts`: último instante do dia (`23:59:59.999` em SP = `02:59:59.999Z`) aceito, primeiro instante do dia seguinte (`03:00:00.000Z`) recusado, UTC já virou e SP não, dia com horário de verão histórico (2018), formatos inválidos, pedido pendente que vence.
- `test/fluxo.test.ts`: fluxo completo, versões antigas preservadas, motivo/prazo/versão obrigatórios, transições inválidas, roteiro aprovado imutável.

Conferi que alguns testes de prazo falham se a comparação virar `<=` ou se o dia for calculado em UTC.

## O que ficou de fora

- **Persistência:** os dados ficam em memória e somem quando o processo reinicia.
- **Autenticação e papéis:** qualquer um chama qualquer rota. Hoje "marca" e "criador" existem só nos nomes das ações.
- **Concorrência entre processos:** a checagem de `versao` evita decisão sobre versão errada dentro de um processo. Com banco, isso exigiria lock otimista ou transação.
- Sem paginação, sem fuso por marca (fixo em São Paulo), sem notificações.

## O que eu faria diferente com mais tempo

- Banco (Postgres) com a tabela de versões só aceitando insert, e transição de estado com `UPDATE ... WHERE status = ?` para não ter corrida.
- Guardar o fuso na marca, em vez de usar uma constante, e gravar o fuso junto com o pedido.
- Papéis com autenticação: só a marca do roteiro pede alteração e aprova, só o criador envia versão.
- Decidir com o produto o que acontece quando o prazo vence: hoje o atraso só fica registrado. Poderia expirar o pedido ou avisar a marca.
- Registrar os eventos (quem, quando, o quê) em vez de só o estado atual de cada versão.
- Contrato em OpenAPI gerado a partir de schemas.

## Uso de IA

Feito com IA (Claude Code, modelo Claude Opus 5.5), a partir do enunciado: o modelo de estados, o código em `src/`, os testes, o script de exemplos e este README.

O que eu revisei:

- Regra do prazo em `src/prazo.ts` e os testes de borda em `test/prazo.test.ts`: 23:59:59.999 em São Paulo aceito, 00:00:00.000 do dia seguinte recusado, e o caso em que o UTC já virou e São Paulo não.
- Testes do estado terminal: roteiro aprovado recusa nova versão, novo pedido e nova aprovação com 409, sem mudar nada.
- Máquina de estados: `aguardando` e `acoesPermitidas` batem com as transições que o serviço aceita.
- Histórico: versões antigas continuam intactas, cada uma com o pedido de alteração que recebeu.
- Exigência de informar a `versao` atual em aprovação e pedido de alteração.
- Avaliei e mantive a decisão de aceitar versão enviada depois do prazo, marcada com `enviadaDentroDoPrazo: false`.
- Rodei `npm test`, `npm run typecheck` e `npm run exemplos` no Node 24 e conferi `docs/exemplos.md` com o comportamento real.
- Não alterei o código gerado.