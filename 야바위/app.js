/* =========================
 *  상태 & 단계 구성
 * =======================*/
const STAGES = {
  1: { cups: 3, speedMs: 800,  swaps: 8,  showMs: 1500, points: 10, showBall: true  },
  2: { cups: 5, speedMs: 650,  swaps: 12, showMs: 1200, points: 20, showBall: true  },
  3: { cups: 5, speedMs: 420,  swaps: 18, showMs: 900,  points: 30, showBall: true  },
  4: { cups: 5, speedMs: 650,  swaps: 14, showMs: 0,    points: 50, showBall: false } // 찍기
};

const state = {
  level: 1,
  score: 0,
  roundScore: 0,
  answerIndex: 0,         // 공이 들어있는 "컵의 인덱스"
  cups: [],               // DOM 참조
  ballEl: null,           // 공 DOM
  isShuffling: false,
  allowPick: false,
  lastPicked: null
};

/* =========================
 *  요소
 * =======================*/
const scrHome  = document.getElementById('screenHome');
const scrGame  = document.getElementById('screenGame');
const scrResult= document.getElementById('screenResult');

const table    = document.getElementById('table');
const hudLevel = document.getElementById('hudLevel');
const hudScore = document.getElementById('hudScore');
const hudState = document.getElementById('hudState');

const btnStart = document.getElementById('btnStart');
const btnShuffle = document.getElementById('btnShuffle');
const btnReveal  = document.getElementById('btnReveal');
const btnQuit    = document.getElementById('btnQuit');
const btnShowRules = document.getElementById('btnShowRules');
const btnShowLeaderboard = document.getElementById('btnShowLeaderboard');

const rulesDialog = document.getElementById('rulesDialog');
const leaderboardDialog = document.getElementById('leaderboardDialog');
const leaderboardList = document.getElementById('leaderboardList');

const resultEmoji = document.getElementById('resultEmoji');
const resultText  = document.getElementById('resultText');
const roundScore  = document.getElementById('roundScore');
const totalScore  = document.getElementById('totalScore');
const saveScoreForm = document.getElementById('saveScoreForm');
const playerNameInput= document.getElementById('playerName');

const btnRetry = document.getElementById('btnRetry');
const btnHome  = document.getElementById('btnHome');

/* 단계 카드 */
const stageCards = [...document.querySelectorAll('.stage-card')];

/* ===== SFX (짧은 효과음) ===== */
let audioCtx;
function ping(freq=880, dur=0.08, type='square'){
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = 0.12;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(()=>o.stop(), dur*1000);
  }catch{}
}

/* =========================
 *  화면 전환
 * =======================*/
function showScreen(el){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
}

/* =========================
 *  홈: 단계 선택
 * =======================*/
stageCards.forEach(card=>{
  card.addEventListener('click', ()=>{
    stageCards.forEach(c=>{ c.classList.remove('selected'); c.setAttribute('aria-checked','false'); });
    card.classList.add('selected'); card.setAttribute('aria-checked','true');
    state.level = parseInt(card.dataset.level,10);
  });
});

/* =========================
 *  게임 세팅
 * =======================*/
function setupBoard(){
  const cfg = STAGES[state.level];
  table.innerHTML = '';
  state.cups = [];
  state.ballEl = null;

  // 초기 포지션: 가로 일렬(센터 정렬)
  const w = table.clientWidth, h = table.clientHeight;
  const gap = Math.min(140, Math.max(90, (w-120) / (cfg.cups+1)));
  const baseY = Math.floor(h*0.60);
  const startX = Math.floor((w - (gap*(cfg.cups-1))) / 2);

  // 공
  const ball = document.createElement('div');
  ball.className = 'ball'; table.appendChild(ball);
  state.ballEl = ball;

  // 컵 생성
  for (let i=0;i<cfg.cups;i++){
    const cup = document.createElement('button');
    cup.className = 'cup';
    cup.style.setProperty('--x', `${startX + i*gap - 60}px`);
    cup.style.setProperty('--y', `${baseY - 60}px`);
    cup.style.transform = `translate(${startX + i*gap - 60}px, ${baseY - 60}px)`;
    cup.dataset.index = i;
    cup.addEventListener('click', ()=> onPick(i, cup));
    table.appendChild(cup);
    state.cups.push(cup);
  }

  // 정답 위치
  state.answerIndex = Math.floor(Math.random()*cfg.cups);
  placeBallUnder(state.answerIndex);

  // 공개(4단계 제외)
  if (cfg.showBall){
    liftTemp(state.answerIndex, Math.min(900, cfg.showMs));
    setTimeout(()=> { hudState.textContent = '준비'; }, cfg.showMs);
  }else{
    hudState.textContent = '준비'; // 비공개
  }

  // 버튼 상태
  btnReveal.disabled = !(!cfg.showBall); // 4단계만 공개 버튼 허용
  state.allowPick = false;
  state.isShuffling = false;
  state.lastPicked = null;

  // HUD
  hudLevel.textContent = state.level;
  hudScore.textContent = state.score;
}

/* 공을 특정 컵 아래로 위치 */
function placeBallUnder(index){
  const cup = state.cups[index];
  if (!cup || !state.ballEl) return;
  const x = parseFloat(cup.style.getPropertyValue('--x')) + 60;
  const y = parseFloat(cup.style.getPropertyValue('--y')) + 96;
  state.ballEl.style.left = `${x}px`;
  state.ballEl.style.top  = `${y}px`;
}

/* 컵 잠깐 리프트(공개 연출) */
function liftTemp(index, ms=800){
  const cup = state.cups[index];
  if(!cup) return;
  cup.classList.add('lift');
  setTimeout(()=> cup.classList.remove('lift'), ms);
}

/* =========================
 *  셔플(교차 스왑 알고리즘)
 *  - 인접/가까운 두 컵을 골라 "서로를 가로지르는" 호(arc)로 교차 이동
 *  - 각 스왑 후 공의 소유 컵 인덱스를 교환
 * =======================*/
function getPos(cup){
  return { x: parseFloat(cup.style.getPropertyValue('--x')), y: parseFloat(cup.style.getPropertyValue('--y')) };
}
function setPos(cup, pos, t){
  cup.style.setProperty('--x', `${pos.x}px`);
  cup.style.setProperty('--y', `${pos.y}px`);
  cup.style.setProperty('--t', `${t}ms`);
  cup.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}

/* 스왑 1회(교차 경로) */
function swapCross(i, j, duration){
  return new Promise(resolve=>{
    const A = state.cups[i], B = state.cups[j];
    const pa = getPos(A),     pb = getPos(B);

    // 중간 제어점(위로 살짝 들어올리며 교차)
    const midY = Math.min(pa.y, pb.y) - randomRange(20, 60);
    const midAx = (pa.x + pb.x)/2, midAy = midY;
    const midBx = (pa.x + pb.x)/2, midBy = midY;

    // 1단계: 가운데로 상승 이동
    setPos(A, {x: midAx, y: midAy}, duration/2);
    setPos(B, {x: midBx, y: midBy}, duration/2);

    // 2단계: 서로의 원래 위치로 하강 이동
    setTimeout(()=>{
      setPos(A, pb, duration/2);
      setPos(B, pa, duration/2);

      // 애니 끝난 뒤 인덱스/공 갱신
      setTimeout(()=>{
        // 배열에서 자리 교체
        [state.cups[i], state.cups[j]] = [state.cups[j], state.cups[i]];

        // 공 위치 인덱스 갱신
        if (state.answerIndex === i) state.answerIndex = j;
        else if (state.answerIndex === j) state.answerIndex = i;

        // 공이 보이는 단계라면 공 위치도 따라감
        if (STAGES[state.level].showBall){
          placeBallUnder(state.answerIndex);
        }

        resolve();
      }, duration/2);
    }, duration/2);
  });
}

/* 셔플 계획 생성: 인접/근접 페어 위주로 자연스럽게 */
function planSwaps(count, nCups){
  const pairs = [];
  let last = -1;
  for (let k=0;k<count;k++){
    let a = Math.floor(Math.random()*nCups);
    let b = a + (Math.random() < 0.5 ? -1 : 1);
    if (b<0) b = a+1;
    if (b>=nCups) b = a-1;
    if (b<0 || b>=nCups) { // 한쪽 끝에서 걸리면 임의로 다른 쪽
      b = (a+1) % nCups;
    }
    // 같은 쌍 반복 방지
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (key === last){
      // 조금 다른 쌍 선택
      a = (a+1) % nCups;
      b = (a+1) % nCups;
    }
    last = key;
    pairs.push([Math.min(a,b), Math.max(a,b)]);
  }
  return pairs;
}

/* 실제 셔플 실행 */
async function shuffle(){
  if (state.isShuffling) return;
  state.isShuffling = true;
  state.allowPick = false;
  hudState.textContent = '섞는 중…';
  btnReveal.disabled = !(!STAGES[state.level].showBall); // 4단계만 공개 버튼
  ping(660,0.05,'triangle');

  const cfg = STAGES[state.level];
  const pairs = planSwaps(cfg.swaps, cfg.cups);

  // 연속 스왑
  for (const [a,b] of pairs){
    await swapCross(a, b, cfg.speedMs);
  }

  state.isShuffling = false;
  state.allowPick = true;
  hudState.textContent = '선택하세요';
  if (!STAGES[state.level].showBall){
    btnReveal.disabled = false; // 4단계에서 사용
  }
}

/* =========================
 *  선택 & 공개
 * =======================*/
function onPick(index, cupEl){
  if (!state.allowPick) return;
  state.allowPick = false;

  state.lastPicked = index;
  const correct = (index === state.answerIndex);

  // 시각: 선택 컵 리프트
  cupEl.classList.add('lift');
  if (correct) cupEl.classList.add('success'); else cupEl.classList.add('fail');

  // 공 보이게: 4단계도 정답 컵은 리프트 + 공 위치로 연출
  if (!STAGES[state.level].showBall){
    placeBallUnder(state.answerIndex);
  }

  // 결과 처리
  setTimeout(()=> finishRound(correct), 520);
}

function finishRound(win){
  const cfg = STAGES[state.level];
  state.roundScore = win ? cfg.points : 0;
  state.score += state.roundScore;

  // 결과 화면
  resultEmoji.textContent = win ? '🎉' : '❌';
  resultText.textContent  = win ? '정답입니다!' : '아쉽네요!';
  roundScore.textContent  = state.roundScore;
  totalScore.textContent  = state.score;

  hudScore.textContent = state.score;
  showScreen(scrResult);

  // 효과음
  if (win){ ping(880,0.07,'square'); setTimeout(()=>ping(1175,0.07,'square'),70); }
  else ping(220,0.12,'sawtooth');
}

/* 4단계 전용: 정답 공개 버튼 */
function revealAnswer(){
  if (state.isShuffling) return;
  if (STAGES[state.level].showBall) return; // 4단계만
  const idx = state.answerIndex;
  const cup = state.cups[idx];
  if (cup){
    cup.classList.add('lift','success');
    placeBallUnder(idx);
    btnReveal.disabled = true;
    ping(760,0.08,'triangle');
  }
}

/* =========================
 *  순위 저장(localStorage)
 * =======================*/
function getLB(){ try{ return JSON.parse(localStorage.getItem('ylb')||'[]'); }catch{ return []; } }
function setLB(arr){ localStorage.setItem('ylb', JSON.stringify(arr)); }
function refreshLeaderboard(){
  const lb = getLB().sort((a,b)=>b.score-a.score).slice(0,5);
  leaderboardList.innerHTML = '';
  lb.forEach((r,i)=>{
    const li = document.createElement('li');
    const d = new Date(r.time||Date.now());
    li.textContent = `${i+1}. ${r.name} — ${r.score}점 (${d.toLocaleDateString()})`;
    leaderboardList.appendChild(li);
  });
}

/* =========================
 *  유틸
 * =======================*/
function randomRange(a,b){ return a + Math.random()*(b-a); }

/* =========================
 *  이벤트
 * =======================*/
btnStart.addEventListener('click', ()=>{
  showScreen(scrGame);
  setupBoard();
});

btnShuffle.addEventListener('click', shuffle);
btnReveal.addEventListener('click', revealAnswer);
btnQuit.addEventListener('click', ()=> showScreen(scrHome));

btnShowRules.addEventListener('click', ()=> rulesDialog.showModal());
btnShowLeaderboard.addEventListener('click', ()=>{ refreshLeaderboard(); leaderboardDialog.showModal(); });

btnRetry.addEventListener('click', ()=>{
  showScreen(scrGame);
  setupBoard(); // 같은 단계 재시작
});
btnHome.addEventListener('click', ()=> showScreen(scrHome));

saveScoreForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = (playerNameInput.value||'Player').trim().slice(0,12);
  if (name.length<3){ alert('이름은 3자 이상 입력해주세요.'); return; }
  const lb = getLB(); lb.push({name, score: state.score, time: Date.now()});
  setLB(lb); refreshLeaderboard(); leaderboardDialog.showModal();
});

/* 초기 */
refreshLeaderboard();
