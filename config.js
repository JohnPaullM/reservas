// =====================================================================
//  CONFIGURAÇÃO — preencha com os dados do seu projeto (veja LEIA-ME.md)
//  Enquanto estiver vazio, o app abre em MODO DEMONSTRAÇÃO
//  (dados ficam só no navegador, sem login e sem alertas).
// =====================================================================
window.APP_CONFIG = {
  // Nome que aparece no topo do app
  NOME: "Vino! Higienópolis",

  // Supabase > Project Settings > Data API > Project URL
  SUPABASE_URL: "https://xzqzsuataughholsazvl.supabase.co",            // ex.: "https://abcdefgh.supabase.co"

  // Supabase > Project Settings > API Keys > Publishable key (ou "anon public")
  // Esta chave PODE ficar aqui. NUNCA coloque a "secret"/"service_role" neste arquivo.
  SUPABASE_KEY: "sb_publishable_nUUeZQdeBjfmtr0R7ie1Jg_ucARUgdy",

  // Chave PÚBLICA VAPID (arquivo CHAVES-VAPID.txt)
  VAPID_PUBLIC_KEY: "BLNkRtAmji_SNG6PMKJZn0WSEZwPjmwmXpt8YGVfcyBrzvx7i1Kr3GVs_EJt8FEph31Y9tbjF14pvkzsFCf1QBk",

  // Pedidos especiais que aparecem para marcar na reserva.
  // Pode adicionar, tirar ou renomear à vontade.
  //   nome:     texto da opção
  //   icone:    emoji que aparece na lista
  //   pergunta: (opcional) abre um campo de texto quando marcada
  EXTRAS: [
    { nome: "Foto na taça",    icone: "📷", pergunta: "Detalhes da foto (opcional)" },
    { nome: "Nome na taça",    icone: "✍️", pergunta: "Qual nome vai na taça?" },
    { nome: "Bolo próprio",    icone: "🎂" },
    { nome: "Decoração",       icone: "🎈", pergunta: "Que tipo de decoração?" },
    { nome: "Cadeira de bebê", icone: "👶" }
  ]
};
