const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'gift-images';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('AVISO: defina SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente antes de iniciar em produção.');
}

const supabase = (SUPABASE_URL && SUPABASE_SECRET_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)
  : null;

app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureSupabase(res) {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY.' });
    return false;
  }
  return true;
}

function cleanName(value) {
  return String(value || '').trim().slice(0, 60);
}

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function getPersonByName(name) {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPersonById(id) {
  const { data, error } = await supabase.from('people').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrCreatePerson(name) {
  const clean = cleanName(name);
  if (!clean) return null;

  let person = await getPersonByName(clean);
  if (person) return person;

  const { data, error } = await supabase.from('people').insert({ name: clean }).select('*').single();
  if (error) {
    if (error.code === '23505') return getPersonByName(clean);
    throw error;
  }
  return data;
}

async function giftsForPerson(personId) {
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('person_id', personId)
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(g => ({ ...g, claimed: !!g.claimed }));
}

async function peopleWithCounts() {
  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, name')
    .order('name', { ascending: true });
  if (peopleError) throw peopleError;

  const ids = (people || []).map(p => p.id);
  let gifts = [];
  if (ids.length) {
    const { data, error } = await supabase.from('gifts').select('person_id').in('person_id', ids);
    if (error) throw error;
    gifts = data || [];
  }

  const counts = gifts.reduce((acc, g) => {
    acc[g.person_id] = (acc[g.person_id] || 0) + 1;
    return acc;
  }, {});

  return (people || []).map(p => ({ name: p.name, count: counts[p.id] || 0 }));
}

function parseImageData(value) {
  const image = cleanText(value, 5_000_000);
  if (!image) return null;

  const match = image.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    if (/^https?:\/\//i.test(image) && image.length <= 500) return { url: image };
    throw new Error('Imagem inválida ou muito grande');
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 3 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 3 MB.');
  return { buffer, ext, mime };
}

async function uploadGiftImage(imageData) {
  if (!imageData) return '';
  if (imageData.url) return imageData.url;

  const fileName = `gifts/${crypto.randomUUID()}.${imageData.ext}`;
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(fileName, imageData.buffer, {
      contentType: imageData.mime,
      cacheControl: '31536000',
      upsert: false
    });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function deleteGiftImage(url) {
  if (!url || !SUPABASE_URL) return;
  const marker = `/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;
  const pathName = url.slice(index + marker.length);
  if (pathName) await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([pathName]);
}

app.get('/api/people', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    res.json(await peopleWithCounts());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não consegui carregar as pessoas.' });
  }
});

app.post('/api/people/:name/enter', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const person = await getOrCreatePerson(req.params.name);
    if (!person) return res.status(400).json({ error: 'Nome inválido' });
    res.json({ name: person.name, gifts: await giftsForPerson(person.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não consegui entrar na lista.' });
  }
});

app.get('/api/people/:name', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const person = await getPersonByName(cleanName(req.params.name));
    if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });
    res.json({ name: person.name, gifts: await giftsForPerson(person.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não consegui carregar a lista.' });
  }
});

// Edita o nome da pessoa sem perder a lista de presentes.
app.patch('/api/people/:name', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const oldName = cleanName(req.params.name);
    const newName = cleanName(req.body && req.body.name);
    if (!newName) return res.status(400).json({ error: 'Nome inválido' });
    if (newName.toLocaleLowerCase() === oldName.toLocaleLowerCase()) {
      const same = await getPersonByName(oldName);
      if (!same) return res.status(404).json({ error: 'Pessoa não encontrada' });
      return res.json({ name: same.name, gifts: await giftsForPerson(same.id) });
    }

    const person = await getPersonByName(oldName);
    if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });
    const existing = await getPersonByName(newName);
    if (existing && existing.id !== person.id) return res.status(409).json({ error: 'Esse nome já está sendo usado.' });

    const { data, error } = await supabase
      .from('people')
      .update({ name: newName })
      .eq('id', person.id)
      .select('*')
      .single();
    if (error) throw error;

    res.json({ name: data.name, gifts: await giftsForPerson(data.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não consegui alterar o nome.' });
  }
});

app.post('/api/people/:name/gifts', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const person = await getOrCreatePerson(req.params.name);
    if (!person) return res.status(400).json({ error: 'Nome inválido' });

    const { title, note, link, image } = req.body || {};
    const cleanTitle = cleanText(title, 120);
    if (!cleanTitle) return res.status(400).json({ error: 'Título é obrigatório' });
    const cleanNote = cleanText(note, 300);
    const cleanLink = cleanText(link, 300);

    let imageUrl = '';
    if (image) imageUrl = await uploadGiftImage(parseImageData(image));

    const { error } = await supabase.from('gifts').insert({
      person_id: person.id,
      title: cleanTitle,
      note: cleanNote,
      link: cleanLink,
      image: imageUrl
    });
    if (error) throw error;

    res.status(201).json({ name: person.name, gifts: await giftsForPerson(person.id) });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Não consegui adicionar o presente.' });
  }
});

app.patch('/api/gifts/:giftId/claim', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { data: gift, error } = await supabase.from('gifts').select('*').eq('id', req.params.giftId).maybeSingle();
    if (error) throw error;
    if (!gift) return res.status(404).json({ error: 'Item não encontrado' });

    const { error: updateError } = await supabase.from('gifts').update({ claimed: !gift.claimed }).eq('id', gift.id);
    if (updateError) throw updateError;
    const person = await getPersonById(gift.person_id);
    res.json({ name: person.name, gifts: await giftsForPerson(person.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não consegui atualizar o item.' });
  }
});

app.delete('/api/gifts/:giftId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { data: gift, error } = await supabase.from('gifts').select('*').eq('id', req.params.giftId).maybeSingle();
    if (error) throw error;
    if (!gift) return res.status(404).json({ error: 'Item não encontrado' });

    const person = await getPersonById(gift.person_id);
    const { error: deleteError } = await supabase.from('gifts').delete().eq('id', gift.id);
    if (deleteError) throw deleteError;
    await deleteGiftImage(gift.image);
    res.json({ name: person.name, gifts: await giftsForPerson(person.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não consegui remover o item.' });
  }
});

app.listen(PORT, () => {
  console.log(`Amigo Secreto da Família rodando na porta ${PORT}`);
});
