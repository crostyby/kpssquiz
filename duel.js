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
  duelLiveScore: document.getElementById('duelLiveScore'),
};

const state = {
  lastQuestionIndex: null,
  answeredForCurrent: false,
  selectedIndex: null,
  participants: [],
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

function formatSec(ms) {
  return `${(ms / 1000).toFixed(2)} sn`;
}

function renderPlayers(participants) {
  el.leftPlayer.textContent = `Oyuncu 1: ${participants[0] || '-'}`;
  el.rightPlayer.textContent = `Oyuncu 2: ${participants[1] || '-'}`;
}

function renderLiveScore(room) {
  const rows = (room.participants || []).map((p) => {
    const score = room.scores?.[p] || 0;
    const t = room.totalTimesMs?.[p] ?? 0;
    return `${p}: ${score} puan (${formatSec(t)})`;
  });
  el.duelLiveScore.textContent = rows.join(' | ');
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
    state.selectedIndex = null;
  }

  el.duelQuizSection.classList.remove('hidden');
  el.duelProgress.textContent = `${q.index}/${q.total}`;
  el.duelQuestionMeta.textContent = `${q.mainCategory} • ${q.subCategory} • Zorluk ${q.difficulty}`;
  el.duelQuestionText.textContent = q.stem;
  renderLiveScore(room);

  el.answeredEarlyText.textContent = room.firstResponder ? `İlk cevaplayan: ${room.firstResponder}` : '';

  if (el.duelChoices.dataset.qidx !== String(q.index)) {
    el.duelChoices.dataset.qidx = String(q.index);
    el.duelChoices.innerHTML = '';
    q.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn choice-btn';
      btn.textContent = choice;
      btn.addEventListener('click', async () => {
        if (state.answeredForCurrent || room.subPhase !== 'answer') return;
        state.answeredForCurrent = true;
        state.selectedIndex = idx;
        [...el.duelChoices.querySelectorAll('button')].forEach((b) => { b.disabled = true; });
        await api(`/api/duels/${encodeURIComponent(code)}/answer`, {
          method: 'POST',
          body: JSON.stringify({ name, choiceIndex: idx }),
        });
      });
      el.duelChoices.appendChild(btn);
    });
  }

  if (room.myAnswer && Number.isInteger(room.myAnswer.choiceIndex)) {
    state.answeredForCurrent = true;
    state.selectedIndex = room.myAnswer.choiceIndex;
  }

  const allBtns = [...el.duelChoices.querySelectorAll('button')];
  if (room.subPhase === 'answer') {
    allBtns.forEach((b) => {
      b.disabled = state.answeredForCurrent;
      b.classList.remove('correct', 'wrong', 'pulse-ok');
    });
    if (state.answeredForCurrent && Number.isInteger(state.selectedIndex)) {
      allBtns[state.selectedIndex]?.classList.add('choice-selected');
    }
  } else {
    allBtns.forEach((b, idx) => {
      b.disabled = true;
      b.classList.remove('correct', 'wrong', 'pulse-ok');
      if (idx === q.correctIndex) b.classList.add('correct');
      if (Number.isInteger(state.selectedIndex) && idx === state.selectedIndex && idx !== q.correctIndex) {
        b.classList.add('wrong');
      }
    });

    if (Number.isInteger(state.selectedIndex) && state.selectedIndex === q.correctIndex) {
      el.answeredEarlyText.textContent = '✓ Doğru cevap';
      allBtns[state.selectedIndex]?.classList.add('pulse-ok');
    } else if (Number.isInteger(state.selectedIndex)) {
      el.answeredEarlyText.textContent = 'Yanlış cevap';
    } else {
      el.answeredEarlyText.textContent = room.firstResponder ? `İlk cevaplayan: ${room.firstResponder}` : 'Cevap verilmedi';
    }
  }
}

function renderFinished(room) {
  el.duelQuizSection.classList.add('hidden');
  el.duelResultSection.classList.remove('hidden');

  const scores = room.finalScores || {};
  const times = room.finalTimesMs || {};
  const rows = Object.keys(scores)
    .map((n) => ({ n, s: scores[n], t: times[n] ?? 0 }))
    .sort((a, b) => (b.s - a.s) || (a.t - b.t));

  el.duelWinner.textContent = `🏆 Kazanan: ${room.winner}`;
  el.duelScoreBoard.innerHTML = rows
    .map((r) => `<li>${r.n}: ${r.s} puan • ${formatSec(r.t)}</li>`)
    .join('');
}

function renderRoom(room) {
  renderPlayers(room.participants || []);
  el.roomTitle.textContent = `Düello Odası: ${room.code}`;
  el.roomMeta.textContent = `Sen: ${name}`;

  if (room.joinNotice && room.participants.length === 2) {
    el.phaseText.textContent = room.joinNotice;
  }

  if (room.phase === 'waiting') {
    el.phaseText.textContent = 'Rakip bekleniyor...';
    el.countdownText.textContent = '-';
    el.duelQuizSection.classList.add('hidden');
    el.duelResultSection.classList.add('hidden');
    return;
  }

  if (room.phase === 'countdown') {
    el.phaseText.textContent = 'Düello başlıyor';
    el.countdownText.textContent = `${room.countdown}`;
    el.duelQuizSection.classList.add('hidden');
    el.duelResultSection.classList.add('hidden');
    return;
  }

  if (room.phase === 'question') {
    el.phaseText.textContent = room.subPhase === 'answer' ? 'Cevapla!' : 'Sonuç gösteriliyor';
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
  const room = await api(`/api/duels/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`);
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
  }, 400);
}

init().catch((e) => alert(e.message));
