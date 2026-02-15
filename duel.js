const params = new URLSearchParams(window.location.search);
const code = (params.get('code') || '').toUpperCase();
const name = params.get('name') || 'Oyuncu';

const el = {
  roomTitle: document.getElementById('roomTitle'),
  roomMeta: document.getElementById('roomMeta'),
  leftPlayer: document.getElementById('leftPlayer'),
  rightPlayer: document.getElementById('rightPlayer'),
  phaseText: document.getElementById('phaseText'),
  countdownText: document.getElementById('countdownText'),
  answeredEarlyText: document.getElementById('answeredEarlyText'),
  duelQuizSection: document.getElementById('duelQuizSection'),
  duelProgress: document.getElementById('duelProgress'),
  duelQuestionMeta: document.getElementById('duelQuestionMeta'),
  duelQuestionText: document.getElementById('duelQuestionText'),
  duelChoices: document.getElementById('duelChoices'),
  duelResultSection: document.getElementById('duelResultSection'),
  duelWinner: document.getElementById('duelWinner'),
  duelScoreBoard: document.getElementById('duelScoreBoard'),
};

const state = {
  lastQuestionIndex: null,
  answeredForCurrent: false,
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

function renderPlayers(participants) {
  el.leftPlayer.textContent = `Oyuncu 1: ${participants[0] || '-'}`;
  el.rightPlayer.textContent = `Oyuncu 2: ${participants[1] || '-'}`;
}

function renderQuestion(room) {
  const q = room.question;
  if (!q) {
    el.duelQuizSection.classList.add('hidden');
    return;
  }

  if (state.lastQuestionIndex !== q.index) {
    state.lastQuestionIndex = q.index;
    state.answeredForCurrent = false;
  }

  el.duelQuizSection.classList.remove('hidden');
  el.duelProgress.textContent = `${Math.min(q.index, room.totalQuestions)}/${room.totalQuestions}`;
  el.duelQuestionMeta.textContent = `${q.mainCategory} • ${q.subCategory} • Zorluk ${q.difficulty}`;
  el.duelQuestionText.textContent = q.stem;

  const answeredNames = (room.answerStatus || []).filter((x) => x.answered).map((x) => x.name);
  el.answeredEarlyText.textContent = answeredNames.length ? `Erken cevaplayan: ${answeredNames.join(', ')}` : '';

  if (el.duelChoices.dataset.qidx !== String(q.index)) {
    el.duelChoices.dataset.qidx = String(q.index);
    el.duelChoices.innerHTML = '';
    q.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn choice-btn';
      btn.textContent = choice;
      btn.addEventListener('click', async () => {
        if (state.answeredForCurrent) return;
        state.answeredForCurrent = true;
        [...el.duelChoices.querySelectorAll('button')].forEach((b) => { b.disabled = true; });
        await api(`/api/duels/${encodeURIComponent(code)}/answer`, {
          method: 'POST',
          body: JSON.stringify({ name, choiceIndex: idx }),
        });
      });
      el.duelChoices.appendChild(btn);
    });
  }

  if (state.answeredForCurrent) {
    [...el.duelChoices.querySelectorAll('button')].forEach((b) => { b.disabled = true; });
  }
}

function renderFinished(room) {
  el.duelQuizSection.classList.add('hidden');
  el.duelResultSection.classList.remove('hidden');

  const scores = room.finalScores || room.scores || {};
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  el.duelWinner.textContent = room.winner ? `🏆 Kazanan: ${room.winner}` : 'Sonuç bekleniyor';
  el.duelScoreBoard.innerHTML = rows.map(([n, s]) => `<li>${n}: ${s} puan</li>`).join('');
}

function renderRoom(room) {
  renderPlayers(room.participants || []);
  el.roomTitle.textContent = `Düello Odası: ${room.code}`;
  el.roomMeta.textContent = `Sen: ${name}`;

  if (room.phase === 'waiting') {
    el.phaseText.textContent = 'Rakip bekleniyor...';
    el.countdownText.textContent = '-';
    el.duelQuizSection.classList.add('hidden');
    el.duelResultSection.classList.add('hidden');
    return;
  }

  if (room.phase === 'countdown') {
    el.phaseText.textContent = 'Düello başlıyor!';
    el.countdownText.textContent = `${room.countdown}`;
    el.duelQuizSection.classList.add('hidden');
    el.duelResultSection.classList.add('hidden');
    return;
  }

  if (room.phase === 'question' || room.phase === 'sudden_death') {
    el.phaseText.textContent = room.phase === 'sudden_death' ? 'Uzatma (ani ölüm)' : 'Düello devam ediyor';
    el.countdownText.textContent = `${room.timerLeft}`;
    el.duelResultSection.classList.add('hidden');
    renderQuestion(room);
    return;
  }

  if (room.phase === 'finished') {
    el.phaseText.textContent = 'Düello tamamlandı';
    el.countdownText.textContent = '0';
    renderFinished(room);
  }
}

async function tick() {
  const room = await api(`/api/duels/${encodeURIComponent(code)}`);
  renderRoom(room);
}

async function init() {
  if (!code) {
    alert('Kod yok');
    return;
  }

  await api(`/api/duels/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  await tick();
  setInterval(() => {
    tick().catch((e) => {
      el.phaseText.textContent = `Bağlantı hatası: ${e.message}`;
    });
  }, 500);
}

init().catch((e) => alert(e.message));
