const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'amigo-secreto.db');

// --- Banco de dados ---
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    price TEXT DEFAULT 'medio',
    note TEXT,
    link TEXT,
    image TEXT,
    claimed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migração: adiciona a coluna "image" em bancos criados antes dessa versão
const giftColumns = db.prepare("PRAGMA table_info(gifts)").all().map(c => c.name);
if (!giftColumns.includes('image')) {
  db.exec('ALTER TABLE gifts ADD COLUMN image TEXT');
}

// --- Helpers ---
function getOrCreatePerson(name) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) return null;
  let person = db.prepare('SELECT * FROM people WHERE name = ?').get(clean);
  if (!person) {
    const info = db.prepare('INSERT INTO people (name) VALUES (?)').run(clean);
    person = db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid);
  }
  return person;
}

function giftsForPerson(personId) {
  return db.prepare('SELECT * FROM gifts WHERE person_id = ? ORDER BY id ASC').all(personId)
    .map(g => ({ ...g, claimed: !!g.claimed }));
}

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---

// Lista todas as pessoas com a contagem de itens
app.get('/api/people', (req, res) => {
  const people = db.prepare('SELECT id, name FROM people ORDER BY name COLLATE NOCASE ASC').all();
  const withCounts = people.map(p => {
    const count = db.prepare('SELECT COUNT(*) AS c FROM gifts WHERE person_id = ?').get(p.id).c;
    return { name: p.name, count };
  });
  res.json(withCounts);
});

// Entra/cria uma pessoa e devolve a lista dela
app.post('/api/people/:name/enter', (req, res) => {
  const person = getOrCreatePerson(req.params.name);
  if (!person) return res.status(400).json({ error: 'Nome inválido' });
  res.json({ name: person.name, gifts: giftsForPerson(person.id) });
});

// Pega a lista de uma pessoa (sem criar)
app.get('/api/people/:name', (req, res) => {
  const person = db.prepare('SELECT * FROM people WHERE name = ?').get(req.params.name.trim());
  if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });
  res.json({ name: person.name, gifts: giftsForPerson(person.id) });
});

// Adiciona um presente à lista de alguém
app.post('/api/people/:name/gifts', (req, res) => {
  const person = getOrCreatePerson(req.params.name);
  if (!person) return res.status(400).json({ error: 'Nome inválido' });

  const { title, price, note, link, image } = req.body || {};
  const cleanTitle = String(title || '').trim().slice(0, 120);
  if (!cleanTitle) return res.status(400).json({ error: 'Título é obrigatório' });

  const allowedPrices = ['baixo', 'medio', 'alto'];
  const cleanPrice = allowedPrices.includes(price) ? price : 'medio';
  const cleanNote = String(note || '').trim().slice(0, 300);
  const cleanLink = String(link || '').trim().slice(0, 300);
  const cleanImage = String(image || '').trim().slice(0, 500);
  const validImage = /^https?:\/\//i.test(cleanImage) ? cleanImage : '';

  db.prepare(
    'INSERT INTO gifts (person_id, title, price, note, link, image) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(person.id, cleanTitle, cleanPrice, cleanNote, cleanLink, validImage);

  res.status(201).json({ name: person.name, gifts: giftsForPerson(person.id) });
});

// Alterna o status "reservado" de um item
app.patch('/api/gifts/:giftId/claim', (req, res) => {
  const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.giftId);
  if (!gift) return res.status(404).json({ error: 'Item não encontrado' });
  const newVal = gift.claimed ? 0 : 1;
  db.prepare('UPDATE gifts SET claimed = ? WHERE id = ?').run(newVal, gift.id);
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(gift.person_id);
  res.json({ name: person.name, gifts: giftsForPerson(person.id) });
});

// Remove um item da própria lista
app.delete('/api/gifts/:giftId', (req, res) => {
  const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.giftId);
  if (!gift) return res.status(404).json({ error: 'Item não encontrado' });
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(gift.person_id);
  db.prepare('DELETE FROM gifts WHERE id = ?').run(gift.id);
  res.json({ name: person.name, gifts: giftsForPerson(person.id) });
});

app.listen(PORT, () => {
  console.log(`Amigo Secreto da Família rodando em http://localhost:${PORT}`);
});
