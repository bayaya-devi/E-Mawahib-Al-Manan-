(() => {
  let activePuzzle = null;

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ensureModal() {
    let modal = document.getElementById('juz-puzzle-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'juz-puzzle-modal';
    modal.className = 'juz-puzzle-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="juz-puzzle-panel" dir="rtl"><div class="juz-puzzle-head"><h3 id="juz-puzzle-title" class="juz-puzzle-title"></h3><button type="button" class="juz-puzzle-close" aria-label="إغلاق">×</button></div><div id="juz-puzzle-body"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.juz-puzzle-close').addEventListener('click', closePuzzle);
    modal.addEventListener('click', event => { if (event.target === modal) closePuzzle(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activePuzzle) closePuzzle();
    });
    return modal;
  }

  function openPuzzle(juzNumber) {
    const juz = juzJourney.find(item => item.num === Number(juzNumber));
    if (!juz) return;
    closePuzzle();
    activePuzzle = { juz, phase: 'choose', selectedKey: null, pieces: [], original: [] };
    ensureModal().classList.add('open');
    document.getElementById('juz-puzzle-title').textContent = juz.name + ' · بزل الآيات';
    const surahs = window.getJuzSurahs(juz);
    const body = document.getElementById('juz-puzzle-body');
    body.innerHTML = '<p class="juz-puzzle-intro">اختر سورة من هذا الجزء. بعد العد ٣، ٢، ١ رتّب قطع البزل، وكل قطعة تحتوي على آية. لا يوجد توقيت.</p><div class="juz-puzzle-surahs"></div>';
    const list = body.querySelector('.juz-puzzle-surahs');
    surahs.forEach(surah => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'juz-puzzle-surah-choice';
      button.textContent = surah.nameAr;
      button.addEventListener('click', () => preparePuzzle(surah));
      list.appendChild(button);
    });
  }

  function closePuzzle() {
    if (activePuzzle?.countdownTimer) clearTimeout(activePuzzle.countdownTimer);
    document.getElementById('juz-puzzle-modal')?.classList.remove('open');
    activePuzzle = null;
  }

  async function preparePuzzle(surah) {
    if (!activePuzzle || !surah) return;
    activePuzzle.phase = 'loading';
    activePuzzle.surah = surah;
    document.getElementById('juz-puzzle-body').innerHTML = '<div class="juz-puzzle-loading">جاري تجهيز قطع البزل...</div>';
    const loaded = await window.loadSurahVerses(surah);
    if (!activePuzzle) return;
    if (!loaded.verses || loaded.verses.length < 2) {
      document.getElementById('juz-puzzle-body').innerHTML = '<div class="juz-puzzle-loading is-error">تعذر تحميل آيات هذه السورة الآن.</div>';
      return;
    }
    const pieceCount = Math.min(7, loaded.verses.length);
    const maxStart = Math.max(0, loaded.verses.length - pieceCount);
    const start = maxStart ? Math.floor(Math.random() * (maxStart + 1)) : 0;
    activePuzzle.original = loaded.verses.slice(start, start + pieceCount).sort((a, b) => a.num - b.num);
    activePuzzle.pieces = window.shuffleItems(activePuzzle.original);
    if (isSolved()) activePuzzle.pieces.reverse();
    activePuzzle.phase = 'countdown';
    let count = 3;
    const showCount = () => {
      if (!activePuzzle || activePuzzle.phase !== 'countdown') return;
      document.getElementById('juz-puzzle-body').innerHTML = '<div class="juz-puzzle-countdown">' + (count > 0 ? count : 'هيا!') + '</div>';
      if (count < 0) return renderPuzzle();
      count--;
      activePuzzle.countdownTimer = setTimeout(showCount, count < 0 ? 500 : 720);
    };
    showCount();
  }

  function isSolved() {
    return Boolean(activePuzzle && activePuzzle.pieces.every((piece, index) => piece.key === activePuzzle.original[index]?.key));
  }

  function renderPuzzle(message, type) {
    if (!activePuzzle) return;
    activePuzzle.phase = 'playing';
    activePuzzle.selectedKey = null;
    const body = document.getElementById('juz-puzzle-body');
    body.innerHTML =
      '<p class="juz-puzzle-intro"><strong>' + escapeText(activePuzzle.surah.nameAr) + '</strong> · اضغط على قطعتين لتبديلهما، أو اسحب كل قطعة إلى مكانها الصحيح.</p>' +
      '<div class="juz-puzzle-board"></div>' +
      '<div class="juz-puzzle-actions"><button type="button" class="juz-puzzle-action juz-puzzle-check">تحقّق من البزل</button><button type="button" class="juz-puzzle-action juz-puzzle-reset">خلط القطع</button></div>' +
      (message ? '<div class="juz-puzzle-feedback ' + type + '" role="status">' + escapeText(message) + '</div>' : '');
    const board = body.querySelector('.juz-puzzle-board');
    activePuzzle.pieces.forEach(piece => {
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.className = 'juz-puzzle-piece';
      button.dataset.pieceKey = piece.key;
      button.textContent = piece.text;
      button.addEventListener('click', () => selectPiece(piece.key));
      button.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', piece.key);
        event.dataTransfer.effectAllowed = 'move';
        button.classList.add('is-dragging');
      });
      button.addEventListener('dragend', () => button.classList.remove('is-dragging'));
      button.addEventListener('dragover', event => event.preventDefault());
      button.addEventListener('drop', event => {
        event.preventDefault();
        swapPieces(event.dataTransfer.getData('text/plain'), piece.key);
      });
      board.appendChild(button);
    });
    body.querySelector('.juz-puzzle-check').addEventListener('click', checkPuzzle);
    body.querySelector('.juz-puzzle-reset').addEventListener('click', reshufflePuzzle);
  }

  function selectPiece(key) {
    if (!activePuzzle || activePuzzle.phase !== 'playing') return;
    if (!activePuzzle.selectedKey) {
      activePuzzle.selectedKey = key;
      const target = [...document.querySelectorAll('.juz-puzzle-piece')].find(piece => piece.dataset.pieceKey === key);
      target?.classList.add('is-selected');
      return;
    }
    const first = activePuzzle.selectedKey;
    activePuzzle.selectedKey = null;
    if (first === key) return renderPuzzle();
    swapPieces(first, key);
  }

  function swapPieces(firstKey, secondKey) {
    if (!activePuzzle || !firstKey || !secondKey || firstKey === secondKey) return;
    const firstIndex = activePuzzle.pieces.findIndex(piece => piece.key === firstKey);
    const secondIndex = activePuzzle.pieces.findIndex(piece => piece.key === secondKey);
    if (firstIndex < 0 || secondIndex < 0) return;
    [activePuzzle.pieces[firstIndex], activePuzzle.pieces[secondIndex]] = [activePuzzle.pieces[secondIndex], activePuzzle.pieces[firstIndex]];
    renderPuzzle();
  }

  function reshufflePuzzle() {
    if (!activePuzzle) return;
    activePuzzle.pieces = window.shuffleItems(activePuzzle.pieces);
    if (isSolved()) activePuzzle.pieces.reverse();
    renderPuzzle();
  }

  function checkPuzzle() {
    if (!activePuzzle) return;
    if (!isSolved()) return renderPuzzle('بعض القطع ليست في مكانها. جرّب تبديل قطعتين.', 'error');
    activePuzzle.phase = 'finished';
    window.dispatchEvent(new CustomEvent('mawahib:activity-recorded', {
      detail: { surahId: activePuzzle.surah.id, activityKey: 'juz-verse-puzzle', score: 100 }
    }));
    const body = document.getElementById('juz-puzzle-body');
    body.innerHTML = '<div class="juz-puzzle-finished"><div class="juz-puzzle-finished-icon">🧩</div><h4>بزل مكتمل!</h4><p>رتّبت آيات ' + escapeText(activePuzzle.surah.nameAr) + ' بالترتيب الصحيح، دون توقيت.</p><button type="button" class="juz-puzzle-play-again">لعب بزل آخر</button></div>';
    body.querySelector('.juz-puzzle-play-again').addEventListener('click', () => openPuzzle(activePuzzle.juz.num));
  }

  window.openJuzPuzzle = openPuzzle;
  window.closeJuzPuzzle = closePuzzle;
})();
