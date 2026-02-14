const state = {
  mode: 'solo',
  playerName: localStorage.getItem('kpss_player_name') || '',
  selectedMainCategory: 'all',
  selectedSubCategory: 'all',
  selectedDifficulty: 'all',
  categories: [],
  questions: [],
  answers: [],
  currentIndex: 0,
  score: 0,
  duelCode: null,
};

const el = {
  soloModeBtn: document.getElementById('soloModeBtn'),
  duelModeBtn: document.getElementById('duelModeBtn'),
  categorySection: document.getElementById('categorySection'),
  duelSection: document.getElementById('duelSection'),
  mainCategorySelect: document.getElementById('mainCategorySelect'),
  subCategorySelect: document.getElementById('subCategorySelect'),
  difficultySelect: document.getElementById('difficultySelect'),
  startQuizBtn: document.getElementById('startQuizBtn'),
  createInviteBtn: document.getElementById('createInviteBtn'),
  inviteCodeDisplay: document.getElementById('inviteCodeDisplay'),
  joinCodeInput: document.getElementById('joinCodeInput'),
  joinStatus: document.getElementById('joinStatus'),
  joinInviteBtn: document.getElementById('joinInviteBtn'),
  startDuelQuizBtn: document.getElementById('startDuelQuizBtn'),
  quizSection: document.getElementById('quizSection'),
  quizTitle: document.getElementById('quizTitle'),
  progressBadge: document.getElementById('progressBadge'),
  questionMeta: document.getElementById('questionMeta'),
  questionText: document.getElementById('questionText'),
  choicesContainer: document.getElementById('choicesContainer'),
  feedbackText: document.getElementById('feedbackText'),
  explanationText: document.getElementById('explanationText'),
  nextQuestionBtn: document.getElementById('nextQuestionBtn'),
  resultSection: document.getElementById('resultSection'),
  resultSummary: document.getElementById('resultSummary'),
  duelResultBox: document.getElementById('duelResultBox'),
  restartBtn: document.getElementById('restartBtn'),
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'API hatası');
  return data;
}

async function loadCategories() {
  const data = await api('/api/categories');
  state.categories = data.categories;
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const mains = ['all', ...state.categories.map((c) => c.mainCategory)];
  el.mainCategorySelect.innerHTML = mains
    .map((item) => `<option value="${item}">${item === 'all' ? 'Tümü' : item}</option>`)
    .join('');
  refreshSubCategories();
}

function refreshSubCategories() {
  const main = el.mainCategorySelect.value;
  const match = state.categories.find((c) => c.mainCategory === main);
  const subs = main === 'all' ? ['all'] : ['all', ...(match?.subCategories || [])];
  el.subCategorySelect.innerHTML = subs
    .map((item) => `<option value="${item}">${item === 'all' ? 'Tümü' : item}</option>`)
    .join('');
}

function setMode(mode) {
  state.mode = mode;
  el.quizSection.classList.add('hidden');
  el.resultSection.classList.add('hidden');
  el.duelSection.classList.toggle('hidden', mode !== 'duel');
}

async function startSolo() {
  state.selectedMainCategory = el.mainCategorySelect.value;
  state.selectedSubCategory = el.subCategorySelect.value;
  state.selectedDifficulty = el.difficultySelect.value;

  const query = new URLSearchParams({
    main: state.selectedMainCategory,
    sub: state.selectedSubCategory,
    difficulty: state.selectedDifficulty,
  }).toString();
  const data = await api(`/api/questions?${query}`);
  if (!data.questions.length) {
    alert('Bu filtrede soru bulunamadı.');
    return;
  }
  beginQuiz(data.questions, null);
}

async function createInvite() {
  const hostName = askName('Oyuncu 1');
  if (!hostName) return;
  const data = await api('/api/duels', {
    method: 'POST',
    body: JSON.stringify({ hostName }),
  });
  state.duelCode = data.code;
  el.inviteCodeDisplay.textContent = `Davet kodu: ${data.code}`;
  el.joinStatus.textContent = 'Düello odası oluşturuldu.';
}

async function joinInvite() {
  const code = el.joinCodeInput.value.trim().toUpperCase();
  if (!code) return;
  const data = await api(`/api/duels/${encodeURIComponent(code)}`);
  state.duelCode = data.code;
  el.inviteCodeDisplay.textContent = `Aktif oda: ${data.code}`;
  el.joinStatus.textContent = `Katıldın. ${data.questions.length} soru hazır.`;
}

async function startDuel() {
  if (!state.duelCode) {
    alert('Önce bir düello kodu oluştur veya katıl.');
    return;
  }
  const data = await api(`/api/duels/${encodeURIComponent(state.duelCode)}`);
  beginQuiz(data.questions, state.duelCode);
}

function beginQuiz(questions, duelCode = null) {
  state.questions = questions;
  state.answers = new Array(questions.length).fill(null);
  state.currentIndex = 0;
  state.score = 0;
  state.duelCode = duelCode;
  el.quizSection.classList.remove('hidden');
  el.resultSection.classList.add('hidden');
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  el.quizTitle.textContent = state.mode === 'duel' ? 'Düello Sorusu' : 'Tekli Soru';
  el.progressBadge.textContent = `${state.currentIndex + 1}/${state.questions.length}`;
  el.questionMeta.textContent = `${q.mainCategory} • ${q.subCategory} • Zorluk ${q.difficulty} • Kalite ${q.qualityScore}`;
  el.questionText.textContent = q.stem;
  el.feedbackText.textContent = '';
  el.explanationText.textContent = '';
  el.nextQuestionBtn.classList.add('hidden');

  el.choicesContainer.innerHTML = '';
  q.choices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => submitAnswer(idx));
    el.choicesContainer.appendChild(btn);
  });
}

function submitAnswer(idx) {
  if (state.answers[state.currentIndex] !== null) return;
  const q = state.questions[state.currentIndex];
  state.answers[state.currentIndex] = idx;

  const buttons = [...el.choicesContainer.querySelectorAll('button')];
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) btn.classList.add('correct');
    if (i === idx && idx !== q.correctIndex) btn.classList.add('wrong');
  });

  if (idx === q.correctIndex) {
    const correctCount = state.answers.filter((a, i) => a !== null && a === state.questions[i].correctIndex).length;
    const streakBonus = Math.max(0, correctCount - 1) * 10;
    const gained = 100 + streakBonus;
    state.score += gained;
    el.feedbackText.textContent = `✅ Doğru! +${gained} puan`;
  } else {
    el.feedbackText.textContent = '❌ Yanlış cevap.';
  }
  el.explanationText.textContent = `Açıklama: ${q.explanation}`;
  el.nextQuestionBtn.classList.remove('hidden');
}

async function nextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex < state.questions.length) {
    renderQuestion();
    return;
  }
  await showResult();
}

async function showResult() {
  el.quizSection.classList.add('hidden');
  el.resultSection.classList.remove('hidden');
  el.resultSummary.textContent = `Toplam ${state.questions.length} soruda skorun: ${state.score}`;

  if (state.mode !== 'duel' || !state.duelCode) {
    el.duelResultBox.classList.add('hidden');
    el.duelResultBox.innerHTML = '';
    return;
  }

  const name = askName('Oyuncu');
  if (!name) return;
  const data = await api(`/api/duels/${encodeURIComponent(state.duelCode)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ name, answers: state.answers }),
  });

  el.duelResultBox.classList.remove('hidden');
  const items = data.leaderboard.map((s, i) => `<li>${i + 1}. ${s.name} - ${s.score}</li>`).join('');
  el.duelResultBox.innerHTML = `<h3>Düello Liderlik Tablosu</h3><ul>${items}</ul>`;
}

function askName(fallback) {
  const input = prompt('Oyuncu adın?', state.playerName || fallback);
  if (!input) return null;
  const name = input.trim().slice(0, 30);
  if (!name) return null;
  state.playerName = name;
  localStorage.setItem('kpss_player_name', name);
  return name;
}

function resetApp() {
  state.questions = [];
  state.answers = [];
  state.currentIndex = 0;
  state.score = 0;
  el.quizSection.classList.add('hidden');
  el.resultSection.classList.add('hidden');
}

el.soloModeBtn.addEventListener('click', () => setMode('solo'));
el.duelModeBtn.addEventListener('click', () => setMode('duel'));
el.mainCategorySelect.addEventListener('change', refreshSubCategories);
el.startQuizBtn.addEventListener('click', () => startSolo().catch((e) => alert(e.message)));
el.createInviteBtn.addEventListener('click', () => createInvite().catch((e) => alert(e.message)));
el.joinInviteBtn.addEventListener('click', () => joinInvite().catch((e) => alert(e.message)));
el.startDuelQuizBtn.addEventListener('click', () => startDuel().catch((e) => alert(e.message)));
el.nextQuestionBtn.addEventListener('click', () => nextQuestion().catch((e) => alert(e.message)));
el.restartBtn.addEventListener('click', resetApp);

loadCategories().catch((e) => {
  alert(`API bağlantı hatası: ${e.message}. server.js çalıştırdığından emin ol.`);
});
setMode('solo');
