const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 4173;
const DB_PATH = path.join(__dirname, 'data.json');
const REGULAR_QUESTION_COUNT = 10;
const QUESTION_DURATION_MS = 10_000;
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
    if (!Array.isArray(parsed.questions) || !Array.isArray(parsed.duels)) {
      throw new Error('Geçersiz data.json şeması');
    }
    return parsed;
  } catch (error) {
    console.error('data.json okunamadı, dosya sıfırlanıyor:', error.message);
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
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
      if (raw.length > 1e6) reject(new Error('Payload too large'));
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

function staticFile(res, filePath) {
  if (!fs.existsSync(filePath)) return notFound(res);
  const ext = path.extname(filePath);
  const map = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

function pickQuestionIds(bank, count) {
  if (!bank.length) return [];
  const shuffled = shuffle(bank.map((q) => q.id));
  const ids = [];
  while (ids.length < count) {
    ids.push(shuffled[ids.length % shuffled.length]);
  }
  return ids;
}

function getQuestionById(db, id) {
  return db.questions.find((q) => q.id === id) || null;
}

function getQuestionForIndex(duel, db, index) {
  if (index < REGULAR_QUESTION_COUNT) {
    return getQuestionById(db, duel.regularQuestionIds[index]);
  }
  const suddenIdx = (index - REGULAR_QUESTION_COUNT) % duel.suddenQuestionIds.length;
  return getQuestionById(db, duel.suddenQuestionIds[suddenIdx]);
}

function isCorrectForIndex(duel, db, index, choiceIndex) {
  const q = getQuestionForIndex(duel, db, index);
  if (!q) return false;
  return q.correctIndex === choiceIndex;
}

function computeRegularScores(duel, db) {
  const scores = {};
  (duel.participants || []).forEach((name) => {
    const answers = duel.playerAnswers?.[name] || [];
    let score = 0;
    for (let i = 0; i < REGULAR_QUESTION_COUNT; i += 1) {
      if (isCorrectForIndex(duel, db, i, answers[i])) score += 1;
    }
    scores[name] = score;
  });
  return scores;
}

function computeCurrentIndex(duel, now) {
  if (!duel.questionStartAt || now < duel.questionStartAt) return -1;
  if (duel.phase === 'question') {
    return Math.floor((now - duel.questionStartAt) / QUESTION_DURATION_MS);
  }
  if (duel.phase === 'sudden_death') {
    const suddenElapsed = now - duel.suddenStartAt;
    return REGULAR_QUESTION_COUNT + Math.floor(suddenElapsed / QUESTION_DURATION_MS);
  }
  return -1;
}

function updateDuelState(duel, db) {
  const now = Date.now();
  if (!duel.phase) duel.phase = 'waiting';

  if (duel.phase === 'waiting' && duel.participants.length === 2) {
    duel.phase = 'countdown';
    duel.countdownStartAt = now;
    duel.questionStartAt = now + COUNTDOWN_MS;
  }

  if (duel.phase === 'countdown' && now >= duel.questionStartAt) {
    duel.phase = 'question';
  }

  const regularEndAt = (duel.questionStartAt || now) + REGULAR_QUESTION_COUNT * QUESTION_DURATION_MS;

  if (duel.phase === 'question' && now >= regularEndAt) {
    const scores = computeRegularScores(duel, db);
    const [a, b] = duel.participants;
    if (scores[a] !== scores[b]) {
      duel.phase = 'finished';
      duel.winner = scores[a] > scores[b] ? a : b;
      duel.finalScores = scores;
    } else {
      duel.phase = 'sudden_death';
      duel.suddenStartAt = regularEndAt;
    }
  }

  if (duel.phase === 'sudden_death') {
    const [a, b] = duel.participants;
    const completedRounds = Math.floor((now - duel.suddenStartAt) / QUESTION_DURATION_MS);
    for (let round = 0; round < completedRounds; round += 1) {
      const idx = REGULAR_QUESTION_COUNT + round;
      const aAnswer = duel.playerAnswers?.[a]?.[idx];
      const bAnswer = duel.playerAnswers?.[b]?.[idx];
      const aCorrect = isCorrectForIndex(duel, db, idx, aAnswer);
      const bCorrect = isCorrectForIndex(duel, db, idx, bAnswer);
      if (aCorrect && !bCorrect) {
        duel.phase = 'finished';
        duel.winner = a;
        break;
      }
      if (bCorrect && !aCorrect) {
        duel.phase = 'finished';
        duel.winner = b;
        break;
      }
    }

    if (duel.phase === 'finished') {
      const regularScores = computeRegularScores(duel, db);
      duel.finalScores = {
        ...regularScores,
        [duel.winner]: (regularScores[duel.winner] || 0) + 1,
      };
    }
  }

  return duel;
}

function getAnswerStatus(duel, currentIndex) {
  return (duel.participants || []).map((name) => ({
    name,
    answered: duel.playerAnswers?.[name]?.[currentIndex] !== undefined,
  }));
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
      hostName,
      participants: [hostName],
      regularQuestionIds: pickQuestionIds(db.questions, REGULAR_QUESTION_COUNT),
      suddenQuestionIds: pickQuestionIds(db.questions, 50),
      playerAnswers: { [hostName]: [] },
      phase: 'waiting',
      createdAt: Date.now(),
      winner: null,
      finalScores: null,
    };
    db.duels.push(duel);
    saveDb(db);
    return json(res, 201, { code, duelId: duel.id });
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/duels\/[^/]+\/join$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });

    const body = await parseBody(req).catch((e) => json(res, 400, { error: e.message }));
    if (!body || res.writableEnded) return;

    const name = (body.name || 'Oyuncu').toString().slice(0, 30);
    if (!duel.participants.includes(name)) {
      if (duel.participants.length >= 2) return json(res, 400, { error: 'Oda dolu (maksimum 2 oyuncu).' });
      duel.participants.push(name);
      duel.playerAnswers[name] = [];
    }

    updateDuelState(duel, db);
    saveDb(db);
    return json(res, 200, { code: duel.code, participants: duel.participants, phase: duel.phase });
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
    if (!['question', 'sudden_death'].includes(duel.phase)) return json(res, 400, { error: 'Cevap için uygun aşama değil.' });

    const currentIndex = computeCurrentIndex(duel, Date.now());
    if (currentIndex < 0) return json(res, 400, { error: 'Soru henüz başlamadı.' });

    duel.playerAnswers[name] = duel.playerAnswers[name] || [];
    if (duel.playerAnswers[name][currentIndex] === undefined) {
      duel.playerAnswers[name][currentIndex] = Number.isFinite(choiceIndex) ? choiceIndex : null;
    }

    updateDuelState(duel, db);
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname.match(/^\/api\/duels\/[^/]+$/)) {
    const code = decodeURIComponent(url.pathname.split('/')[3]);
    const duel = db.duels.find((d) => d.code === code);
    if (!duel) return json(res, 404, { error: 'Düello bulunamadı' });

    updateDuelState(duel, db);
    saveDb(db);

    const now = Date.now();
    const scores = computeRegularScores(duel, db);

    let currentIndex = -1;
    let timerLeft = null;
    let question = null;
    if (['question', 'sudden_death'].includes(duel.phase)) {
      currentIndex = computeCurrentIndex(duel, now);
      const phaseStart = duel.phase === 'question' ? duel.questionStartAt : duel.suddenStartAt;
      const elapsed = now - phaseStart;
      timerLeft = Math.max(0, 10 - Math.floor((elapsed % QUESTION_DURATION_MS) / 1000));
      const q = getQuestionForIndex(duel, db, currentIndex);
      if (q) {
        const { correctIndex, ...rest } = q;
        question = { ...rest, index: currentIndex + 1 };
      }
    }

    const countdown = duel.phase === 'countdown'
      ? Math.max(0, 3 - Math.floor((now - duel.countdownStartAt) / 1000))
      : null;

    return json(res, 200, {
      code: duel.code,
      phase: duel.phase,
      participants: duel.participants,
      scores,
      winner: duel.winner,
      finalScores: duel.finalScores,
      countdown,
      timerLeft,
      totalQuestions: REGULAR_QUESTION_COUNT,
      question,
      answerStatus: currentIndex >= 0 ? getAnswerStatus(duel, currentIndex) : [],
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
