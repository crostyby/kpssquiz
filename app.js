const state = {
  mode: 'solo',
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
  duelSection: document.getElementById('duelSection'),
  mainCategorySelect: document.getElementById('mainCategorySelect'),
  subCategorySelect: document.getElementById('subCategorySelect'),
  difficultySelect: document.getElementById('difficultySelect'),
  startQuizBtn: document.getElementById('startQuizBtn'),
  createInviteBtn: document.getElementById('createInviteBtn'),
  copyInviteBtn: document.getElementById('copyInviteBtn'),
  inviteCodeDisplay: document.getElementById('inviteCodeDisplay'),
  joinCodeInput: document.getElementById('joinCodeInput'),
  joinStatus: document.getElementById('joinStatus'),
  joinInviteBtn: document.getElementById('joinInviteBtn'),
  startDuelQuizBtn: document.getElementById('startDuelQuizBtn'),
  playerNameInput: document.getElementById('playerNameInput'),
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

function getPlayerName() {
  const input = (el.playerNameInput.value || '').trim().slice(0, 30);
  if (!input) {
    alert('Lütfen önce oyuncu adını yaz.');
    return null;
  }
  return input;
}

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
  const query = new URLSearchParams({
    main: el.mainCategorySelect.value,
    sub: el.subCategorySelect.value,
    difficulty: el.difficultySelect.value,
  }).toString();

  const data = await api(`/api/questions?${query}`);
  if (!data.questions.length) {
    alert('Bu filtrede soru bulunamadı.');
    return;
  }

  state.questions = data.questions;
  state.answers = new Array(data.questions.length).fill(null);
  state.currentIndex = 0;
  state.score = 0;
  el.quizSection.classList.remove('hidden');
  el.resultSection.classList.add('hidden');
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  el.quizTitle.textContent = 'Tekli Soru';
  el.progressBadge.textContent = `${state.currentIndex + 1}/${state.questions.length}`;
  el.questionMeta.textContent = `${q.mainCategory} • ${q.subCategory} • Zorluk ${q.difficulty}`;
  el.questionText.textContent = q.stem;
  el.feedbackText.textContent = '';
  el.explanationText.textContent = '';
  el.nextQuestionBtn.classList.add('hidden');

  el.choicesContainer.innerHTML = '';
  q.choices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => {
      if (state.answers[state.currentIndex] !== null) return;
      state.answers[state.currentIndex] = idx;
      [...el.choicesContainer.querySelectorAll('button')].forEach((item, i) => {
        item.disabled = true;
        if (i === q.correctIndex) item.classList.add('correct');
        if (i === idx && idx !== q.correctIndex) item.classList.add('wrong');
      });
      if (idx === q.correctIndex) state.score += 1;
      el.feedbackText.textContent = idx === q.correctIndex ? '✅ Doğru!' : '❌ Yanlış';
      el.explanationText.textContent = `Açıklama: ${q.explanation}`;
      el.nextQuestionBtn.classList.remove('hidden');
    });
    el.choicesContainer.appendChild(btn);
  });
}

function nextSoloQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex < state.questions.length) {
    renderQuestion();
    return;
  }
  el.quizSection.classList.add('hidden');
  el.resultSection.classList.remove('hidden');
  el.resultSummary.textContent = `Skorun: ${state.score}`;
  el.duelResultBox.classList.add('hidden');
}

async function createInvite() {
  const hostName = getPlayerName();
  if (!hostName) return;
  const data = await api('/api/duels', {
    method: 'POST',
    body: JSON.stringify({ hostName }),
  });
  state.duelCode = data.code;
  el.inviteCodeDisplay.textContent = `Davet kodu: ${data.code}`;
  el.joinCodeInput.value = data.code;
  el.joinStatus.textContent = 'Oda oluşturuldu. Düello ekranı açılıyor...';
  window.open(`/duel.html?code=${encodeURIComponent(state.duelCode)}&name=${encodeURIComponent(hostName)}`, '_blank');
}

async function copyInviteCode() {
  if (!state.duelCode) {
    alert('Önce oda oluşturmalısın.');
    return;
  }
  await navigator.clipboard.writeText(state.duelCode);
  el.joinStatus.textContent = 'Kod panoya kopyalandı ✅';
}

async function joinInvite() {
  const code = (el.joinCodeInput.value || '').trim().toUpperCase();
  const name = getPlayerName();
  if (!code || !name) return;

  await api(`/api/duels/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  state.duelCode = code;
  el.inviteCodeDisplay.textContent = `Aktif oda: ${code}`;
  el.joinStatus.textContent = 'Odaya katıldın. Düello ekranı açılıyor...';
  window.open(`/duel.html?code=${encodeURIComponent(state.duelCode)}&name=${encodeURIComponent(name)}`, '_blank');
}

async function openDuelWindow() {
  alert('Artık oda oluşturma veya katılma sonrası düello ekranı otomatik açılıyor.');
}

function resetApp() {
  el.quizSection.classList.add('hidden');
  el.resultSection.classList.add('hidden');
}

el.soloModeBtn.addEventListener('click', () => setMode('solo'));
el.duelModeBtn.addEventListener('click', () => setMode('duel'));
el.mainCategorySelect.addEventListener('change', refreshSubCategories);
el.startQuizBtn.addEventListener('click', () => startSolo().catch((e) => alert(e.message)));
el.nextQuestionBtn.addEventListener('click', nextSoloQuestion);
el.restartBtn.addEventListener('click', resetApp);
el.createInviteBtn.addEventListener('click', () => createInvite().catch((e) => alert(e.message)));
el.copyInviteBtn.addEventListener('click', () => copyInviteCode().catch((e) => alert(e.message)));
el.joinInviteBtn.addEventListener('click', () => joinInvite().catch((e) => alert(e.message)));
el.startDuelQuizBtn.addEventListener('click', () => openDuelWindow().catch((e) => alert(e.message)));

loadCategories().catch((e) => alert(`API hatası: ${e.message}`));
setMode('solo');
