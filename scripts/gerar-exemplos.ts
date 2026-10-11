// Gera docs/exemplos.md executando a API de verdade (app.inject) com relógio controlado.
import { writeFileSync } from 'node:fs';
import { criarApp } from '../src/app.ts';

let agora = new Date('2026-03-10T14:00:00-03:00');
const app = criarApp({ relogio: { agora: () => new Date(agora) } });
const partes: string[] = [
  '# Exemplos de request e response',
  '',
  'Gerado por `npm run exemplos` (chamadas reais à API, relógio controlado). IDs mudam a cada execução.',
  '',
];

async function chamar(titulo: string, method: 'GET' | 'POST', url: string, payload?: object) {
  const res = await app.inject({ method, url, payload });
  partes.push(`## ${titulo}`, '', `Relógio: \`${agora.toISOString()}\``, '', '```http', `${method} ${url}`);
  if (payload) partes.push('Content-Type: application/json', '', JSON.stringify(payload, null, 2));
  partes.push('```', '', '```http', `HTTP/1.1 ${res.statusCode}`, '', JSON.stringify(res.json(), null, 2), '```', '');
  return res.json();
}

const { id } = await chamar('1. Criador envia o roteiro (versão 1)', 'POST', '/roteiros', {
  titulo: 'Campanha verão',
  conteudo: 'Abre na praia, produto aparece aos 5s.',
});
await chamar('2. Pedido de alteração sem prazo é recusado', 'POST', `/roteiros/${id}/solicitacoes-alteracao`, {
  versao: 1,
  motivo: 'Produto precisa aparecer antes',
});
await chamar('3. Marca pede alteração com motivo e prazo', 'POST', `/roteiros/${id}/solicitacoes-alteracao`, {
  versao: 1,
  motivo: 'Produto precisa aparecer nos 2 primeiros segundos',
  prazo: '2026-03-12',
});
agora = new Date('2026-03-11T10:00:00-03:00');
await chamar('4. Criador envia a versão 2', 'POST', `/roteiros/${id}/versoes`, {
  conteudo: 'Abre com o produto na mão, depois a praia.',
});
await chamar('5. Marca aprova a versão 2', 'POST', `/roteiros/${id}/aprovacao`, { versao: 2 });
await chamar('6. Roteiro aprovado não aceita nova versão', 'POST', `/roteiros/${id}/versoes`, {
  conteudo: 'Mais uma ideia',
});
await chamar('7. Roteiro aprovado não aceita pedido de alteração', 'POST', `/roteiros/${id}/solicitacoes-alteracao`, {
  versao: 2,
  motivo: 'Mudei de ideia',
  prazo: '2026-03-20',
});

const outro = await app.inject({
  method: 'POST',
  url: '/roteiros',
  payload: { titulo: 'Campanha inverno', conteudo: 'v1' },
});
agora = new Date('2026-03-11T00:30:00-03:00'); // 03:30Z
await chamar(
  '8. Prazo vencido: 00:30 do dia 11 em São Paulo, prazo dia 10',
  'POST',
  `/roteiros/${outro.json().id}/solicitacoes-alteracao`,
  { versao: 1, motivo: 'Trocar trilha', prazo: '2026-03-10' },
);
agora = new Date('2026-03-10T22:30:00-03:00'); // 01:30Z do dia 11
await chamar(
  '9. Prazo ainda vale: 22:30 do dia 10 em São Paulo (em UTC já é dia 11)',
  'POST',
  `/roteiros/${outro.json().id}/solicitacoes-alteracao`,
  { versao: 1, motivo: 'Trocar trilha', prazo: '2026-03-10' },
);
await chamar('10. Histórico completo (GET)', 'GET', `/roteiros/${id}`);

writeFileSync(new URL('../docs/exemplos.md', import.meta.url), partes.join('\n'));
console.log('docs/exemplos.md gerado');
