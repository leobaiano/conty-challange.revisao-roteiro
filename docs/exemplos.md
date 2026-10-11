# Exemplos de request e response

Gerado por `npm run exemplos` (chamadas reais à API, relógio controlado). IDs mudam a cada execução.

## 1. Criador envia o roteiro (versão 1)

Relógio: `2026-03-10T17:00:00.000Z`

```http
POST /roteiros
Content-Type: application/json

{
  "titulo": "Campanha verão",
  "conteudo": "Abre na praia, produto aparece aos 5s."
}
```

```http
HTTP/1.1 201

{
  "id": "549b25db-85dd-498e-801c-c1069d86c98c",
  "titulo": "Campanha verão",
  "status": "aguardando_revisao",
  "versaoAtual": 1,
  "criadoEm": "2026-03-10T17:00:00.000Z",
  "aprovadoEm": null,
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre na praia, produto aparece aos 5s.",
      "status": "em_revisao",
      "enviadaEm": "2026-03-10T17:00:00.000Z",
      "enviadaDentroDoPrazo": null,
      "solicitacaoAlteracao": null,
      "aprovadaEm": null
    }
  ],
  "aguardando": "marca",
  "acoesPermitidas": [
    "aprovar",
    "solicitar_alteracao"
  ],
  "pedidoPendente": null
}
```

## 2. Pedido de alteração sem prazo é recusado

Relógio: `2026-03-10T17:00:00.000Z`

```http
POST /roteiros/549b25db-85dd-498e-801c-c1069d86c98c/solicitacoes-alteracao
Content-Type: application/json

{
  "versao": 1,
  "motivo": "Produto precisa aparecer antes"
}
```

```http
HTTP/1.1 400

{
  "erro": {
    "codigo": "DADOS_INVALIDOS",
    "mensagem": "O campo \"prazo\" é obrigatório (dia no formato YYYY-MM-DD)."
  }
}
```

## 3. Marca pede alteração com motivo e prazo

Relógio: `2026-03-10T17:00:00.000Z`

```http
POST /roteiros/549b25db-85dd-498e-801c-c1069d86c98c/solicitacoes-alteracao
Content-Type: application/json

{
  "versao": 1,
  "motivo": "Produto precisa aparecer nos 2 primeiros segundos",
  "prazo": "2026-03-12"
}
```

```http
HTTP/1.1 201

{
  "id": "549b25db-85dd-498e-801c-c1069d86c98c",
  "titulo": "Campanha verão",
  "status": "alteracao_solicitada",
  "versaoAtual": 1,
  "criadoEm": "2026-03-10T17:00:00.000Z",
  "aprovadoEm": null,
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre na praia, produto aparece aos 5s.",
      "status": "alteracao_solicitada",
      "enviadaEm": "2026-03-10T17:00:00.000Z",
      "enviadaDentroDoPrazo": null,
      "solicitacaoAlteracao": {
        "motivo": "Produto precisa aparecer nos 2 primeiros segundos",
        "prazo": "2026-03-12",
        "prazoUltimoInstante": "2026-03-12T23:59:59.999-03:00",
        "prazoVencidoEm": "2026-03-13T00:00:00.000-03:00",
        "solicitadaEm": "2026-03-10T17:00:00.000Z"
      },
      "aprovadaEm": null
    }
  ],
  "aguardando": "criador",
  "acoesPermitidas": [
    "enviar_nova_versao"
  ],
  "pedidoPendente": {
    "motivo": "Produto precisa aparecer nos 2 primeiros segundos",
    "prazo": "2026-03-12",
    "prazoUltimoInstante": "2026-03-12T23:59:59.999-03:00",
    "prazoVencidoEm": "2026-03-13T00:00:00.000-03:00",
    "solicitadaEm": "2026-03-10T17:00:00.000Z",
    "prazoVencido": false
  }
}
```

## 4. Criador envia a versão 2

Relógio: `2026-03-11T13:00:00.000Z`

```http
POST /roteiros/549b25db-85dd-498e-801c-c1069d86c98c/versoes
Content-Type: application/json

{
  "conteudo": "Abre com o produto na mão, depois a praia."
}
```

```http
HTTP/1.1 201

{
  "id": "549b25db-85dd-498e-801c-c1069d86c98c",
  "titulo": "Campanha verão",
  "status": "aguardando_revisao",
  "versaoAtual": 2,
  "criadoEm": "2026-03-10T17:00:00.000Z",
  "aprovadoEm": null,
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre na praia, produto aparece aos 5s.",
      "status": "alteracao_solicitada",
      "enviadaEm": "2026-03-10T17:00:00.000Z",
      "enviadaDentroDoPrazo": null,
      "solicitacaoAlteracao": {
        "motivo": "Produto precisa aparecer nos 2 primeiros segundos",
        "prazo": "2026-03-12",
        "prazoUltimoInstante": "2026-03-12T23:59:59.999-03:00",
        "prazoVencidoEm": "2026-03-13T00:00:00.000-03:00",
        "solicitadaEm": "2026-03-10T17:00:00.000Z"
      },
      "aprovadaEm": null
    },
    {
      "numero": 2,
      "conteudo": "Abre com o produto na mão, depois a praia.",
      "status": "em_revisao",
      "enviadaEm": "2026-03-11T13:00:00.000Z",
      "enviadaDentroDoPrazo": true,
      "solicitacaoAlteracao": null,
      "aprovadaEm": null
    }
  ],
  "aguardando": "marca",
  "acoesPermitidas": [
    "aprovar",
    "solicitar_alteracao"
  ],
  "pedidoPendente": null
}
```

## 5. Marca aprova a versão 2

Relógio: `2026-03-11T13:00:00.000Z`

```http
POST /roteiros/549b25db-85dd-498e-801c-c1069d86c98c/aprovacao
Content-Type: application/json

{
  "versao": 2
}
```

```http
HTTP/1.1 200

{
  "id": "549b25db-85dd-498e-801c-c1069d86c98c",
  "titulo": "Campanha verão",
  "status": "aprovado",
  "versaoAtual": 2,
  "criadoEm": "2026-03-10T17:00:00.000Z",
  "aprovadoEm": "2026-03-11T13:00:00.000Z",
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre na praia, produto aparece aos 5s.",
      "status": "alteracao_solicitada",
      "enviadaEm": "2026-03-10T17:00:00.000Z",
      "enviadaDentroDoPrazo": null,
      "solicitacaoAlteracao": {
        "motivo": "Produto precisa aparecer nos 2 primeiros segundos",
        "prazo": "2026-03-12",
        "prazoUltimoInstante": "2026-03-12T23:59:59.999-03:00",
        "prazoVencidoEm": "2026-03-13T00:00:00.000-03:00",
        "solicitadaEm": "2026-03-10T17:00:00.000Z"
      },
      "aprovadaEm": null
    },
    {
      "numero": 2,
      "conteudo": "Abre com o produto na mão, depois a praia.",
      "status": "aprovada",
      "enviadaEm": "2026-03-11T13:00:00.000Z",
      "enviadaDentroDoPrazo": true,
      "solicitacaoAlteracao": null,
      "aprovadaEm": "2026-03-11T13:00:00.000Z"
    }
  ],
  "aguardando": null,
  "acoesPermitidas": [],
  "pedidoPendente": null
}
```

## 6. Roteiro aprovado não aceita nova versão

Relógio: `2026-03-11T13:00:00.000Z`

```http
POST /roteiros/549b25db-85dd-498e-801c-c1069d86c98c/versoes
Content-Type: application/json

{
  "conteudo": "Mais uma ideia"
}
```

```http
HTTP/1.1 409

{
  "erro": {
    "codigo": "ROTEIRO_APROVADO",
    "mensagem": "Roteiro aprovado não aceita nova versão."
  }
}
```

## 7. Roteiro aprovado não aceita pedido de alteração

Relógio: `2026-03-11T13:00:00.000Z`

```http
POST /roteiros/549b25db-85dd-498e-801c-c1069d86c98c/solicitacoes-alteracao
Content-Type: application/json

{
  "versao": 2,
  "motivo": "Mudei de ideia",
  "prazo": "2026-03-20"
}
```

```http
HTTP/1.1 409

{
  "erro": {
    "codigo": "ROTEIRO_APROVADO",
    "mensagem": "Roteiro aprovado não aceita pedido de alteração."
  }
}
```

## 8. Prazo vencido: 00:30 do dia 11 em São Paulo, prazo dia 10

Relógio: `2026-03-11T03:30:00.000Z`

```http
POST /roteiros/39f80d08-0863-4629-a410-69357604b71e/solicitacoes-alteracao
Content-Type: application/json

{
  "versao": 1,
  "motivo": "Trocar trilha",
  "prazo": "2026-03-10"
}
```

```http
HTTP/1.1 422

{
  "erro": {
    "codigo": "PRAZO_VENCIDO",
    "mensagem": "O prazo 2026-03-10 já passou no fuso America/Sao_Paulo (hoje é 2026-03-11)."
  }
}
```

## 9. Prazo ainda vale: 22:30 do dia 10 em São Paulo (em UTC já é dia 11)

Relógio: `2026-03-11T01:30:00.000Z`

```http
POST /roteiros/39f80d08-0863-4629-a410-69357604b71e/solicitacoes-alteracao
Content-Type: application/json

{
  "versao": 1,
  "motivo": "Trocar trilha",
  "prazo": "2026-03-10"
}
```

```http
HTTP/1.1 201

{
  "id": "39f80d08-0863-4629-a410-69357604b71e",
  "titulo": "Campanha inverno",
  "status": "alteracao_solicitada",
  "versaoAtual": 1,
  "criadoEm": "2026-03-11T13:00:00.000Z",
  "aprovadoEm": null,
  "versoes": [
    {
      "numero": 1,
      "conteudo": "v1",
      "status": "alteracao_solicitada",
      "enviadaEm": "2026-03-11T13:00:00.000Z",
      "enviadaDentroDoPrazo": null,
      "solicitacaoAlteracao": {
        "motivo": "Trocar trilha",
        "prazo": "2026-03-10",
        "prazoUltimoInstante": "2026-03-10T23:59:59.999-03:00",
        "prazoVencidoEm": "2026-03-11T00:00:00.000-03:00",
        "solicitadaEm": "2026-03-11T01:30:00.000Z"
      },
      "aprovadaEm": null
    }
  ],
  "aguardando": "criador",
  "acoesPermitidas": [
    "enviar_nova_versao"
  ],
  "pedidoPendente": {
    "motivo": "Trocar trilha",
    "prazo": "2026-03-10",
    "prazoUltimoInstante": "2026-03-10T23:59:59.999-03:00",
    "prazoVencidoEm": "2026-03-11T00:00:00.000-03:00",
    "solicitadaEm": "2026-03-11T01:30:00.000Z",
    "prazoVencido": false
  }
}
```

## 10. Histórico completo (GET)

Relógio: `2026-03-11T01:30:00.000Z`

```http
GET /roteiros/549b25db-85dd-498e-801c-c1069d86c98c
```

```http
HTTP/1.1 200

{
  "id": "549b25db-85dd-498e-801c-c1069d86c98c",
  "titulo": "Campanha verão",
  "status": "aprovado",
  "versaoAtual": 2,
  "criadoEm": "2026-03-10T17:00:00.000Z",
  "aprovadoEm": "2026-03-11T13:00:00.000Z",
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre na praia, produto aparece aos 5s.",
      "status": "alteracao_solicitada",
      "enviadaEm": "2026-03-10T17:00:00.000Z",
      "enviadaDentroDoPrazo": null,
      "solicitacaoAlteracao": {
        "motivo": "Produto precisa aparecer nos 2 primeiros segundos",
        "prazo": "2026-03-12",
        "prazoUltimoInstante": "2026-03-12T23:59:59.999-03:00",
        "prazoVencidoEm": "2026-03-13T00:00:00.000-03:00",
        "solicitadaEm": "2026-03-10T17:00:00.000Z"
      },
      "aprovadaEm": null
    },
    {
      "numero": 2,
      "conteudo": "Abre com o produto na mão, depois a praia.",
      "status": "aprovada",
      "enviadaEm": "2026-03-11T13:00:00.000Z",
      "enviadaDentroDoPrazo": true,
      "solicitacaoAlteracao": null,
      "aprovadaEm": "2026-03-11T13:00:00.000Z"
    }
  ],
  "aguardando": null,
  "acoesPermitidas": [],
  "pedidoPendente": null
}
```
