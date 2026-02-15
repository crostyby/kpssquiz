const params = new URLSearchParams(window.location.search);
const code = (params.get('code') || '').toUpperCase();
const name = params.get('name') || 'Oyuncu';

const el = {
  roomTitle: document.getElementById('roomTitle'),
  roomMeta: document.getElementById('roomMeta'),
  participantsList: document.getElementById('participantsList'),
  countdownText: document.getElementById('countdownText'),
  duelQuizSection: document.getElementById('duelQuizSection'),
  duelProgress: document.getElementById('duelProgress'),
  duelQuestionMeta: document.getElementById('duelQuestionMeta'),
  duelQuestionText: document.getElementById('duelQuestionText'),
  duelChoices: document.getElementById('duelChoices'),
  duelFeedback: document.getElementById('duelFeedback'),
  duelResultSection: document.getElementById('duelResultSection'),
  duelScore: document.getElementById('duelScore'),
  duelLeaderboard: document.getElementById('duelLeaderboard'),
};

const state = {
  questions: [],
  answers: [],
  idx: 0,
  selected: null,
  timer: 10,
  tickHandle: null,
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

function renderParticipants(list) {
  el.participantsList.innerHTML = list.map((p) => `<li>${p}</li>`).join('');
}

function renderQuestion() {
  const q = state.questions[state.idx];
  if (!q) return;
  state.selected = null;
  state.timer = 10;
  el.duelQuizSection.classList.remove('hidden');
  el.duelProgress.textContent = `${state.idx + 1}/${state.questions.length}`;
  el.duelQuestionMeta.textContent = `${q.mainCategory} • ${q.subCategory} • Zorluk ${q.difficulty}`;
  el.duelQuestionText.textContent = q.stem;
  el.duelFeedback.textContent = '';
  el.countdownText.textContent = '10';

  el.duelChoices.innerHTML = '';
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => {
      if (state.selected !== null) return;
      state.selected = i;
      state.answers[state.idx] = i;
      [...el.duelChoices.querySelectorAll('button')].forEach((b, idx) => {
        b.disabled = true;
        if (idx === q.correctIndex) b.classList.add('correct');
        if (idx === i && i !== q.correctIndex) b.classList.add('wrong');
      });
      el.duelFeedback.textContent = i === q.correctIndex ? '✅ Doğru' : '❌ Yanlış';
    });
    el.duelChoices.appendChild(btn);
  });

  startCountdown();
}

function startCountdown() {
  clearInterval(state.tickHandle);
  state.tickHandle = setInterval(async () => {
    state.timer -= 1;
    el.countdownText.textContent = `${state.timer}`;
    if (state.timer <= 0) {
      clearInterval(state.tickHandle);
      state.idx += 1;
      if (state.idx >= state.questions.length) {
        await finishDuel();
      } else {
        renderQuestion();
      }
    }
  }, 1000);
}

async function finishDuel() {
  el.duelQuizSection.classList.add('hidden');
  el.duelResultSection.classList.remove('hidden');
  const result = await api(`/api/duels/${encodeURIComponent(code)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ name, answers: state.answers }),
  });
  el.duelScore.textContent = `Skorun: ${result.score}`;
  el.duelLeaderboard.innerHTML = result.leaderboard
    .map((s, i) => `<li>${i + 1}. ${s.name} - ${s.score}</li>`)
    .join('');
}

async function init() {
  if (!code) {
    alert('Düello kodu yok.');
    return;
  }

  await api(`/api/duels/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  const data = await api(`/api/duels/${encodeURIComponent(code)}`);
  el.roomTitle.textContent = `Düello Odası: ${code}`;
  el.roomMeta.textContent = `Oyuncu: ${name}`;
  renderParticipants(data.participants || []);
  state.questions = data.questions;
  state.answers = new Array(data.questions.length).fill(null);

  setInterval(async () => {
    const room = await api(`/api/duels/${encodeURIComponent(code)}`);
    renderParticipants(room.participants || []);
  }, 1500);

  renderQuestion();
}

init().catch((e) => alert(e.message));
