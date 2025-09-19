/* ============================================================
   Shell Game — 완전한 구현 버전 (모든 문제점 보완)
   - 완전한 탭/모달 시스템
   - 에러 핸들링 및 접근성
   - 리더보드 및 사용자 경험 개선
   - 게임 목적에 맞는 완전한 기능
   ============================================================ */

/* ----- DOM util ----- */
const $ = (s, r=document) => {
  const el = r.querySelector(s);
  if (!el) console.warn(`Element not found: ${s}`);
  return el;
};

const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/* ----- 난이도 설정 ----- */
const STAGES = {
  1: { cups: 3, swaps: 8,  speed: 420, showBallAtStart: true,  name: "느리고 3개", points: 10 },
  2: { cups: 5, swaps: 12, speed: 300, showBallAtStart: true,  name: "보통 5개", points: 20 },
  3: { cups: 5, swaps: 18, speed: 180, showBallAtStart: true,  name: "아주 빠르고 5개", points: 30 },
  4: { cups: 5, swaps: 32, speed: 60,  showBallAtStart: true,  name: "찍기(초고속·숨김 셔플)", points: 50 },
};

/* ----- 게임 상태 ----- */
const state = {
  level: 1,
  round: 0,
  score: 0,
  miss: 0,
  totalPoints: 0,
  cups: [],
  answerCupEl: null,
  isShuffling: false,
  allowPick: false,
  currentView: 'home',
  board: null,
  table: null,
  ballEl: null,
  gameStartTime: null,
  revealUsed: false,
};

/* ----- DOM 참조 (안전한 방식) ----- */
const elements = {
  // 탭 관련
  tabHome: () => $("#tab-home"),
  tabGame: () => $("#tab-game"), 
  tabResult: () => $("#tab-result"),
  
  // 홈 화면
  selLevel: () => $("#level"),
  btnSetup: () => $("#btn-setup"),
  btnRules: () => $("#btn-rules"),
  btnLeaderboard: () => $("#btn-leaderboard"),
  
  // 게임 화면
  hudState: () => $("#hud-state"),
  hudRound: () => $("#hud-round"),
  hudScore: () => $("#hud-score"),
  hudMiss: () => $("#hud-miss"),
  btnShuffle: () => $("#btn-shuffle"),
  btnReveal: () => $("#btn-reveal"),
  btnRestart: () => $("#btn-restart"),
  
  // 결과 화면
  resScore: () => $("#res-score"),
  resMiss: () => $("#res-miss"),
  inputName: () => $("#player-name"),
  btnSave: () => $("#btn-save"),
  btnToHome: () => $("#btn-to-home"),
  
  // 공통
  board: () => $("#board"),
  table: () => $("#table"),
  ball: () => $("#ball"),
  
  // 모달
  modalRules: () => $("#modal-rules"),
  modalLeader: () => $("#modal-leader"),
  tblLeader: () => $("#tbl-leader tbody"),
};

/* ----- 초기화 ----- */
document.addEventListener("DOMContentLoaded", () => {
  try {
    initializeGame();
    setupEventListeners();
    showView('home');
    updateAccessibility();
    loadLeaderboard();
  } catch (error) {
    console.error("게임 초기화 실패:", error);
    showError("게임을 시작할 수 없습니다. 페이지를 새로고침해주세요.");
  }
});

function initializeGame() {
  // DOM 요소 안전하게 초기화
  state.board = elements.board();
  state.table = elements.table();
  state.ballEl = elements.ball();
  
  if (!state.board || !state.table || !state.ballEl) {
    throw new Error("필수 DOM 요소를 찾을 수 없습니다.");
  }
  
  hideBallHard();
  updateHUD();
}

function setupEventListeners() {
  // 탭 이벤트
  const tabHome = elements.tabHome();
  const tabGame = elements.tabGame();
  const tabResult = elements.tabResult();
  
  tabHome?.addEventListener("click", () => showView('home'));
  tabGame?.addEventListener("click", () => showView('game'));
  tabResult?.addEventListener("click", () => showView('result'));
  
  // 홈 화면 이벤트
  const selLevel = elements.selLevel();
  const btnSetup = elements.btnSetup();
  const btnRules = elements.btnRules();
  const btnLeaderboard = elements.btnLeaderboard();
  
  selLevel?.addEventListener("change", () => {
    state.level = Number(selLevel.value) || 1;
    updateAccessibility();
  });
  
  btnSetup?.addEventListener("click", startGame);
  btnRules?.addEventListener("click", showRules);
  btnLeaderboard?.addEventListener("click", showLeaderboard);
  
  // 게임 화면 이벤트
  const btnShuffle = elements.btnShuffle();
  const btnReveal = elements.btnReveal();
  const btnRestart = elements.btnRestart();
  
  btnShuffle?.addEventListener("click", shuffle);
  btnReveal?.addEventListener("click", revealAnswer);
  btnRestart?.addEventListener("click", resetAll);
  
  // 결과 화면 이벤트
  const btnSave = elements.btnSave();
  const btnToHome = elements.btnToHome();
  
  btnSave?.addEventListener("click", saveScore);
  btnToHome?.addEventListener("click", () => showView('home'));
  
  // 모달 닫기 이벤트
  const modalRules = elements.modalRules();
  const modalLeader = elements.modalLeader();
  
  modalRules?.addEventListener("close", () => updateAccessibility());
  modalLeader?.addEventListener("close", () => updateAccessibility());
  
  // 키보드 접근성
  document.addEventListener("keydown", handleKeyboard);
  
  // 창 크기 변경 대응
  window.addEventListener("resize", handleResize);
}

/* ----- 화면 전환 시스템 ----- */
function showView(viewName) {
  try {
    // 모든 뷰 숨기기
    const views = $$('.view');
    views.forEach(view => view.classList.remove('active'));
    
    // 모든 탭 비활성화
    const tabs = $$('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // 선택된 뷰 활성화
    const targetView = $(`#view-${viewName}`);
    const targetTab = $(`#tab-${viewName}`);
    
    if (targetView) targetView.classList.add('active');
    if (targetTab) targetTab.classList.add('active');
    
    state.currentView = viewName;
    updateAccessibility();
    
    // 뷰별 특별 처리
    if (viewName === 'game' && state.cups.length === 0) {
      showError("먼저 홈 화면에서 게임을 시작해주세요.");
      showView('home');
    }
    
  } catch (error) {
    console.error("화면 전환 실패:", error);
    showError("화면을 전환할 수 없습니다.");
  }
}

/* ----- 게임 시작 ----- */
async function startGame() {
  try {
    const cfg = STAGES[state.level];
    if (!cfg) {
      throw new Error("잘못된 난이도입니다.");
    }
    
    showView('game');
    state.gameStartTime = Date.now();
    state.revealUsed = false;
    
    await setupBoard();
    
  } catch (error) {
    console.error("게임 시작 실패:", error);
    showError("게임을 시작할 수 없습니다.");
  }
}

/* ----- 보드 설정 ----- */
async function setupBoard() {
  const cfg = STAGES[state.level];
  
  try {
    // 보드 초기화
    if (state.board) state.board.innerHTML = "";
    state.cups = [];
    state.allowPick = false;
    state.answerCupEl = null;
    
    // 컵 생성
    for (let i = 0; i < cfg.cups; i++) {
      const cup = document.createElement("button");
      cup.className = "cup";
      cup.setAttribute('aria-label', `컵 ${i + 1}`);
      cup.setAttribute('tabindex', '0');
      cup.addEventListener("click", () => onPick(cup));
      cup.addEventListener("keydown", (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(cup);
        }
      });
      
      state.board.appendChild(cup);
      state.cups.push(cup);
    }
    
    layoutCups();
    
    // 정답 컵 선택
    const idx = Math.floor(Math.random() * state.cups.length);
    state.answerCupEl = state.cups[idx];
    
    // 시작 연출
    placeBallUnder(getAnswerIndex());
    if (cfg.showBallAtStart) {
      showBall();
      state.cups.forEach(c => c.classList.add("lift"));
      await delay(650);
      state.cups.forEach(c => c.classList.remove("lift"));
      await delay(180);
      hideBall();
    }
    
    state.round++;
    updateHUD();
    updateAccessibility();
    
    const btnShuffle = elements.btnShuffle();
    if (btnShuffle) btnShuffle.disabled = false;
    
  } catch (error) {
    console.error("보드 설정 실패:", error);
    showError("게임 보드를 설정할 수 없습니다.");
  }
}

/* ----- 컵 배치 ----- */
function layoutCups() {
  try {
    const W = state.table.clientWidth;
    const H = state.table.clientHeight;
    const total = state.cups.length;
    
    if (total === 0) return;
    
    const spacing = Math.min(160, Math.max(120, Math.floor(W / (total + 2))));
    const startX = (W / 2) - ((total - 1) * spacing) / 2;
    const y = H * 0.55;
    
    state.cups.forEach((cup, i) => {
      const x = startX + i * spacing;
      cup.style.setProperty("--x", `${x}px`);
      cup.style.setProperty("--y", `${y}px`);
      cup.style.transform = `translate(var(--x), var(--y))`;
    });
    
  } catch (error) {
    console.error("컵 배치 실패:", error);
  }
}

/* ----- 공 위치 ----- */
function placeBallUnder(index) {
  try {
    const cup = state.cups[index];
    if (!cup || !state.ballEl) return;
    
    const rect = cup.getBoundingClientRect();
    const parentRect = state.table.getBoundingClientRect();
    const cx = rect.left - parentRect.left + rect.width / 2;
    const by = rect.top - parentRect.top + rect.height * 0.8;
    
    state.ballEl.style.left = `${cx}px`;
    state.ballEl.style.top = `${by}px`;
    
  } catch (error) {
    console.error("공 위치 설정 실패:", error);
  }
}

/* ----- 셔플 ----- */
async function shuffle() {
  if (state.isShuffling || !state.cups.length) return;
  
  try {
    const cfg = STAGES[state.level];
    state.isShuffling = true;
    state.allowPick = false;
    state.revealUsed = false;
    
    updateHUD("섞는 중…");
    hideBall();
    
    const btnShuffle = elements.btnShuffle();
    const btnReveal = elements.btnReveal();
    
    if (btnShuffle) btnShuffle.disabled = true;
    if (btnReveal) btnReveal.disabled = false;
    
    state.cups.forEach(c => c.style.pointerEvents = "none");
    
    // 셔플 실행
    for (let t = 0; t < cfg.swaps; t++) {
      const [i, j] = pickTwoDistinct(state.cups.length);
      await swapCups(i, j, cfg.speed);
      await delay(cfg.speed / 5);
    }
    
    // 셔플 완료
    state.cups.forEach(c => c.style.pointerEvents = "");
    state.isShuffling = false;
    state.allowPick = true;
    
    if (btnShuffle) btnShuffle.disabled = false;
    
    hideBallHard();
    updateHUD("정답 컵을 선택하세요");
    updateAccessibility();
    
  } catch (error) {
    console.error("셔플 실패:", error);
    showError("셔플 중 오류가 발생했습니다.");
    state.isShuffling = false;
    state.allowPick = true;
  }
}

/* ----- 컵 교환 ----- */
async function swapCups(i, j, speed) {
  if (i === j) return;
  
  try {
    const cupA = state.cups[i];
    const cupB = state.cups[j];
    
    if (!cupA || !cupB) return;
    
    const A = getPos(cupA);
    const B = getPos(cupB);
    
    await Promise.all([
      moveCupTo(cupA, A, B, speed),
      moveCupTo(cupB, B, A, speed),
    ]);
    
    // 배열 실제 교환
    const tmp = state.cups[i];
    state.cups[i] = state.cups[j];
    state.cups[j] = tmp;
    
  } catch (error) {
    console.error("컵 교환 실패:", error);
  }
}

function getPos(el) {
  try {
    return {
      x: parseFloat(el.style.getPropertyValue("--x")) || 0,
      y: parseFloat(el.style.getPropertyValue("--y")) || 0
    };
  } catch (error) {
    return { x: 0, y: 0 };
  }
}

async function moveCupTo(cup, from, to, speed) {
  try {
    const steps = Math.max(6, Math.floor(speed / 20));
    
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const x = from.x + (to.x - from.x) * k;
      const y = from.y + (to.y - from.y) * k;
      
      cup.style.setProperty("--x", `${x}px`);
      cup.style.setProperty("--y", `${y}px`);
      cup.style.transform = `translate(var(--x), var(--y))`;
      
      await delay(speed / steps);
    }
    
  } catch (error) {
    console.error("컵 이동 실패:", error);
  }
}

/* ----- 선택 처리 ----- */
function onPick(cupEl) {
  if (!state.allowPick || state.isShuffling) return;
  
  try {
    const correct = (cupEl === state.answerCupEl);
    
    state.allowPick = false;
    state.cups.forEach(c => c.style.pointerEvents = "none");
    cupEl.classList.add("lift");
    
    // 선택 순간: 공 보이기
    placeBallUnder(getAnswerIndex());
    showBall();
    
    // 접근성 업데이트
    updateAccessibility(`선택된 컵: ${correct ? '정답' : '오답'}`);
    
    setTimeout(() => finishRound(correct, cupEl), 500);
    
  } catch (error) {
    console.error("선택 처리 실패:", error);
    showError("선택 처리 중 오류가 발생했습니다.");
  }
}

/* ----- 결과 처리 ----- */
function finishRound(correct, pickedEl) {
  try {
    const cfg = STAGES[state.level];
    const points = cfg ? cfg.points : 0;
    
    if (correct) {
      state.score++;
      state.totalPoints += points;
      updateHUD("정답! 🎉");
    } else {
      state.miss++;
      updateHUD("아쉽다! 다음에 다시!");
    }
    
    updateResultDisplay();
    
    // 결과 확인 시간
    setTimeout(() => {
      hideBallHard();
      
      const btnShuffle = elements.btnShuffle();
      if (btnShuffle) btnShuffle.disabled = false;
      
      state.cups.forEach(c => {
        c.style.pointerEvents = "";
        c.classList.remove("lift");
      });
      
      state.allowPick = false;
      updateAccessibility();
      
    }, 1500);
    
  } catch (error) {
    console.error("결과 처리 실패:", error);
    showError("결과 처리 중 오류가 발생했습니다.");
  }
}

/* ----- 정답 공개 ----- */
function revealAnswer() {
  try {
    if (state.revealUsed) {
      showError("정답 공개는 한 번만 사용할 수 있습니다.");
      return;
    }
    
    if (!state.cups.length || !state.answerCupEl) {
      showError("게임이 시작되지 않았습니다.");
      return;
    }
    
    placeBallUnder(getAnswerIndex());
    showBall();
    state.revealUsed = true;
    
    const btnReveal = elements.btnReveal();
    if (btnReveal) btnReveal.disabled = true;
    
    updateHUD("정답 공개!");
    updateAccessibility("정답이 공개되었습니다.");
    
    setTimeout(() => {
      hideBallHard();
      updateHUD("정답 컵을 선택하세요");
    }, 2000);
    
  } catch (error) {
    console.error("정답 공개 실패:", error);
    showError("정답을 공개할 수 없습니다.");
  }
}

/* ----- 전체 리셋 ----- */
function resetAll() {
  try {
    state.round = 0;
    state.score = 0;
    state.miss = 0;
    state.totalPoints = 0;
    state.revealUsed = false;
    
    if (state.board) state.board.innerHTML = "";
    hideBallHard();
    
    const btnShuffle = elements.btnShuffle();
    const btnReveal = elements.btnReveal();
    
    if (btnShuffle) btnShuffle.disabled = true;
    if (btnReveal) btnReveal.disabled = true;
    
    updateHUD("난이도를 고르고 게임 시작을 누르세요");
    updateResultDisplay();
    updateAccessibility();
    
    showView('home');
    
  } catch (error) {
    console.error("리셋 실패:", error);
    showError("게임을 리셋할 수 없습니다.");
  }
}

/* ----- 공 표시/숨김 ----- */
function showBall() {
  try {
    if (state.ballEl) {
      state.ballEl.style.opacity = "1";
      state.ballEl.setAttribute('aria-hidden', 'false');
    }
  } catch (error) {
    console.error("공 표시 실패:", error);
  }
}

function hideBall() {
  try {
    if (state.ballEl) {
      state.ballEl.style.opacity = "0";
      state.ballEl.setAttribute('aria-hidden', 'true');
    }
  } catch (error) {
    console.error("공 숨김 실패:", error);
  }
}

function hideBallHard() {
  try {
    if (!state.ballEl) return;
    state.ballEl.style.opacity = "0";
    state.ballEl.style.display = "block";
    state.ballEl.setAttribute('aria-hidden', 'true');
  } catch (error) {
    console.error("공 강제 숨김 실패:", error);
  }
}

/* ----- 정답 인덱스 ----- */
function getAnswerIndex() {
  try {
    return state.cups.indexOf(state.answerCupEl);
  } catch (error) {
    return -1;
  }
}

/* ----- HUD 업데이트 ----- */
function updateHUD(message = null) {
  try {
    const hudState = elements.hudState();
    const hudRound = elements.hudRound();
    const hudScore = elements.hudScore();
    const hudMiss = elements.hudMiss();
    
    if (message && hudState) {
      hudState.textContent = message;
    }
    
    if (hudRound) hudRound.textContent = String(state.round);
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudMiss) hudMiss.textContent = String(state.miss);
    
  } catch (error) {
    console.error("HUD 업데이트 실패:", error);
  }
}

function updateResultDisplay() {
  try {
    const resScore = elements.resScore();
    const resMiss = elements.resMiss();
    
    if (resScore) resScore.textContent = String(state.score);
    if (resMiss) resMiss.textContent = String(state.miss);
    
  } catch (error) {
    console.error("결과 표시 업데이트 실패:", error);
  }
}

/* ----- 리더보드 시스템 ----- */
function loadLeaderboard() {
  try {
    const data = localStorage.getItem("shell-game-leaderboard");
    const leaderboard = data ? JSON.parse(data) : [];
    
    const tbody = elements.tblLeader();
    if (!tbody) return;
    
    const sorted = leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      return (a.name || "").localeCompare(b.name || "");
    });
    
    tbody.innerHTML = sorted.slice(0, 10).map((entry, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(entry.name || "익명")}</td>
        <td>${entry.score}</td>
        <td>${entry.miss}</td>
        <td>${entry.totalPoints || 0}</td>
        <td>${formatDate(entry.timestamp)}</td>
      </tr>
    `).join("");
    
  } catch (error) {
    console.error("리더보드 로드 실패:", error);
  }
}

function saveScore() {
  try {
    const inputName = elements.inputName();
    const name = (inputName?.value || "").trim() || "익명";
    
    if (state.score === 0 && state.miss === 0) {
      showError("저장할 점수가 없습니다.");
      return;
    }
    
    const entry = {
      name: name,
      score: state.score,
      miss: state.miss,
      totalPoints: state.totalPoints,
      level: state.level,
      timestamp: Date.now(),
      playTime: state.gameStartTime ? Date.now() - state.gameStartTime : 0
    };
    
    const data = localStorage.getItem("shell-game-leaderboard");
    const leaderboard = data ? JSON.parse(data) : [];
    leaderboard.push(entry);
    
    localStorage.setItem("shell-game-leaderboard", JSON.stringify(leaderboard));
    
    loadLeaderboard();
    showError("점수가 저장되었습니다!", "success");
    
    if (inputName) inputName.value = "";
    
  } catch (error) {
    console.error("점수 저장 실패:", error);
    showError("점수를 저장할 수 없습니다.");
  }
}

/* ----- 모달 시스템 ----- */
function showRules() {
  try {
    const modal = elements.modalRules();
    if (modal) {
      modal.showModal();
      updateAccessibility();
    }
  } catch (error) {
    console.error("규칙 모달 표시 실패:", error);
  }
}

function showLeaderboard() {
  try {
    loadLeaderboard();
    const modal = elements.modalLeader();
    if (modal) {
      modal.showModal();
      updateAccessibility();
    }
  } catch (error) {
    console.error("리더보드 모달 표시 실패:", error);
  }
}

/* ----- 접근성 ----- */
function updateAccessibility(message = null) {
  try {
    const board = state.board;
    if (board && message) {
      board.setAttribute('aria-live', 'assertive');
      board.setAttribute('aria-label', message);
    }
    
    // 컵 접근성
    state.cups.forEach((cup, i) => {
      if (cup) {
        cup.setAttribute('aria-label', `컵 ${i + 1}`);
        cup.setAttribute('tabindex', state.allowPick ? '0' : '-1');
      }
    });
    
  } catch (error) {
    console.error("접근성 업데이트 실패:", error);
  }
}

/* ----- 키보드 이벤트 ----- */
function handleKeyboard(e) {
  try {
    if (e.key === 'Escape') {
      const modalRules = elements.modalRules();
      const modalLeader = elements.modalLeader();
      
      if (modalRules?.open) modalRules.close();
      if (modalLeader?.open) modalLeader.close();
    }
    
  } catch (error) {
    console.error("키보드 이벤트 처리 실패:", error);
  }
}

/* ----- 창 크기 변경 ----- */
function handleResize() {
  try {
    if (state.cups.length > 0) {
      layoutCups();
      if (STAGES[state.level]?.showBallAlways) {
        placeBallUnder(getAnswerIndex());
      }
    }
  } catch (error) {
    console.error("창 크기 변경 처리 실패:", error);
  }
}

/* ----- 에러 표시 ----- */
function showError(message, type = "error") {
  try {
    // 간단한 에러 표시 (실제로는 더 정교한 시스템 필요)
    const hudState = elements.hudState();
    if (hudState) {
      const originalText = hudState.textContent;
      hudState.textContent = message;
      hudState.style.color = type === "success" ? "#4ade80" : "#f87171";
      
      setTimeout(() => {
        hudState.textContent = originalText;
        hudState.style.color = "";
      }, 3000);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
    
  } catch (error) {
    console.error("에러 표시 실패:", error);
  }
}

/* ----- 유틸리티 함수들 ----- */
function pickTwoDistinct(n) {
  if (n < 2) return [0, 0];
  
  let a = Math.floor(Math.random() * n);
  let b = Math.floor(Math.random() * n);
  while (b === a) b = Math.floor(Math.random() * n);
  
  return [a, b];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return "알 수 없음";
  }
}

/* ----- 게임 완료 시 자동 결과 화면 이동 ----- */
function checkGameCompletion() {
  if (state.round >= 5 && state.currentView === 'game') {
    setTimeout(() => {
      showView('result');
    }, 2000);
  }
}

// 게임 완료 체크를 결과 처리에 추가
const originalFinishRound = finishRound;
finishRound = function(correct, pickedEl) {
  originalFinishRound(correct, pickedEl);
  checkGameCompletion();
};