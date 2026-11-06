/* =====================================================================
   SISTEMA DE RESERVAS — app
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_KEY;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // ---------- utilidades ----------
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoData(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function lerIso(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function hojeIso() { return isoData(new Date()); }
  function hora5(h) { return String(h || '').slice(0, 5); }
  function dataLonga(s) {
    return lerIso(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function soNumeros(t) { return String(t || '').replace(/\D/g, ''); }

  // ---------- pedidos especiais ----------
  var EXTRAS = (Array.isArray(CFG.EXTRAS) && CFG.EXTRAS.length) ? CFG.EXTRAS : [
    { nome: 'Foto na taça', icone: '📷', pergunta: 'Detalhes da foto (opcional)' },
    { nome: 'Nome na taça', icone: '✍️', pergunta: 'Qual nome vai na taça?' },
    { nome: 'Bolo próprio', icone: '🎂' },
    { nome: 'Decoração', icone: '🎈', pergunta: 'Que tipo de decoração?' },
    { nome: 'Cadeira de bebê', icone: '👶' }
  ];
  function iconeExtra(nome) {
    var e = EXTRAS.find(function (x) { return x.nome === nome; });
    return e && e.icone ? e.icone : '⭐';
  }
  function extrasDe(r) {
    var ex = r && r.extras;
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) return {};
    return ex;
  }

  // ---------- fotos: reduz antes de enviar (economiza espaço e internet) ----------
  function reduzirFoto(arquivo, ladoMax, qualidade) {
    return new Promise(function (resolve) {
      var ehImagem = /^image\//.test(arquivo.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(arquivo.name || '');
      if (!ehImagem || /gif$/i.test(arquivo.type)) return resolve(arquivo);
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var esc = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * esc));
        c.height = Math.max(1, Math.round(img.naturalHeight * esc));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          resolve(b && (b.size < arquivo.size || !/jpe?g|png|webp/i.test(arquivo.type)) ? b : arquivo);
        }, 'image/jpeg', qualidade);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(arquivo); };
      img.src = url;
    });
  }
  function blobParaDataUrl(b) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(b);
    });
  }

  var timerAviso;
  function aviso(msg) {
    var el = $('#aviso');
    el.textContent = msg;
    el.classList.add('mostrar');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { el.classList.remove('mostrar'); }, 3800);
  }
  function msgErro(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem conexão com a internet. Tente de novo.';
    if (/JWT|session|not authenticated|Não autenticado/i.test(m)) return 'Sua sessão expirou. Entre de novo.';
    if (/QuotaExceeded|quota/i.test(m)) return 'Sem espaço no modo demonstração. Apague algumas fotos de teste.';
    if (/Payload too large|exceeded the maximum allowed size/i.test(m)) return 'Foto grande demais (máx. 10 MB).';
    return m;
  }

  // =====================================================================
  //  DADOS — Supabase (equipe) ou navegador (demonstração)
  // =====================================================================
  var sb = null;
  var api = DEMO ? apiDemo() : apiSupabase();

  function apiDemo() {
    var CHAVE = 'reservas-demo';
    function salvar(l) { localStorage.setItem(CHAVE, JSON.stringify(l)); }
    function exemplo() {
      var t = new Date();
      var d = function (n) { return isoData(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n)); };
      var l = [
        { id: 1, data: d(0), hora: '12:30', motivo: 'Aniversário', pessoas: 12, cliente: 'Mariana Souza', telefone: '11988887777', observacoes: 'Mesa perto da janela.', status: 'confirmada', extras: { 'Foto na taça': '', 'Nome na taça': 'Mariana 30 anos', 'Bolo próprio': '' }, anexos: [] },
        { id: 2, data: d(0), hora: '20:00', motivo: 'Jantar de empresa', pessoas: 18, cliente: 'Ricardo Lima', telefone: '', observacoes: 'Nota fiscal no CNPJ.', status: 'confirmada', extras: {}, anexos: [] },
        { id: 3, data: d(1), hora: '19:30', motivo: 'Encontro de família', pessoas: 6, cliente: 'Ana', telefone: '', observacoes: '', status: 'confirmada', extras: { 'Cadeira de bebê': '' }, anexos: [] },
        { id: 4, data: d(3), hora: '13:00', motivo: 'Almoço de negócios', pessoas: 4, cliente: 'Paulo', telefone: '', observacoes: '', status: 'confirmada', extras: {}, anexos: [] },
        { id: 5, data: d(3), hora: '21:00', motivo: 'Despedida', pessoas: 10, cliente: 'Bruna', telefone: '', observacoes: '', status: 'cancelada', extras: {}, anexos: [] }
      ];
      try { salvar(l); } catch (e) { }
      return l;
    }
    function carregarTudo() {
      try { var l = JSON.parse(localStorage.getItem(CHAVE)); if (Array.isArray(l)) return l; } catch (e) { }
      return exemplo();
    }
    function tentar(fn) { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } }
    return {
      sessao: function () { return Promise.resolve({ user: { email: 'demonstracao' } }); },
      listar: function (ini, fim) {
        return Promise.resolve(carregarTudo().filter(function (r) { return r.data >= ini && r.data <= fim; }));
      },
      criar: function (r) {
        return tentar(function () {
          var l = carregarTudo(); r.id = Date.now(); r.anexos = []; l.push(r); salvar(l); return r;
        });
      },
      atualizar: function (id, r) {
        return tentar(function () {
          salvar(carregarTudo().map(function (x) { return x.id === id ? Object.assign({}, x, r) : x; }));
        });
      },
      excluir: function (id) {
        return tentar(function () { salvar(carregarTudo().filter(function (x) { return x.id !== id; })); });
      },
      enviarAnexo: function (reservaId, arquivo) {
        // No modo demonstração a foto fica pequena para caber no navegador
        return reduzirFoto(arquivo, 700, 0.7).then(blobParaDataUrl).then(function (url) {
          var l = carregarTudo();
          var r = l.find(function (x) { return x.id === reservaId; });
          if (!r) throw new Error('Reserva não encontrada.');
          r.anexos = r.anexos || [];
          r.anexos.push({ id: Date.now() + Math.random(), caminho: url, nome: arquivo.name || 'foto.jpg' });
          salvar(l);
        });
      },
      excluirAnexo: function (anexo) {
        return tentar(function () {
          var l = carregarTudo();
          l.forEach(function (r) {
            r.anexos = (r.anexos || []).filter(function (a) { return a.id !== anexo.id; });
          });
          salvar(l);
        });
      },
      urlsAnexos: function (anexos) {
        var m = {};
        anexos.forEach(function (a) { m[a.caminho] = a.caminho; });
        return Promise.resolve(m);
      }
    };
  }

  function apiSupabase() {
    if (!window.supabase) {
      document.body.innerHTML = '<p style="padding:24px">Não foi possível carregar o sistema. Verifique a internet e recarregue a página.</p>';
      throw new Error('supabase-js não carregou');
    }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
    var BUCKET = 'anexos';
    var cacheUrls = {};   // caminho -> { url, expira }
    function ok(res) { if (res.error) throw res.error; return res.data; }
    function email() { return estado.usuario ? estado.usuario.email : null; }
    return {
      sessao: function () { return sb.auth.getSession().then(function (r) { return r.data.session; }); },
      listar: function (ini, fim) {
        return sb.from('reservas').select('*, anexos(id, caminho, nome)')
          .gte('data', ini).lte('data', fim)
          .order('data').order('hora').then(ok);
      },
      criar: function (r) {
        r.criado_por = email();
        return sb.from('reservas').insert(r).select().single().then(ok);
      },
      atualizar: function (id, r) { return sb.from('reservas').update(r).eq('id', id).then(ok); },
      excluir: function (id) {
        // apaga as fotos do armazenamento antes de apagar a reserva
        return sb.from('anexos').select('caminho').eq('reserva_id', id).then(ok).then(function (lista) {
          var caminhos = (lista || []).map(function (a) { return a.caminho; });
          return caminhos.length ? sb.storage.from(BUCKET).remove(caminhos) : null;
        }).then(function () {
          return sb.from('reservas').delete().eq('id', id).then(ok);
        });
      },
      enviarAnexo: function (reservaId, arquivo) {
        return reduzirFoto(arquivo, 1600, 0.82).then(function (blob) {
          var ext = blob.type === 'image/jpeg' ? 'jpg' : ((arquivo.name || '').split('.').pop() || 'jpg').toLowerCase();
          var caminho = reservaId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
          return sb.storage.from(BUCKET).upload(caminho, blob, {
            contentType: blob.type || 'image/jpeg', cacheControl: '31536000', upsert: false
          }).then(ok).then(function () {
            return sb.from('anexos').insert({
              reserva_id: reservaId, caminho: caminho, nome: arquivo.name || null,
              tipo: blob.type || null, tamanho: blob.size || null, criado_por: email()
            }).then(function (res) {
              if (res.error) {   // não deixa arquivo órfão
                sb.storage.from(BUCKET).remove([caminho]);
                throw res.error;
              }
            });
          });
        });
      },
      excluirAnexo: function (anexo) {
        return sb.storage.from(BUCKET).remove([anexo.caminho]).then(ok).then(function () {
          return sb.from('anexos').delete().eq('id', anexo.id).then(ok);
        });
      },
      // links temporários (1 hora) para ver as fotos privadas
      urlsAnexos: function (anexos) {
        var agora = Date.now(), m = {}, faltam = [];
        anexos.forEach(function (a) {
          var c = cacheUrls[a.caminho];
          if (c && c.expira > agora) m[a.caminho] = c.url; else faltam.push(a.caminho);
        });
        if (!faltam.length) return Promise.resolve(m);
        return sb.storage.from(BUCKET).createSignedUrls(faltam, 3600).then(ok).then(function (lista) {
          (lista || []).forEach(function (x) {
            if (x.signedUrl) {
              m[x.path] = x.signedUrl;
              cacheUrls[x.path] = { url: x.signedUrl, expira: agora + 50 * 60 * 1000 };
            }
          });
          return m;
        });
      }
    };
  }

  // =====================================================================
  //  ESTADO E TELA
  // =====================================================================
  var estado = {
    usuario: null,
    mes: null,          // Date do dia 1 do mês exibido
    diaSel: hojeIso(),
    reservas: [],
    editandoId: null
  };

  function inicioGrade(mes) {
    var d = new Date(mes.getFullYear(), mes.getMonth(), 1);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function carregar() {
    var ini = inicioGrade(estado.mes);
    var fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 41);
    return api.listar(isoData(ini), isoData(fim)).then(function (lista) {
      estado.reservas = (lista || []).slice().sort(function (a, b) {
        return a.data === b.data ? hora5(a.hora).localeCompare(hora5(b.hora)) : a.data.localeCompare(b.data);
      });
      desenhar();
    }).catch(function (e) {
      aviso(msgErro(e));
      if (/sessão expirou/.test(msgErro(e)) && sb) sb.auth.signOut();
    });
  }

  function doDia(iso) {
    return estado.reservas.filter(function (r) { return r.data === iso; });
  }
  function confirmadas(lista) { return lista.filter(function (r) { return r.status !== 'cancelada'; }); }
  function somaPessoas(lista) { return lista.reduce(function (s, r) { return s + (Number(r.pessoas) || 0); }, 0); }

  function desenhar() { desenharCalendario(); desenharDia(); }

  function desenharCalendario() {
    var mes = estado.mes;
    $('#mes-titulo').textContent = MESES[mes.getMonth()] + ' ' + mes.getFullYear();
    var ini = inicioGrade(mes);
    var hoje = hojeIso();
    var html = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i);
      var iso = isoData(d);
      var conf = confirmadas(doDia(iso));
      var cls = ['cal-dia'];
      if (d.getMonth() !== mes.getMonth()) cls.push('fora');
      if (iso === hoje) cls.push('hoje');
      else if (iso < hoje) cls.push('passado');
      if (iso === estado.diaSel) cls.push('sel');
      var info = conf.length
        ? '<span class="info">' + conf.length + '<span class="p"> · ' + somaPessoas(conf) + 'p</span></span>'
        : '';
      var rotulo = dataLonga(iso) + (conf.length ? ', ' + plural(conf.length, 'reserva', 'reservas') : ', sem reservas');
      html += '<button class="' + cls.join(' ') + '" data-dia="' + iso + '" aria-label="' + esc(rotulo) + '">' +
        '<span class="num">' + d.getDate() + '</span>' + info + '</button>';
    }
    $('#cal-grade').innerHTML = html;
  }

  function desenharDia() {
    var iso = estado.diaSel;
    var lista = doDia(iso);
    var conf = confirmadas(lista);
    $('#dia-titulo').textContent = (iso === hojeIso() ? 'Hoje, ' : '') + dataLonga(iso);
    $('#dia-resumo').textContent = conf.length
      ? plural(conf.length, 'reserva', 'reservas') + ' · ' + plural(somaPessoas(conf), 'pessoa', 'pessoas')
      : 'Nenhuma reserva neste dia.';

    if (!lista.length) {
      $('#lista').innerHTML = '<li class="vazio">Toque em <b>+ Nova reserva</b> para adicionar.</li>';
      return;
    }
    $('#lista').innerHTML = lista.map(function (r) {
      var det = [];
      if (r.cliente) det.push(esc(r.cliente));
      if (r.telefone) det.push('<a href="tel:' + esc(soNumeros(r.telefone)) + '">' + esc(r.telefone) + '</a>');
      var obs = r.observacoes ? '<div class="det">' + esc(r.observacoes) + '</div>' : '';
      var ex = extrasDe(r);
      var pedidos = Object.keys(ex).map(function (nome) {
        return '<span class="pedido">' + iconeExtra(nome) + ' ' + esc(nome) +
          (ex[nome] ? ': <b>' + esc(ex[nome]) + '</b>' : '') + '</span>';
      }).join('');
      var anexos = r.anexos || [];
      var minis = anexos.map(function (a) {
        return '<img class="mini" alt="Foto da reserva" loading="lazy" data-caminho="' + esc(a.caminho) + '">';
      }).join('');
      var canc = r.status === 'cancelada';
      return '<li class="reserva' + (canc ? ' cancelada' : '') + '" data-id="' + esc(r.id) + '" tabindex="0">' +
        '<span class="hora">' + esc(hora5(r.hora)) + '</span>' +
        '<span class="motivo">' + esc(r.motivo) + (canc ? '<span class="etiqueta">cancelada</span>' : '') + '</span>' +
        '<span class="pessoas">' + esc(r.pessoas) + ' 👤</span>' +
        (det.length ? '<div class="det">' + det.join(' · ') + '</div>' : '') +
        (pedidos ? '<div class="pedidos">' + pedidos + '</div>' : '') +
        obs +
        (minis ? '<div class="miniaturas">' + minis + '</div>' : '') +
        '</li>';
    }).join('');
    preencherFotos($('#lista'), [].concat.apply([], lista.map(function (r) { return r.anexos || []; })));
  }

  // Coloca o endereço real nas <img data-caminho="...">
  function preencherFotos(raiz, anexos) {
    if (!anexos.length) return;
    api.urlsAnexos(anexos).then(function (urls) {
      raiz.querySelectorAll('img[data-caminho]').forEach(function (img) {
        var u = urls[img.getAttribute('data-caminho')];
        if (u && img.src !== u) img.src = u;
      });
    }).catch(function () { });
  }

  function verFoto(url) {
    if (!url) return;
    $('#foto-grande').src = url;
    $('#foto-abrir').href = url;
    $('#dlg-foto').showModal();
  }
  $('#btn-fechar-foto').addEventListener('click', function () { $('#dlg-foto').close(); });
  $('#dlg-foto').addEventListener('close', function () { $('#foto-grande').removeAttribute('src'); });

  function irPara(iso) {
    estado.diaSel = iso;
    var d = lerIso(iso);
    var mudouMes = !estado.mes || d.getMonth() !== estado.mes.getMonth() || d.getFullYear() !== estado.mes.getFullYear();
    estado.mes = new Date(d.getFullYear(), d.getMonth(), 1);
    if (mudouMes) return carregar();
    desenhar();
    return Promise.resolve();
  }

  function mudarMes(delta) {
    var m = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + delta, 1);
    estado.mes = m;
    var hoje = new Date();
    estado.diaSel = (m.getMonth() === hoje.getMonth() && m.getFullYear() === hoje.getFullYear())
      ? hojeIso() : isoData(m);
    carregar();
  }

  // =====================================================================
  //  FORMULÁRIO
  // =====================================================================
  var form = $('#form-reserva');
  var fotosPendentes = [];   // [{ arquivo, url }] ainda não enviadas
  var anexosAtuais = [];     // fotos já salvas da reserva em edição

  // ----- pedidos especiais -----
  function desenharExtras(valores) {
    $('#extras').innerHTML = EXTRAS.map(function (e, i) {
      var marcado = Object.prototype.hasOwnProperty.call(valores, e.nome);
      var html = '<label class="chip"><input type="checkbox" data-extra="' + i + '"' + (marcado ? ' checked' : '') + '>' +
        '<span aria-hidden="true">' + esc(e.icone || '⭐') + '</span> ' + esc(e.nome) + '</label>';
      if (e.pergunta) {
        html += '<input type="text" class="extra-texto" data-extra-texto="' + i + '" maxlength="200"' +
          ' placeholder="' + esc(e.pergunta) + '" value="' + esc(marcado ? valores[e.nome] : '') + '"' +
          (marcado ? '' : ' hidden') + '>';
      }
      return html;
    }).join('');
    // pedidos antigos que não estão mais na lista do config.js continuam visíveis
    Object.keys(valores).forEach(function (nome) {
      if (EXTRAS.some(function (e) { return e.nome === nome; })) return;
      $('#extras').insertAdjacentHTML('beforeend',
        '<label class="chip"><input type="checkbox" data-extra-livre="' + esc(nome) + '" data-valor="' + esc(valores[nome] || '') + '" checked>' +
        '<span aria-hidden="true">⭐</span> ' + esc(nome) + (valores[nome] ? ': ' + esc(valores[nome]) : '') + '</label>');
    });
  }
  $('#extras').addEventListener('change', function (ev) {
    var i = ev.target.getAttribute('data-extra');
    if (i == null) return;
    var campo = $('#extras').querySelector('[data-extra-texto="' + i + '"]');
    if (!campo) return;
    campo.hidden = !ev.target.checked;
    if (ev.target.checked) campo.focus();
  });
  function lerExtras() {
    var out = {};
    $('#extras').querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      if (!cb.checked) return;
      if (cb.hasAttribute('data-extra-livre')) {
        out[cb.getAttribute('data-extra-livre')] = cb.getAttribute('data-valor') || '';
        return;
      }
      var i = cb.getAttribute('data-extra');
      var campo = $('#extras').querySelector('[data-extra-texto="' + i + '"]');
      out[EXTRAS[i].nome] = campo ? campo.value.trim() : '';
    });
    return out;
  }

  // ----- fotos -----
  function desenharAnexosForm() {
    var html = anexosAtuais.map(function (a, i) {
      return '<div class="anexo"><img alt="Foto" data-caminho="' + esc(a.caminho) + '" data-ver-salva="' + i + '">' +
        '<button type="button" class="anexo-remover" data-remover-salva="' + i + '" aria-label="Remover foto">×</button></div>';
    }).join('') + fotosPendentes.map(function (p, i) {
      return '<div class="anexo pendente"><img alt="Foto nova" src="' + esc(p.url) + '" data-ver-pendente="' + i + '">' +
        '<button type="button" class="anexo-remover" data-remover-pendente="' + i + '" aria-label="Remover foto">×</button></div>';
    }).join('');
    $('#anexos-grade').innerHTML = html;
    preencherFotos($('#anexos-grade'), anexosAtuais);
  }
  function limparPendentes() {
    fotosPendentes.forEach(function (p) { URL.revokeObjectURL(p.url); });
    fotosPendentes = [];
  }
  $('#input-fotos').addEventListener('change', function (ev) {
    var arquivos = Array.prototype.slice.call(ev.target.files || []);
    arquivos.forEach(function (f) {
      if (f.size > 25 * 1024 * 1024) return aviso('"' + f.name + '" é grande demais (máx. 25 MB).');
      fotosPendentes.push({ arquivo: f, url: URL.createObjectURL(f) });
    });
    ev.target.value = '';
    desenharAnexosForm();
  });
  $('#anexos-grade').addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.hasAttribute('data-remover-pendente')) {
      var i = +t.getAttribute('data-remover-pendente');
      URL.revokeObjectURL(fotosPendentes[i].url);
      fotosPendentes.splice(i, 1);
      return desenharAnexosForm();
    }
    if (t.hasAttribute('data-remover-salva')) {
      var a = anexosAtuais[+t.getAttribute('data-remover-salva')];
      if (!confirm('Apagar esta foto da reserva?')) return;
      return api.excluirAnexo(a).then(function () {
        anexosAtuais = anexosAtuais.filter(function (x) { return x.id !== a.id; });
        desenharAnexosForm();
        aviso('Foto apagada.');
        carregar();
      }).catch(function (e) { aviso(msgErro(e)); });
    }
    if (t.tagName === 'IMG') verFoto(t.src);
  });

  function abrirForm(reserva) {
    form.reset();
    $('#form-erro').hidden = true;
    estado.editandoId = reserva ? reserva.id : null;
    $('#form-titulo').textContent = reserva ? 'Editar reserva' : 'Nova reserva';
    $('#btn-excluir').hidden = !reserva;
    $('#campo-status').hidden = !reserva;
    var r = reserva || { data: estado.diaSel, status: 'confirmada' };
    form.motivo.value = r.motivo || '';
    form.data.value = r.data || estado.diaSel;
    form.hora.value = hora5(r.hora);
    form.pessoas.value = r.pessoas || '';
    form.cliente.value = r.cliente || '';
    form.telefone.value = r.telefone || '';
    form.observacoes.value = r.observacoes || '';
    form.status.value = r.status || 'confirmada';
    desenharExtras(extrasDe(r));
    limparPendentes();
    anexosAtuais = (r.anexos || []).slice();
    desenharAnexosForm();
    $('#dlg-form').showModal();
    $('#dlg-form').scrollTop = 0;
    if (!reserva) setTimeout(function () { form.motivo.focus(); }, 50);
  }

  function erroForm(msg) { var el = $('#form-erro'); el.textContent = msg; el.hidden = false; }

  // envia as fotos novas uma por uma, mostrando o progresso no botão
  function enviarPendentes(reservaId, btn) {
    var lista = fotosPendentes.slice();
    var falhas = 0;
    return lista.reduce(function (p, item, i) {
      return p.then(function () {
        btn.textContent = 'Enviando foto ' + (i + 1) + ' de ' + lista.length + '…';
        return api.enviarAnexo(reservaId, item.arquivo).then(function () {
          var k = fotosPendentes.indexOf(item);
          if (k >= 0) { URL.revokeObjectURL(item.url); fotosPendentes.splice(k, 1); }
        }).catch(function (e) { falhas++; console.error(e); });
      });
    }, Promise.resolve()).then(function () { return falhas; });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var dados = {
      motivo: form.motivo.value.trim(),
      data: form.data.value,
      hora: form.hora.value,
      pessoas: parseInt(form.pessoas.value, 10),
      cliente: form.cliente.value.trim() || null,
      telefone: form.telefone.value.trim() || null,
      observacoes: form.observacoes.value.trim() || null,
      extras: lerExtras()
    };
    if (!dados.motivo) return erroForm('Informe o motivo da reserva.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return erroForm('Escolha o dia.');
    if (!/^\d{2}:\d{2}/.test(dados.hora)) return erroForm('Escolha a hora.');
    if (!(dados.pessoas >= 1 && dados.pessoas <= 999)) return erroForm('Informe a quantidade de pessoas (1 a 999).');

    var editando = estado.editandoId;
    if (editando) dados.status = form.status.value;
    var btn = $('#btn-salvar');
    btn.disabled = true; btn.textContent = 'Salvando…';
    var acao = editando ? api.atualizar(editando, dados) : api.criar(dados);
    acao.then(function (res) {
      var id = editando || (res && res.id);
      // a partir daqui a reserva já existe: se as fotos falharem, a edição continua
      estado.editandoId = id;
      $('#btn-excluir').hidden = false;
      $('#campo-status').hidden = false;
      return enviarPendentes(id, btn);
    }).then(function (falhas) {
      if (falhas) {
        erroForm(falhas === 1
          ? 'A reserva foi salva, mas 1 foto não foi enviada. Toque em Salvar para tentar de novo.'
          : 'A reserva foi salva, mas ' + falhas + ' fotos não foram enviadas. Toque em Salvar para tentar de novo.');
        desenharAnexosForm();
        return carregar();
      }
      $('#dlg-form').close();
      aviso(editando ? 'Reserva atualizada.' : 'Reserva criada.');
      return irPara(dados.data).then(carregar);
    }).catch(function (e) {
      erroForm(msgErro(e));
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Salvar';
    });
  });

  $('#btn-excluir').addEventListener('click', function () {
    var id = estado.editandoId;
    if (!id) return;
    if (!confirm('Excluir esta reserva e as fotos dela de vez?\n\nDica: para manter o histórico, use "Situação: Cancelada".')) return;
    api.excluir(id).then(function () {
      $('#dlg-form').close();
      aviso('Reserva excluída.');
      carregar();
    }).catch(function (e) { erroForm(msgErro(e)); });
  });

  $('#btn-cancelar-form').addEventListener('click', function () { $('#dlg-form').close(); });
  $('#dlg-form').addEventListener('close', limparPendentes);

  // =====================================================================
  //  EVENTOS DA TELA
  // =====================================================================
  $('#cal-grade').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dia]');
    if (b) irPara(b.dataset.dia);
  });
  $('#lista').addEventListener('click', function (ev) {
    if (ev.target.closest('a')) return;
    if (ev.target.classList.contains('mini')) return verFoto(ev.target.src);
    var li = ev.target.closest('[data-id]');
    if (!li) return;
    var r = estado.reservas.find(function (x) { return String(x.id) === li.dataset.id; });
    if (r) abrirForm(r);
  });
  $('#lista').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.matches('[data-id]')) ev.target.click();
  });
  $('#mes-ant').addEventListener('click', function () { mudarMes(-1); });
  $('#mes-prox').addEventListener('click', function () { mudarMes(1); });
  $('#btn-hoje').addEventListener('click', function () { irPara(hojeIso()); });
  $('#btn-nova').addEventListener('click', function () { abrirForm(null); });
  $('#btn-fechar-ios').addEventListener('click', function () { $('#dlg-ios').close(); });

  // Recarrega ao voltar para o app (ex.: celular desbloqueado)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      estado.hojeAoSair = hojeIso();
    } else if (estado.usuario) {
      // Se o app ficou aberto de um dia para o outro, pula para o novo "hoje"
      var hoje = hojeIso();
      if (estado.hojeAoSair && estado.hojeAoSair !== hoje && estado.diaSel === estado.hojeAoSair) {
        irPara(hoje).then(carregar);
      } else {
        carregar();
      }
    }
  });

  // =====================================================================
  //  LOGIN
  // =====================================================================
  $('#form-login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = $('#btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    $('#login-erro').hidden = true;
    sb.auth.signInWithPassword({
      email: $('#login-email').value.trim(),
      password: $('#login-senha').value
    }).then(function (r) {
      if (r.error) throw r.error;
    }).catch(function (e) {
      var el = $('#login-erro'); el.textContent = msgErro(e); el.hidden = false;
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Entrar';
    });
  });

  $('#btn-sair').addEventListener('click', function () {
    if (DEMO) return aviso('No modo demonstração não há login.');
    if (confirm('Sair do sistema neste aparelho?')) sb.auth.signOut();
  });

  var canalAoVivo = null;
  function mostrarApp(sessao) {
    estado.usuario = sessao ? sessao.user : null;
    $('#tela-login').hidden = !!estado.usuario;
    $('#app').hidden = !estado.usuario;
    if (!estado.usuario) {
      if (canalAoVivo) { sb.removeChannel(canalAoVivo); canalAoVivo = null; }
      return;
    }
    var params = new URLSearchParams(location.search);
    var dia = params.get('dia');
    estado.mes = null;
    irPara(dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : estado.diaSel);
    if (sb && !canalAoVivo) {
      var t;
      canalAoVivo = sb.channel('reservas-ao-vivo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, function () {
          clearTimeout(t); t = setTimeout(carregar, 400);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'anexos' }, function () {
          clearTimeout(t); t = setTimeout(carregar, 400);
        })
        .subscribe();
    }
    verificarAlertas();
  }

  // =====================================================================
  //  ALERTAS (notificações push)
  // =====================================================================
  function ehIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function instalado() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }
  function suportaPush() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function b64ParaBytes(b64) {
    var p = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function marcarAlertas(ativo) {
    $('#btn-alertas').classList.toggle('ativo', ativo);
    $('#txt-alertas').textContent = ativo ? 'Alertas ativos' : 'Ativar alertas';
  }
  function registrarNoBanco(sub) {
    var j = sub.toJSON();
    return sb.rpc('registrar_push', {
      p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
      p_dispositivo: navigator.userAgent.slice(0, 200)
    }).then(function (r) { if (r.error) throw r.error; });
  }

  // Ao abrir: se já estiver ativado, renova o cadastro do aparelho
  function verificarAlertas() {
    if (DEMO || !suportaPush() || Notification.permission !== 'granted') return marcarAlertas(false);
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (!sub) return marcarAlertas(false);
      marcarAlertas(true);
      return registrarNoBanco(sub);
    }).catch(function () { });
  }

  $('#btn-alertas').addEventListener('click', function () {
    if (DEMO) return aviso('Os alertas funcionam depois de configurar o config.js (veja o LEIA-ME).');
    if (ehIOS() && !instalado()) return $('#dlg-ios').showModal();
    if (!suportaPush()) return aviso('Este navegador não aceita alertas. Use Chrome, Edge ou Safari atualizado.');
    if (!CFG.VAPID_PUBLIC_KEY) return aviso('Falta a chave VAPID_PUBLIC_KEY no config.js.');

    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações deste site nas configurações do aparelho.');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ParaBytes(CFG.VAPID_PUBLIC_KEY)
        });
      }).then(function (sub) {
        return registrarNoBanco(sub).then(function () {
          marcarAlertas(true);
          aviso('Alertas ativados neste aparelho ✓');
          return reg.showNotification('Alertas ativados ✓', {
            body: 'Você vai receber aqui o resumo das reservas do dia, todas as manhãs.',
            icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', tag: 'teste'
          });
        });
      });
    }).catch(function (e) { aviso(msgErro(e)); });
  });

  // =====================================================================
  //  INSTALAÇÃO (Android / computador)
  // =====================================================================
  var pedidoInstalacao = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    pedidoInstalacao = ev;
    $('#btn-instalar').hidden = false;
  });
  $('#btn-instalar').addEventListener('click', function () {
    if (!pedidoInstalacao) return;
    pedidoInstalacao.prompt();
    pedidoInstalacao.userChoice.then(function () {
      pedidoInstalacao = null;
      $('#btn-instalar').hidden = true;
    });
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(function () { });
  }

  // =====================================================================
  //  INÍCIO
  // =====================================================================
  var nome = CFG.NOME || 'Reservas';
  document.title = nome;
  $('#titulo').textContent = nome;
  $('#login-titulo').textContent = nome;

  if (DEMO) {
    $('#faixa-demo').hidden = false;
    $('#btn-sair').hidden = true;
    api.sessao().then(mostrarApp);
  } else {
    api.sessao().then(mostrarApp);
    sb.auth.onAuthStateChange(function (evento, sessao) {
      var mesmoUsuario = sessao && estado.usuario && sessao.user.id === estado.usuario.id;
      if ((evento === 'SIGNED_IN' && !mesmoUsuario) || evento === 'SIGNED_OUT') mostrarApp(sessao);
      else if (sessao) estado.usuario = sessao.user;
    });
  }
})();
