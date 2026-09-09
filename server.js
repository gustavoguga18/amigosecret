require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Faltam as variáveis de ambiente SUPABASE_URL e/ou SUPABASE_SECRET_KEY.');
  process.exit(1);
}

// A secret key tem privilégio total no banco — por isso ela só é usada aqui no
// servidor, nunca é enviada ao navegador do usuário.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
async function getPersonByName(name) {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createPerson(name) {
  const { data, error } = await supabase
    .from('people')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getOrCreatePerson(name) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) return null;
  const existing = await getPersonByName(clean);
  if (existing) return existing;
  return createPerson(clean);
}

async function giftsForPerson(personId) {
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('person_id', personId)
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

function validateImage(image) {
  const cleanImage = String(image || '').trim();
  const isHttpImage = /^https?:\/\//i.test(cleanImage) && cleanImage.length <= 500;
  const isUploadedImage = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(cleanImage)
    && cleanImage.length <= 4_500_000;
  return (isHttpImage || isUploadedImage) ? cleanImage : '';
}

// --- API ---

// Lista todas as pessoas com a contagem de itens
app.get('/api/people', async (req, res) => {
  try {
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) throw error;

    const withCounts = await Promise.all(people.map(async (p) => {
      const { count, error: cErr } = await supabase
        .from('gifts')
        .select('*', { count: 'exact', head: true })
        .eq('person_id', p.id);
      if (cErr) throw cErr;
      return { name: p.name, count: count || 0 };
    }));

    res.json(withCounts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar pessoas' });
  }
});

// Entra/cria uma pessoa e devolve a lista dela
app.post('/api/people/:name/enter', async (req, res) => {
  try {
    const person = await getOrCreatePerson(req.params.name);
    if (!person) return res.status(400).json({ error: 'Nome inválido' });
    const gifts = await giftsForPerson(person.id);
    res.json({ name: person.name, gifts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao entrar' });
  }
});

// Pega a lista de uma pessoa (sem criar)
app.get('/api/people/:name', async (req, res) => {
  try {
    const person = await getPersonByName(req.params.name.trim());
    if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });
    const gifts = await giftsForPerson(person.id);
    res.json({ name: person.name, gifts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar pessoa' });
  }
});

// Renomeia uma pessoa (mantém a mesma lista de presentes)
app.patch('/api/people/:name', async (req, res) => {
  try {
    const oldName = req.params.name.trim();
    const newName = String((req.body || {}).name || '').trim().slice(0, 60);
    if (!newName) return res.status(400).json({ error: 'Novo nome é obrigatório' });

    const person = await getPersonByName(oldName);
    if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });

    const clash = await getPersonByName(newName);
    if (clash && clash.id !== person.id) {
      return res.status(409).json({ error: 'Já existe alguém com esse nome' });
    }

    const { data, error } = await supabase
      .from('people')
      .update({ name: newName })
      .eq('id', person.id)
      .select()
      .single();
    if (error) throw error;

    const gifts = await giftsForPerson(data.id);
    res.json({ name: data.name, gifts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao renomear' });
  }
});

// Adiciona um presente à lista de alguém
app.post('/api/people/:name/gifts', async (req, res) => {
  try {
    const person = await getOrCreatePerson(req.params.name);
    if (!person) return res.status(400).json({ error: 'Nome inválido' });

    const { title, note, link, image } = req.body || {};
    const cleanTitle = String(title || '').trim().slice(0, 120);
    if (!cleanTitle) return res.status(400).json({ error: 'Título é obrigatório' });
    const cleanNote = String(note || '').trim().slice(0, 300);
    const cleanLink = String(link || '').trim().slice(0, 300);
    const validImage = validateImage(image);

    const { error } = await supabase.from('gifts').insert({
      person_id: person.id,
      title: cleanTitle,
      note: cleanNote,
      link: cleanLink,
      image: validImage,
    });
    if (error) throw error;

    const gifts = await giftsForPerson(person.id);
    res.status(201).json({ name: person.name, gifts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao adicionar presente' });
  }
});

// Alterna o status "reservado" de um item.
// A pessoa que reservou o item é registrada em claimed_by.
// Somente ela pode desfazer a própria reserva.
app.patch('/api/gifts/:giftId/claim', async (req, res) => {
  try {
    const user = String((req.body || {}).user || '').trim().slice(0, 60);
    if (!user) {
      return res.status(400).json({ error: 'Usuário é obrigatório' });
    }

    const { data: gift, error: gErr } = await supabase
      .from('gifts')
      .select('*')
      .eq('id', req.params.giftId)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!gift) return res.status(404).json({ error: 'Item não encontrado' });

    let update;

    if (!gift.claimed) {
      // Item livre: quem clicar passa a ser o responsável pela reserva.
      update = { claimed: true, claimed_by: user };
    } else {
      // Item já reservado: somente quem reservou pode desfazer.
      if (gift.claimed_by !== user) {
        return res.status(403).json({
          error: 'Este item já foi reservado por outra pessoa.'
        });
      }

      update = { claimed: false, claimed_by: null };
    }

    const { error } = await supabase
      .from('gifts')
      .update(update)
      .eq('id', gift.id);

    if (error) throw error;

    const { data: person, error: pErr } = await supabase
      .from('people')
      .select('*')
      .eq('id', gift.person_id)
      .single();

    if (pErr) throw pErr;

    const gifts = await giftsForPerson(person.id);
    res.json({
      name: person.name,
      gifts,
      claimed: update.claimed
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

// Remove um item da própria lista
app.delete('/api/gifts/:giftId', async (req, res) => {
  try {
    const { data: gift, error: gErr } = await supabase
      .from('gifts').select('*').eq('id', req.params.giftId).maybeSingle();
    if (gErr) throw gErr;
    if (!gift) return res.status(404).json({ error: 'Item não encontrado' });

    const { data: person, error: pErr } = await supabase
      .from('people').select('*').eq('id', gift.person_id).single();
    if (pErr) throw pErr;

    const { error } = await supabase.from('gifts').delete().eq('id', gift.id);
    if (error) throw error;

    const gifts = await giftsForPerson(person.id);
    res.json({ name: person.name, gifts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao remover item' });
  }
});

app.listen(PORT, () => {
  console.log(`Amigo Secreto da Família rodando na porta ${PORT}`);
});
