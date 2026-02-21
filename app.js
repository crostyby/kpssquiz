const state = {
  mode: 'solo',
  activeView: 'home',
  categories: [],
  questions: [],
  answers: [],
  currentIndex: 0,
  score: 0,
  duelCode: null,
  duelPlayerName: '',
  duelPollTimer: null,
  duelLastQuestionIndex: null,
  duelAnsweredForCurrent: false,
  duelSelectedIndex: null,
  selectedAvatar: 'avatar-orbit',
  selectedMainCategories: ['Genel Kültür', 'Genel Yetenek', 'Eğitim Bilimleri'],
};

const el = {
  homeView: document.getElementById('homeView'),
  leaderboardView: document.getElementById('leaderboardView'),
  profileView: document.getElementById('profileView'),
  navItems: [...document.querySelectorAll('.nav-item[data-view]')],

  soloModeBtn: document.getElementById('soloModeBtn'),
  duelModeBtn: document.getElementById('duelModeBtn'),
  categorySection: document.getElementById('categorySection'),
  duelSection: document.getElementById('duelSection'),

  categoryCards: [...document.querySelectorAll('#categoryCards .category-card')],
  categoryHint: document.getElementById('categoryHint'),
  difficultySelect: document.getElementById('difficultySelect'),
  startQuizBtn: document.getElementById('startQuizBtn'),

  createInviteBtn: document.getElementById('createInviteBtn'),
  copyInviteBtn: document.getElementById('copyInviteBtn'),
  inviteCodeDisplay: document.getElementById('inviteCodeDisplay'),
  joinCodeInput: document.getElementById('joinCodeInput'),
  joinStatus: document.getElementById('joinStatus'),
  joinInviteBtn: document.getElementById('joinInviteBtn'),
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

  duelArenaSection: document.getElementById('duelArenaSection'),
  roomTitle: document.getElementById('roomTitle'),
  duelProgress: document.getElementById('duelProgress'),
  duelProgressFill: document.getElementById('duelProgressFill'),
  roomMeta: document.getElementById('roomMeta'),
  leftPlayer: document.getElementById('leftPlayer'),
  rightPlayer: document.getElementById('rightPlayer'),
  phaseText: document.getElementById('phaseText'),
  countdownText: document.getElementById('countdownText'),
  duelLiveScore: document.getElementById('duelLiveScore'),
  answeredEarlyText: document.getElementById('answeredEarlyText'),
  duelQuestionMeta: document.getElementById('duelQuestionMeta'),
  duelQuestionText: document.getElementById('duelQuestionText'),
  duelChoices: document.getElementById('duelChoices'),
  duelResultSection: document.getElementById('duelResultSection'),
  duelWinner: document.getElementById('duelWinner'),
  duelScoreBoard: document.getElementById('duelScoreBoard'),
  closeDuelBtn: document.getElementById('closeDuelBtn'),

  lbTabs: [...document.querySelectorAll('.lb-tab')],
  lbSpeed: document.getElementById('lbSpeed'),
  lbAccuracy: document.getElementById('lbAccuracy'),

  profileAvatarPreview: document.getElementById('profileAvatarPreview'),
  profileNameText: document.getElementById('profileNameText'),
  profileNameInput: document.getElementById('profileNameInput'),
  avatarGrid: document.getElementById('avatarGrid'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  profileSaveHint: document.getElementById('profileSaveHint'),
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

function getPlayerName() {
  const input = (el.playerNameInput.value || '').trim().slice(0, 30);
  if (!input) {
    alert('Lütfen önce oyuncu adını yaz.');
    return null;
  }
  return input;
}

function switchView(view) {
  state.activeView = view;
  el.homeView.classList.toggle('hidden', view !== 'home');
  el.leaderboardView.classList.toggle('hidden', view !== 'leaderboard');
  el.profileView.classList.toggle('hidden', view !== 'profile');
  el.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
}

function getSelectedCategories() {
  return el.categoryCards
    .filter((card) => card.classList.contains('selected'))
    .map((card) => card.dataset.main)
    .filter(Boolean);
}

function setupCategoryCards() {
  el.categoryCards.forEach((card) => {
    card.addEventListener('click', () => {
      const active = card.classList.contains('selected');
      const selected = getSelectedCategories();
      if (active && selected.length === 1) {
        el.categoryHint.textContent = 'En az 1 kategori seçmelisin.';
        return;
      }
      card.classList.toggle('selected', !active);
      const updated = getSelectedCategories();
      state.selectedMainCategories = updated;
      el.categoryHint.textContent = `Seçili kategori sayısı: ${updated.length}`;
    });
  });
}

function updateSoloProgressVisual() {
  const fill = document.getElementById('quizProgressFill');
  if (!fill || !state.questions.length) return;
  const pct = ((state.currentIndex + 1) / state.questions.length) * 100;
  fill.style.width = `${pct}%`;
}

function setMode(mode) {
  state.mode = mode;
  el.soloModeBtn.classList.toggle('active', mode === 'solo');
  el.duelModeBtn.classList.toggle('active', mode === 'duel');
  el.soloModeBtn.classList.toggle('primary', mode === 'solo');
  el.duelModeBtn.classList.toggle('primary', mode === 'duel');
  el.categorySection.classList.toggle('hidden', mode !== 'solo');
  el.duelSection.classList.toggle('hidden', mode !== 'duel');

  if (mode === 'solo') {
    el.duelArenaSection.classList.add('hidden');
    stopDuelPolling();
  }
}

async function startSolo() {
  const selectedMains = getSelectedCategories();
  if (!selectedMains.length) {
    alert('En az 1 kategori seçmelisin.');
    return;
  }

  const difficulty = el.difficultySelect.value;
  const questionGroups = await Promise.all(
    selectedMains.map((main) => {
      const query = new URLSearchParams({
        main,
        sub: 'all',
        difficulty,
      }).toString();
      return api(`/api/questions?${query}`).then((data) => data.questions || []);
    }),
  );

  const merged = questionGroups.flat();
  const unique = [];
  const seen = new Set();
  merged.forEach((q) => {
    if (!seen.has(q.id)) {
      seen.add(q.id);
      unique.push(q);
    }
  });

  const shuffled = unique.sort(() => Math.random() - 0.5).slice(0, 5);

  if (!shuffled.length) {
    alert('Seçtiğin kategorilerde soru bulunamadı.');
    return;
  }

  state.questions = shuffled;
  state.answers = new Array(shuffled.length).fill(null);
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
  updateSoloProgressVisual();
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
      el.feedbackText.textContent = idx === q.correctIndex ? 'Doğru cevap' : 'Yanlış cevap';
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

async function copyInviteCode() {
  if (!state.duelCode) {
    alert('Önce oda oluşturmalısın.');
    return;
  }
  await navigator.clipboard.writeText(state.duelCode);
  el.joinStatus.textContent = 'Kod panoya kopyalandı';
}

function stopDuelPolling() {
  if (state.duelPollTimer) {
    clearInterval(state.duelPollTimer);
    state.duelPollTimer = null;
  }
}

function resetDuelUi() {
  state.duelLastQuestionIndex = null;
  state.duelAnsweredForCurrent = false;
  state.duelSelectedIndex = null;
  el.duelChoices.innerHTML = '';
  el.duelChoices.dataset.qidx = '';
  el.duelResultSection.classList.add('hidden');
}

function formatSec(ms) {
  return `${(ms / 1000).toFixed(2)} sn`;
}

function renderDuelPlayers(participants) {
  el.leftPlayer.textContent = `Oyuncu 1: ${participants[0] || '-'}`;
  el.rightPlayer.textContent = `Oyuncu 2: ${participants[1] || '-'}`;
}

function renderDuelLiveScore(room) {
  const rows = (room.participants || []).map((p) => {
    const score = room.scores?.[p] || 0;
    const t = room.totalTimesMs?.[p] ?? 0;
    return `${p}: ${score} puan (${formatSec(t)})`;
  });
  el.duelLiveScore.textContent = rows.join(' | ');
}

function renderDuelQuestion(room) {
  const q = room.question;
  if (!q) return;

  if (state.duelLastQuestionIndex !== q.index) {
    state.duelLastQuestionIndex = q.index;
    state.duelAnsweredForCurrent = false;
    state.duelSelectedIndex = null;
  }

  el.duelProgress.textContent = `${q.index}/${q.total}`;
  el.duelProgressFill.style.width = `${(q.index / q.total) * 100}%`;
  el.duelQuestionMeta.textContent = `${q.mainCategory} • ${q.subCategory} • Zorluk ${q.difficulty}`;
  el.duelQuestionText.textContent = q.stem;
  renderDuelLiveScore(room);

  if (el.duelChoices.dataset.qidx !== String(q.index)) {
    el.duelChoices.dataset.qidx = String(q.index);
    el.duelChoices.innerHTML = '';
    q.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn choice-btn';
      btn.textContent = choice;
      btn.addEventListener('click', async () => {
        if (state.duelAnsweredForCurrent || room.subPhase !== 'answer') return;
        state.duelAnsweredForCurrent = true;
        state.duelSelectedIndex = idx;
        [...el.duelChoices.querySelectorAll('button')].forEach((item) => {
          item.disabled = true;
        });
        await api(`/api/duels/${encodeURIComponent(state.duelCode)}/answer`, {
          method: 'POST',
          body: JSON.stringify({ name: state.duelPlayerName, choiceIndex: idx }),
        });
      });
      el.duelChoices.appendChild(btn);
    });
  }

  if (room.myAnswer && Number.isInteger(room.myAnswer.choiceIndex)) {
    state.duelAnsweredForCurrent = true;
    state.duelSelectedIndex = room.myAnswer.choiceIndex;
  }

  const allButtons = [...el.duelChoices.querySelectorAll('button')];
  allButtons.forEach((b) => b.classList.remove('correct', 'wrong', 'choice-selected'));

  if (room.subPhase === 'answer') {
    allButtons.forEach((b) => {
      b.disabled = state.duelAnsweredForCurrent;
    });
    if (Number.isInteger(state.duelSelectedIndex)) {
      allButtons[state.duelSelectedIndex]?.classList.add('choice-selected');
    }
    el.answeredEarlyText.textContent = room.firstResponder ? `İlk cevaplayan: ${room.firstResponder}` : '';
  } else {
    allButtons.forEach((b, idx) => {
      b.disabled = true;
      if (idx === q.correctIndex) b.classList.add('correct');
      if (Number.isInteger(state.duelSelectedIndex) && idx === state.duelSelectedIndex && idx !== q.correctIndex) {
        b.classList.add('wrong');
      }
    });

    if (Number.isInteger(state.duelSelectedIndex) && state.duelSelectedIndex === q.correctIndex) {
      el.answeredEarlyText.textContent = 'Doğru cevap';
    } else if (Number.isInteger(state.duelSelectedIndex)) {
      el.answeredEarlyText.textContent = 'Yanlış cevap';
    } else {
      el.answeredEarlyText.textContent = room.firstResponder ? `İlk cevaplayan: ${room.firstResponder}` : 'Cevap verilmedi';
    }
  }
}

function renderDuelFinished(room) {
  el.duelResultSection.classList.remove('hidden');
  const scores = room.finalScores || {};
  const times = room.finalTimesMs || {};
  const rows = Object.keys(scores)
    .map((n) => ({ name: n, score: scores[n], time: times[n] ?? 0 }))
    .sort((a, b) => (b.score - a.score) || (a.time - b.time));

  el.duelWinner.textContent = `Kazanan: ${room.winner || 'Berabere'}`;
  el.duelScoreBoard.innerHTML = rows
    .map((r) => `<li>${r.name}: ${r.score} puan • ${formatSec(r.time)}</li>`)
    .join('');
}

function renderDuelRoom(room) {
  renderDuelPlayers(room.participants || []);
  el.roomTitle.textContent = `Düello Odası: ${room.code}`;
  el.roomMeta.textContent = `Sen: ${state.duelPlayerName}`;
  el.duelArenaSection.classList.remove('hidden');

  if (room.phase === 'waiting') {
    el.phaseText.textContent = 'Rakip bekleniyor...';
    el.countdownText.textContent = '-';
    el.duelResultSection.classList.add('hidden');
    return;
  }

  if (room.phase === 'countdown') {
    el.phaseText.textContent = 'Düello başlıyor';
    el.countdownText.textContent = `${room.countdown}`;
    el.duelResultSection.classList.add('hidden');
    return;
  }

  if (room.phase === 'question') {
    el.phaseText.textContent = room.subPhase === 'answer' ? 'Cevapla!' : 'Cevaplar gösteriliyor';
    el.countdownText.textContent = `${room.timerLeft}`;
    el.duelResultSection.classList.add('hidden');
    renderDuelQuestion(room);
    return;
  }

  if (room.phase === 'finished') {
    el.phaseText.textContent = 'Düello tamamlandı';
    el.countdownText.textContent = '0';
    renderDuelFinished(room);
  }
}

async function duelTick() {
  const room = await api(`/api/duels/${encodeURIComponent(state.duelCode)}?name=${encodeURIComponent(state.duelPlayerName)}`);
  renderDuelRoom(room);
}

async function startInlineDuel(code, playerName) {
  state.duelCode = code;
  state.duelPlayerName = playerName;
  el.joinCodeInput.value = code;
  resetDuelUi();
  switchView('home');
  setMode('duel');

  await api(`/api/duels/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ name: playerName }),
  });

  await duelTick();
  stopDuelPolling();
  state.duelPollTimer = setInterval(() => {
    duelTick().catch((e) => {
      el.phaseText.textContent = `Bağlantı hatası: ${e.message}`;
    });
  }, 400);
}

async function createInvite() {
  const hostName = getPlayerName();
  if (!hostName) return;
  const data = await api('/api/duels', {
    method: 'POST',
    body: JSON.stringify({ hostName }),
  });
  el.inviteCodeDisplay.textContent = `Davet kodu: ${data.code}`;
  el.joinStatus.textContent = 'Oda oluşturuldu. Oyun aşağıdaki kutuda açıldı.';
  await startInlineDuel(data.code, hostName);
}

async function joinInvite() {
  const code = (el.joinCodeInput.value || '').trim().toUpperCase();
  const name = getPlayerName();
  if (!code || !name) return;
  el.inviteCodeDisplay.textContent = `Aktif oda: ${code}`;
  el.joinStatus.textContent = 'Odaya katıldın. Oyun aşağıdaki kutuda açıldı.';
  await startInlineDuel(code, name);
}

function setupLeaderboardTabs() {
  el.lbTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const isSpeed = tab.dataset.lbTab === 'speed';
      el.lbTabs.forEach((item) => {
        item.classList.toggle('primary', item === tab);
        item.classList.toggle('active', item === tab);
      });
      el.lbSpeed.classList.toggle('hidden', !isSpeed);
      el.lbAccuracy.classList.toggle('hidden', isSpeed);
    });
  });
}

function setupProfile() {
  el.avatarGrid?.addEventListener('click', (event) => {
    const button = event.target.closest('.avatar-item');
    if (!button) return;
    const avatarName = button.dataset.avatar || 'avatar-orbit';
    const initials = button.dataset.initials || 'AO';
    state.selectedAvatar = avatarName;
    el.profileAvatarPreview.className = `profile-avatar ${avatarName}`;
    el.profileAvatarPreview.innerHTML = `<span>${initials}</span>`;
    [...el.avatarGrid.querySelectorAll('.avatar-item')].forEach((item) => {
      item.classList.toggle('active', item === button);
    });
  });

  el.saveProfileBtn?.addEventListener('click', () => {
    const name = (el.profileNameInput.value || '').trim();
    if (!name) {
      el.profileSaveHint.textContent = 'Lütfen kullanıcı adı gir.';
      return;
    }
    el.profileNameText.textContent = name;
    el.profileSaveHint.textContent = 'Profil kaydedildi';
  });
}

function resetApp() {
  el.quizSection.classList.add('hidden');
  el.resultSection.classList.add('hidden');
}

el.navItems.forEach((item) => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});
el.soloModeBtn.addEventListener('click', () => setMode('solo'));
el.duelModeBtn.addEventListener('click', () => setMode('duel'));
el.startQuizBtn.addEventListener('click', () => startSolo().catch((e) => alert(e.message)));
el.nextQuestionBtn.addEventListener('click', nextSoloQuestion);
el.restartBtn.addEventListener('click', resetApp);
el.createInviteBtn.addEventListener('click', () => createInvite().catch((e) => alert(e.message)));
el.copyInviteBtn.addEventListener('click', () => copyInviteCode().catch((e) => alert(e.message)));
el.joinInviteBtn.addEventListener('click', () => joinInvite().catch((e) => alert(e.message)));
el.closeDuelBtn?.addEventListener('click', () => {
  stopDuelPolling();
  el.duelArenaSection.classList.add('hidden');
  el.joinStatus.textContent = 'Lobiye döndün.';
});

setupLeaderboardTabs();
setupCategoryCards();
setupProfile();
switchView('home');
setMode('solo');
