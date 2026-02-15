const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 4173;
const DB_PATH = path.join(__dirname, 'data.json');

const seedQuestions = [
  { id: 'Q1', mainCategory: 'Genel Kültür', subCategory: 'Tarih > Osmanlı', difficulty: 2, tags: ['tarih','osmanli'], stem: 'Lale Devri hangi padişah döneminde yaşanmıştır?', choices: ['III. Ahmed','IV. Murad','II. Mahmud','I. Selim'], correctIndex: 0, explanation: 'Lale Devri, III. Ahmed döneminde (1718-1730) yaşanmıştır.', qualityScore: 4.6 },
  { id: 'Q2', mainCategory: 'Genel Kültür', subCategory: 'Coğrafya > Türkiye Fiziki', difficulty: 3, tags: ['cografya','daglar'], stem: 'Aşağıdaki dağlardan hangisi volkanik kökenlidir?', choices: ['Kaçkar','Ağrı','Uludağ','Yıldız'], correctIndex: 1, explanation: 'Ağrı Dağı volkanik bir dağdır.', qualityScore: 4.4 },
  { id: 'Q3', mainCategory: 'Genel Yetenek', subCategory: 'Türkçe > Dil Bilgisi', difficulty: 2, tags: ['turkce','fiilimsi'], stem: 'Aşağıdakilerden hangisi fiilimsi değildir?', choices: ['Yazarak','Gelince','Kitap','Gidip'], correctIndex: 2, explanation: 'Kitap isimdir; fiilimsi değildir.', qualityScore: 4.1 },
  { id: 'Q4', mainCategory: 'Genel Yetenek', subCategory: 'Matematik > Problemler', difficulty: 3, tags: ['matematik','yas'], stem: 'Bir babanın yaşı oğlunun yaşının 3 katıdır. 6 yıl sonra oran 2 olacaksa oğul kaç yaşındadır?', choices: ['6','8','10','12'], correctIndex: 0, explanation: 'x oğul yaşı olsun. Baba 3x. 6 yıl sonra (3x+6)/(x+6)=2 => x=6.', qualityScore: 4.8 },
  { id: 'Q5', mainCategory: 'Eğitim Bilimleri', subCategory: 'Ölçme ve Değerlendirme', difficulty: 4, tags: ['egitim','gecerlik'], stem: 'Bir testin ölçmek istediği özelliği ölçme derecesi hangi kavramla ifade edilir?', choices: ['Güvenirlik','Geçerlik','Kullanışlılık','Objektiflik'], correctIndex: 1, explanation: 'Ölçme aracının amaca uygunluğu geçerliktir.', qualityScore: 4.3 },
  { id: 'Q6', mainCategory: 'Genel Kültür', subCategory: 'Vatandaşlık', difficulty: 2, tags: ['anayasa','hukuk'], stem: 'Kanun teklif etme yetkisi kime aittir?', choices: ['Cumhurbaşkanı','Milletvekilleri','Anayasa Mahkemesi','Danıştay'], correctIndex: 1, explanation: 'Kanun teklif etme yetkisi milletvekillerine aittir.', qualityScore: 4.5 },
  { id: 'Q7', mainCategory: 'Genel Kültür', subCategory: 'Güncel Bilgiler', difficulty: 1, tags: ['guncel'], stem: 'Türkiye’nin başkenti neresidir?', choices: ['İstanbul','İzmir','Ankara','Bursa'], correctIndex: 2, explanation: 'Türkiye’nin başkenti Ankara’dır.', qualityScore: 4.9 },
  { id: 'Q8', mainCategory: 'Genel Yetenek', subCategory: 'Matematik > Sayılar', difficulty: 1, tags: ['matematik'], stem: '15 + 27 kaçtır?', choices: ['32','42','52','44'], correctIndex: 1, explanation: '15 + 27 = 42.', qualityScore: 4.9 }
];

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { questions: seedQuestions, duels: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sanitizeQuestion(q) {
  const { correctIndex, ...rest } = q;
  return rest;
}

function staticFile(res, filePath) {
  if (!fs.existsSync(filePath)) return notFound(res);
  const ext = path.extname(filePath);
  const map = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = loadDb();

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/categories') {
    const grouped = {};
    db.questions.forEach((q) => {
      if (!grouped[q.mainCategory]) grouped[q.mainCategory] = new Set();
      grouped[q.mainCategory].add(q.subCategory);
    });
    const categories = Object.entries(grouped).map(([main, subs]) => ({ mainCategory: main, subCategories: [...subs].sort() }));
    return json(res, 200, { categories: categories.sort((a,b)=>a.mainCategory.localeCompare(b.mainCategory,'tr')) });
  }

  if (req.method === 'GET' && url.pathname === '/api/questions') {
    const main = url.searchParams.get('main') || 'all';
    const sub = url.searchParams.get('sub') || 'all';
    const difficulty = url.searchParams.get('difficulty') || 'all';
    let pool = db.questions.filter((q) => {
      const mainOk = main === 'all' || q.mainCategory === main;
      const subOk = sub === 'all' || q.subCategory === sub;
      const diffOk = difficulty === 'all' || q.difficulty === Number(difficulty);
      return mainOk && subOk && diffOk;
    });
    pool = shuffle(pool).slice(0, 5).map(sanitizeQuestion);
    return json(res, 200, { questions: pool });
  }

  if (req.method === 'POST' && url.pathname === '/api/duels') {
    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;
    const hostName = (body.hostName || 'Oyuncu 1').toString().slice(0, 30);
    const code = `KPSS-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const questionIds = shuffle(db.questions).slice(0, 5).map((q) => q.id);
    const duel = { id: randomUUID(), code, hostName, questionIds, participants: [hostName], submissions: [], createdAt: Date.now() };
    db.duels.push(duel);
    saveDb(db);
    return json(res, 201, { code, duelId: duel.id, questionCount: duel.questionIds.length });
  }

  if (req.method === 'GET' && url.pathname.match(/^\/api\/duels\/[^/]+$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });
    const questions = duel.questionIds
      .map((id) => db.questions.find((q) => q.id === id))
      .filter(Boolean)
      .map(sanitizeQuestion);
    return json(res, 200, { code: duel.code, questions, participants: duel.participants || [], submissions: duel.submissions });
  }


  if (req.method === 'POST' && url.pathname.match(/^\/api\/duels\/[^/]+\/join$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });
    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;
    const name = (body.name || 'Oyuncu').toString().slice(0, 30);
    duel.participants = duel.participants || [];
    if (!duel.participants.includes(name)) duel.participants.push(name);
    saveDb(db);
    return json(res, 200, { code: duel.code, participants: duel.participants });
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/duels\/[^/]+\/submit$/)) {
    const parts = url.pathname.split('/');
    const code = decodeURIComponent(parts[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });

    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;

    const name = (body.name || 'Oyuncu').toString().slice(0, 30);
    const answers = Array.isArray(body.answers) ? body.answers : [];

    let score = 0;
    let streak = 0;
    duel.questionIds.forEach((id, idx) => {
      const q = db.questions.find((item) => item.id === id);
      if (!q) return;
      if (answers[idx] === q.correctIndex) {
        streak += 1;
        score += 100 + (streak - 1) * 10;
      } else {
        streak = 0;
      }
    });

    const existing = duel.submissions.find((s) => s.name === name);
    if (existing) {
      existing.score = score;
      existing.updatedAt = Date.now();
    } else {
      duel.submissions.push({ name, score, updatedAt: Date.now() });
    }
    duel.submissions.sort((a, b) => b.score - a.score);
    saveDb(db);
    return json(res, 200, { score, leaderboard: duel.submissions });
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return staticFile(res, path.join(__dirname, 'index.html'));
  }
  if (req.method === 'GET' && url.pathname === '/duel.html') {
    return staticFile(res, path.join(__dirname, 'duel.html'));
  }
  if (req.method === 'GET' && ['/style.css', '/app.js', '/duel.js'].includes(url.pathname)) {
    return staticFile(res, path.join(__dirname, url.pathname.slice(1)));
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`KPSS Quiz Arena running on http://localhost:${PORT}`);
});
