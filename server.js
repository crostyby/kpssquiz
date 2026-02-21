const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 4173;
const DB_PATH = path.join(__dirname, 'data.json');

const REGULAR_QUESTION_COUNT = 10;
const ANSWER_DURATION_MS = 10_000;
const REVEAL_DURATION_MS = 2_000;
const SLOT_DURATION_MS = ANSWER_DURATION_MS + REVEAL_DURATION_MS;
const COUNTDOWN_MS = 4_000; // 3-2-1-0

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

function createInitialDb() {
  return { questions: seedQuestions, duels: [] };
}

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!Array.isArray(parsed.questions) || !Array.isArray(parsed.duels)) throw new Error('bad schema');
    return parsed;
  } catch {
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function saveDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
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
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 1e6) reject(new Error('Payload too large')); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
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

function staticFile(res, filePath) {
  if (!fs.existsSync(filePath)) return notFound(res);
  const ext = path.extname(filePath);
  const map = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

function pickQuestionIds(bank, count) {
  const ids = [];
  const shuffled = shuffle(bank.map((q) => q.id));
  while (ids.length < count) ids.push(shuffled[ids.length % shuffled.length]);
  return ids;
}
function getQuestionById(db, id) { return db.questions.find((q) => q.id === id) || null; }

function computeRegularScores(duel, db) {
  const out = {};
  (duel.participants || []).forEach((name) => {
    const answers = duel.playerAnswers?.[name] || [];
    let score = 0;
    for (let i = 0; i < REGULAR_QUESTION_COUNT; i += 1) {
      const q = getQuestionById(db, duel.regularQuestionIds[i]);
      if (q && answers[i]?.choiceIndex === q.correctIndex) score += 1;
    }
    out[name] = score;
  });
  return out;
}

function computeTotalTimes(duel) {
  const out = {};
  (duel.participants || []).forEach((name) => {
    const answers = duel.playerAnswers?.[name] || [];
    let totalMs = 0;
    for (let i = 0; i < REGULAR_QUESTION_COUNT; i += 1) {
      totalMs += Number.isFinite(answers[i]?.responseMs) ? answers[i].responseMs : ANSWER_DURATION_MS;
    }
    out[name] = totalMs;
  });
  return out;
}

function ensureCountdownStart(duel) {
  if (duel.phase === 'waiting' && duel.participants.length === 2) {
    duel.phase = 'countdown';
    duel.countdownStartAt = Date.now();
    duel.quizStartAt = duel.countdownStartAt + COUNTDOWN_MS;
    duel.joinNotice = `${duel.participants[1]} odaya katıldı`;
  }
}

function updateDuelState(duel, db) {
  const now = Date.now();
  if (!duel.phase) duel.phase = 'waiting';
  ensureCountdownStart(duel);

  if (duel.phase === 'countdown' && now >= duel.quizStartAt) duel.phase = 'question';

  if (duel.phase === 'question') {
    const elapsed = now - duel.quizStartAt;
    const endAt = REGULAR_QUESTION_COUNT * SLOT_DURATION_MS;
    if (elapsed >= endAt) {
      duel.phase = 'finished';
      const scores = computeRegularScores(duel, db);
      const times = computeTotalTimes(duel);
      const [a, b] = duel.participants;
      duel.finalScores = scores;
      duel.finalTimesMs = times;
      if (scores[a] > scores[b]) duel.winner = a;
      else if (scores[b] > scores[a]) duel.winner = b;
      else duel.winner = times[a] <= times[b] ? a : b;
    }
  }

  return duel;
}

function getQuestionState(duel, db, now, playerName) {
  if (duel.phase !== 'question') return { question: null, subPhase: null, timerLeft: null, firstResponder: null, myAnswer: null };

  const elapsed = now - duel.quizStartAt;
  const questionIndex = Math.floor(elapsed / SLOT_DURATION_MS);
  if (questionIndex < 0 || questionIndex >= REGULAR_QUESTION_COUNT) {
    return { question: null, subPhase: null, timerLeft: null, firstResponder: null, myAnswer: null };
  }

  const msInSlot = elapsed % SLOT_DURATION_MS;
  const subPhase = msInSlot < ANSWER_DURATION_MS ? 'answer' : 'reveal';
  const timerLeft = subPhase === 'answer'
    ? Math.max(0, 10 - Math.floor(msInSlot / 1000))
    : Math.max(0, 2 - Math.floor((msInSlot - ANSWER_DURATION_MS) / 1000));

  const q = getQuestionById(db, duel.regularQuestionIds[questionIndex]);
  if (!q) return { question: null, subPhase, timerLeft, firstResponder: null, myAnswer: null };

  const answerObjects = (duel.participants || [])
    .map((name) => ({ name, entry: duel.playerAnswers?.[name]?.[questionIndex] }))
    .filter((x) => x.entry && Number.isFinite(x.entry.answeredAt));
  answerObjects.sort((a, b) => a.entry.answeredAt - b.entry.answeredAt);
  const firstResponder = answerObjects[0]?.name || null;

  const myAnswer = playerName ? duel.playerAnswers?.[playerName]?.[questionIndex] || null : null;

  const question = {
    index: questionIndex + 1,
    total: REGULAR_QUESTION_COUNT,
    mainCategory: q.mainCategory,
    subCategory: q.subCategory,
    difficulty: q.difficulty,
    stem: q.stem,
    choices: q.choices,
    correctIndex: subPhase === 'reveal' ? q.correctIndex : null,
  };

  return { question, subPhase, timerLeft, firstResponder, myAnswer };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = loadDb();

  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });

  if (req.method === 'GET' && url.pathname === '/api/categories') {
    const grouped = {};
    db.questions.forEach((q) => {
      if (!grouped[q.mainCategory]) grouped[q.mainCategory] = new Set();
      grouped[q.mainCategory].add(q.subCategory);
    });
    const categories = Object.entries(grouped).map(([main, subs]) => ({ mainCategory: main, subCategories: [...subs].sort() }));
    return json(res, 200, { categories: categories.sort((a, b) => a.mainCategory.localeCompare(b.mainCategory, 'tr')) });
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
    pool = shuffle(pool).slice(0, 5).map(({ correctIndex, ...rest }) => rest);
    return json(res, 200, { questions: pool });
  }

  if (req.method === 'POST' && url.pathname === '/api/duels') {
    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;
    const hostName = (body.hostName || 'Oyuncu 1').toString().slice(0, 30);
    const code = `KPSS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const duel = {
      id: randomUUID(),
      code,
      participants: [hostName],
      regularQuestionIds: pickQuestionIds(db.questions, REGULAR_QUESTION_COUNT),
      playerAnswers: { [hostName]: [] },
      phase: 'waiting',
      createdAt: Date.now(),
      winner: null,
      finalScores: null,
      finalTimesMs: null,
      joinNotice: null,
    };
    db.duels.push(duel);
    saveDb(db);
    return json(res, 201, { code });
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/duels\/[^/]+\/join$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });

    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;
    const name = (body.name || 'Oyuncu').toString().slice(0, 30);

    if (!duel.participants.includes(name)) {
      if (duel.participants.length >= 2) return json(res, 400, { error: 'Oda dolu (2 oyuncu).' });
      duel.participants.push(name);
      duel.playerAnswers[name] = [];
    }

    updateDuelState(duel, db);
    saveDb(db);
    return json(res, 200, { code: duel.code, participants: duel.participants, phase: duel.phase, joinNotice: duel.joinNotice });
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/duels\/[^/]+\/answer$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });

    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;

    const name = (body.name || '').toString().slice(0, 30);
    const choiceIndex = Number(body.choiceIndex);
    if (!duel.participants.includes(name)) return json(res, 400, { error: 'Oyuncu odada değil.' });

    updateDuelState(duel, db);
    if (duel.phase !== 'question') return json(res, 400, { error: 'Şu an cevap aşaması değil.' });

    const now = Date.now();
    const elapsed = now - duel.quizStartAt;
    const qIndex = Math.floor(elapsed / SLOT_DURATION_MS);
    const msInSlot = elapsed % SLOT_DURATION_MS;
    if (qIndex < 0 || qIndex >= REGULAR_QUESTION_COUNT) return json(res, 400, { error: 'Soru aralığı dışında.' });
    if (msInSlot >= ANSWER_DURATION_MS) return json(res, 400, { error: 'Cevap süresi bitti.' });

    duel.playerAnswers[name] = duel.playerAnswers[name] || [];
    if (!duel.playerAnswers[name][qIndex]) {
      duel.playerAnswers[name][qIndex] = {
        choiceIndex: Number.isFinite(choiceIndex) ? choiceIndex : null,
        answeredAt: now,
        responseMs: msInSlot,
      };
    }

    saveDb(db);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname.match(/^\/api\/duels\/[^/]+$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });

    updateDuelState(duel, db);
    saveDb(db);

    const playerName = (url.searchParams.get('name') || '').slice(0, 30);
    const now = Date.now();
    const scores = computeRegularScores(duel, db);
    const totalTimesMs = computeTotalTimes(duel);
    const qState = getQuestionState(duel, db, now, playerName);
    const countdown = duel.phase === 'countdown'
      ? Math.max(0, 3 - Math.floor((now - duel.countdownStartAt) / 1000))
      : null;

    return json(res, 200, {
      code: duel.code,
      phase: duel.phase,
      participants: duel.participants,
      joinNotice: duel.joinNotice,
      countdown,
      subPhase: qState.subPhase,
      timerLeft: qState.timerLeft,
      question: qState.question,
      firstResponder: qState.firstResponder,
      myAnswer: qState.myAnswer,
      scores,
      totalTimesMs,
      winner: duel.winner,
      finalScores: duel.finalScores,
      finalTimesMs: duel.finalTimesMs,
    });
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

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} zaten kullanımda. Farklı port için: PORT=5000 node server.js`);
    process.exit(1);
  }
  console.error('Sunucu başlatılamadı:', error);
  process.exit(1);
});
