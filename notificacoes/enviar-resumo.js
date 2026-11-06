/* =====================================================================
   Envia o resumo das reservas do dia para todos os aparelhos cadastrados.
   Roda sozinho todo dia pelo GitHub Actions (.github/workflows/alerta-diario.yml)
   ===================================================================== */
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const FUSO = 'America/Sao_Paulo';

function hojeNoBrasil(agora = new Date()) {
  // "en-CA" devolve no formato AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(agora);
}

function montarMensagem(reservas, dataIso, appUrl) {
  const [, mes, dia] = dataIso.split('-');
  const ativas = reservas.filter((r) => r.status !== 'cancelada');
  const pessoas = ativas.reduce((s, r) => s + (Number(r.pessoas) || 0), 0);
  const url = (appUrl || './').replace(/\/?$/, '/') + '?dia=' + dataIso;

  if (!ativas.length) {
    return { title: `Sem reservas hoje (${dia}/${mes})`, body: 'Nenhuma reserva marcada para hoje.', url, tag: 'resumo-' + dataIso };
  }

  const LIMITE = 6;
  const linhas = ativas.slice(0, LIMITE).map((r) => {
    let linha = `${String(r.hora).slice(0, 5)} · ${r.motivo} · ${r.pessoas} ${Number(r.pessoas) === 1 ? 'pessoa' : 'pessoas'}`;
    const ex = r.extras && typeof r.extras === 'object' && !Array.isArray(r.extras) ? r.extras : {};
    const pedidos = Object.keys(ex).map((nome) => (ex[nome] ? `${nome}: ${ex[nome]}` : nome));
    if (pedidos.length) linha += ` · ⭐ ${pedidos.join(', ')}`;
    return linha;
  });
  if (ativas.length > LIMITE) linhas.push(`+ ${ativas.length - LIMITE} outras — toque para ver`);

  return {
    title: `Hoje (${dia}/${mes}): ${ativas.length} ${ativas.length === 1 ? 'reserva' : 'reservas'} · ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`,
    body: linhas.join('\n'),
    url,
    tag: 'resumo-' + dataIso
  };
}

function exigir(nome) {
  const v = (process.env[nome] || '').trim();
  if (!v) { console.error(`Falta o segredo ${nome} (GitHub > Settings > Secrets and variables > Actions).`); process.exit(1); }
  return v;
}

async function main() {
  const SUPABASE_URL = exigir('SUPABASE_URL');
  const SUPABASE_SECRET_KEY = exigir('SUPABASE_SECRET_KEY');
  const VAPID_PUBLIC_KEY = exigir('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE_KEY = exigir('VAPID_PRIVATE_KEY');
  let contato = exigir('VAPID_CONTATO');
  if (!/^(mailto:|https:)/.test(contato)) contato = 'mailto:' + contato;
  const APP_URL = (process.env.APP_URL || '').trim();
  const enviarSemReservas = (process.env.ENVIAR_SEM_RESERVAS || 'sim').toLowerCase() !== 'nao';

  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const data = (process.env.DATA || '').trim() || hojeNoBrasil();

  const { data: reservas, error: e1 } = await sb
    .from('reservas').select('hora, motivo, pessoas, status, extras').eq('data', data).order('hora');
  if (e1) throw e1;

  const msg = montarMensagem(reservas || [], data, APP_URL);
  console.log(`Data: ${data}\n${msg.title}\n${msg.body}\n`);

  if (msg.title.startsWith('Sem reservas') && !enviarSemReservas) {
    console.log('Sem reservas e ENVIAR_SEM_RESERVAS=nao — nada enviado.');
    return;
  }

  const { data: aparelhos, error: e2 } = await sb.from('inscricoes_push').select('id, endpoint, p256dh, auth');
  if (e2) throw e2;
  if (!aparelhos || !aparelhos.length) {
    console.log('Nenhum aparelho cadastrado ainda. Peça para a equipe tocar em "🔔 Ativar alertas" no app.');
    return;
  }

  webpush.setVapidDetails(contato, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify(msg);
  let ok = 0, removidos = 0, falhas = 0;

  for (const a of aparelhos) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        payload,
        { TTL: 6 * 60 * 60, urgency: 'high' }
      );
      ok++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Aparelho desinstalou o app ou bloqueou alertas: tira da lista
        await sb.from('inscricoes_push').delete().eq('id', a.id);
        removidos++;
      } else {
        falhas++;
        console.error(`Falha no aparelho ${a.id}: ${err.statusCode || ''} ${err.body || err.message}`);
      }
    }
  }
  console.log(`Enviados: ${ok} · Aparelhos removidos (inativos): ${removidos} · Falhas: ${falhas}`);
  if (falhas && !ok) process.exit(1);
}

module.exports = { montarMensagem, hojeNoBrasil };

if (require.main === module) {
  main().catch((e) => { console.error('Erro:', e.message || e); process.exit(1); });
}
