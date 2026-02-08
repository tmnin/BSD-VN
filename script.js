// =========================
// CONFIG YOU SHOULD EDIT
// =========================
const HER = "Allie";
const YOU = "Abeer";
const CORGI_NAME = "Yokai";

// local mp4 (loops)
const YIPPEE_GIF = "images/gif.mp4";

// Your letter content (Dazai reads it)
const LETTER_TEXT =
`${HER}へ。

言葉を一緒に学ぶうちに、いつの間にか
君と話す時間そのものが一番大切になっていました。

遠くにいても、同じ言葉を選んで、同じ意味を考えて、
心が近く感じられる瞬間が本当に嬉しかった。

不器用で回りくどい形になったけど、
それでも、この気持ちは本物です。

今年のバレンタイン、僕のバレンタインになってくれますか？

— ${YOU}`;

// Sprite filenames (must exist in /images)
const SPRITES = {
  dazai_neutral: "images/dazai_neutral.png",
  dazai_chill: "images/dazai_chill.png",
  dazai_thinking: "images/dazai_thinking.png",
  dazai_smile: "images/dazai_smile.png",
  dazai_love: "images/dazai_love.png",
  atsushi_neutral: "images/atsushi_neutral.png",
  kunikida_neutral: "images/kunikida_neutral.png",
};

// Typing speed per speaker (ms per character)
const TYPING_SPEED = {
  "太宰治": 26,
  "中島敦": 16,
  "国木田独歩": 18,
  "太宰治（手紙）": 34,
};

// =========================
// DOM
// =========================
const el = {
  sprites: document.getElementById("sprites"),
  name: document.getElementById("nameplate"),
  text: document.getElementById("text"),
  minigame: document.getElementById("minigame"),
  nextBtn: document.getElementById("nextBtn"),
  restartBtn: document.getElementById("restartBtn"),
  confetti: document.getElementById("confetti"),
  dialogueBox: document.getElementById("dialogueBox"),
};

// =========================
// TITLE SCREEN
// =========================
const title = {
  screen: document.getElementById("titleScreen"),
  startBtn: document.getElementById("startBtn"),
  continueBtn: document.getElementById("continueBtn"),
};

const SAVE_KEY = "bsd_vn_save_v1";

function saveProgress(){
  const data = {
    idx,
    progress,
    actionShown: [...actionShown],
    leftKey,
    rightKey,
    centerKey,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(_) {}
}

function loadProgress(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  } catch(_) {
    return null;
  }
}

function hasSave(){
  const s = loadProgress();
  return !!(s && typeof s.idx === "number");
}

function showTitle(){
  document.body.classList.add("preTitle");
  if(title?.screen) title.screen.style.display = "flex";
  if(title?.continueBtn){
    if(hasSave()) title.continueBtn.classList.remove("hidden");
    else title.continueBtn.classList.add("hidden");
  }
}

function hideTitle(){
  document.body.classList.remove("preTitle");
  if(title?.screen) title.screen.style.display = "none";
}


// =========================
// 3-SLOT SPRITES (left/center/right)
// =========================
const spritesRoot = el.sprites;

// center uses existing speakerSprite element
const centerSprite = document.getElementById("speakerSprite");
centerSprite.id = "centerSprite";
centerSprite.classList.add("spriteSlot");

// create left + right
const leftSprite = document.createElement("img");
leftSprite.id = "leftSprite";
leftSprite.className = "spriteSlot";
leftSprite.alt = "";
spritesRoot.appendChild(leftSprite);

const rightSprite = document.createElement("img");
rightSprite.id = "rightSprite";
rightSprite.className = "spriteSlot";
rightSprite.alt = "";
spritesRoot.appendChild(rightSprite);

// One consistent “upper-body crop/zoom” for ALL sprites (fixes size mismatch)
(function injectSpriteCSS() {
  const style = document.createElement("style");
  style.textContent = `
    /* override any older sprite rules */
    .spriteSlot{
      position:absolute;
      left:50%;
      bottom:-22vh;            /* push lower body off-screen */
      height:120vh;            /* zoom in */
      max-height:120vh;
      width:auto;
      max-width:110vw;
      object-fit:cover;        /* crop instead of shrinking */
      filter: drop-shadow(0 18px 50px rgba(0,0,0,.45));
      transition: opacity .18s ease, transform .22s ease;
      pointer-events:none;
      opacity:0;
      z-index:2;
    }

    #centerSprite{ transform: translateX(-50%); opacity:1; z-index:2; }
    #leftSprite  { transform: translateX(-65%); z-index:2; }
    #rightSprite { transform: translateX(-35%); z-index:2; }

    .dimmed{ opacity:.55 !important; }
  `;
  document.head.appendChild(style);
})();

// =========================
// ENGINE STATE
// =========================
let idx = 0;

// who is currently “in the scene”
let leftKey = null;    // spriteKey currently on left
let rightKey = null;   // spriteKey currently on right
let centerKey = "dazai_neutral";

// typing state
let typingTimer = null;
let isTyping = false;
let pendingOnDone = null;
let currentTypingText = "";

// prevents re-mounting the same action repeatedly
const actionShown = new Set();

// blocks next until minigame solved
let mgLock = false;

const progress = {
  mg1: false,
  mg2: false,
  mg3: false,
  ended: false,
};

// =========================
// SCRIPT (Japanese)
// =========================
const SCRIPT = [
  { speaker:"太宰治", sprite:"dazai_neutral", text:"……やあ。\nようこそ、武装探偵社へ。" },
  { speaker:"太宰治", sprite:"dazai_neutral", text:"今日は比較的、静かな一日だよ。\nもっとも――「静か」というのは、ここでは少し珍しいけどね。" },

  { speaker:"太宰治", sprite:"dazai_chill", text:`さて。\n君を呼んだ理由なんだけど……ちょっと変わった依頼が入ってきてね。` },

  { speaker:"中島敦", sprite:"atsushi_neutral", text:"あ、太宰さん。\nその依頼って、今日中に処理しないといけないんですよね？" },
  { speaker:"太宰治", sprite:"dazai_chill", text:"うーん……どうだろう。\n緊急性はあまりないけど、重要度は高いかな。" },
  { speaker:"中島敦", sprite:"atsushi_neutral", text:"それ、仕事として成立してますか……？" },
  { speaker:"太宰治", sprite:"dazai_chill", text:"もちろん。\n人の心に関わる案件は、いつだって最優先さ。" },

  { speaker:"国木田独歩", sprite:"kunikida_neutral", text:"太宰。\n今度は何を企んでいる。" },
  { speaker:"太宰治", sprite:"dazai_chill", text:"企むだなんて人聞きが悪いな。\nこれは立派な依頼だよ。" },
  { speaker:"国木田独歩", sprite:"kunikida_neutral", text:"……依頼書は？" },
  { speaker:"太宰治", sprite:"dazai_chill", text:"それがね、文字だけ残して姿を消してしまってさ。" },
  { speaker:"国木田独歩", sprite:"kunikida_neutral", text:"規定違反だ。\n私は関与しない。" },

  { speaker:"太宰治", sprite:"dazai_chill", text:"――というわけで。\n少々自由な進行になるけど、許してほしい。" },

  { speaker:"太宰治", sprite:"dazai_chill", text:"今回の依頼人は、とても慎重な人物でね。\n自分の気持ちを、そのまま渡すことができなかったらしい。" },
  { speaker:"太宰治", sprite:"dazai_chill", text:"だから代わりに、いくつかの「手がかり」を残した。\n言葉に関するもの、選び方に関するもの、そして――とても個人的なもの。" },

  { speaker:"太宰治", sprite:"dazai_thinking", text:"まずは最初の手がかりだ。\n依頼人は、ある気持ちを言葉にしようとした。\nでも、日本語には似た表現が多すぎる。" },
  { speaker:"太宰治", sprite:"dazai_thinking", text:"次の中から、「この依頼人の気持ち」に一番近い言葉を選んでほしい。\n……深く考えすぎなくていい。直感で構わないよ。", action:"mg1" },

  { speaker:"太宰治", sprite:"dazai_smile", text:"ふふ。\nやっぱり、そう来ると思った。" },

  { speaker:"太宰治", sprite:"dazai_smile", text:"じゃあ次。\nこれは依頼人が書こうとして、途中でやめてしまった一文。\n順番を整えれば、きっと自然な形になるはずだよ。", action:"mg2" },

  { speaker:"太宰治", sprite:"dazai_smile", text:"……綺麗だね。\n無駄がなくて、それでいて温度がある。" },

  { speaker:"太宰治", sprite:"dazai_thinking", text:"最後は、とても身近な存在だ。\n四本足で、人より早く朝を知っていて、依頼人の生活リズムを完全に支配している。\nしかも、とても愛されている。" },
  { speaker:"太宰治", sprite:"dazai_thinking", text:"さて。これは何のことだろう？", action:"mg3" },

  { speaker:"太宰治", sprite:"dazai_smile", text:"正解。\n……妖怪。" },
  { speaker:"太宰治", sprite:"dazai_smile", text:`ちなみに……君のコーギーの名前は「${CORGI_NAME}」だったね。` },

  { speaker:"太宰治", sprite:"dazai_love", text:"……ここから先は、依頼人から預かった手紙だ。\n代読という形になるけど、許してもらおう。\n――では、読むよ。", action:"letter" },

  { speaker:"太宰治", sprite:"dazai_love", text:"……だそうだ。\nさて、Allie。\n探偵としての仕事は、ここまで。\nあとは――君自身の答えを聞かせてほしい。", action:"finalQuestion" },
];

// =========================
// AUTO “LEAVE SCENE” INDICES
// (so you do NOT need to add stage fields everywhere)
// =========================
const lastIdx = {
  atsushi: -1,
  kunikida: -1,
};
for (let i = 0; i < SCRIPT.length; i++) {
  const s = SCRIPT[i].speaker;
  if (s === "中島敦") lastIdx.atsushi = i;
  if (s === "国木田独歩") lastIdx.kunikida = i;
}

// =========================
// HELPERS
// =========================
function typingSpeedFor(speaker){
  return TYPING_SPEED[speaker] ?? 24;
}

function setSprite(imgEl, spriteKey){
  const src = SPRITES[spriteKey];
  if(!src) return;
  imgEl.src = src;
  imgEl.style.opacity = "1";
}

function clearSlot(which){
  if(which === "left"){
    leftKey = null;
    leftSprite.style.opacity = "0";
    leftSprite.src = "";
    leftSprite.classList.remove("dimmed");
  }
  if(which === "right"){
    rightKey = null;
    rightSprite.style.opacity = "0";
    rightSprite.src = "";
    rightSprite.classList.remove("dimmed");
  }
}

function applySceneForLine(line){
  // 1) Ensure Dazai always exists in center + can change expressions
  centerKey = line.sprite && line.speaker.startsWith("太宰治") ? line.sprite : centerKey;
  setSprite(centerSprite, centerKey);

  // 2) If current line is Atsushi / Kunikida, make sure they are “in scene”
  if(line.speaker === "中島敦"){
    rightKey = line.sprite || rightKey || "atsushi_neutral";
    setSprite(rightSprite, rightKey);
  }
  if(line.speaker === "国木田独歩"){
    leftKey = line.sprite || leftKey || "kunikida_neutral";
    setSprite(leftSprite, leftKey);
  }

  // 3) After their LAST line has passed, remove them automatically
  // (idx is global and points at the line being rendered)
  if (idx > lastIdx.atsushi) clearSlot("right");
  if (idx > lastIdx.kunikida) clearSlot("left");

  // 4) Dimming: brighten the speaking character, dim others
  centerSprite.classList.remove("dimmed");
  leftSprite.classList.remove("dimmed");
  rightSprite.classList.remove("dimmed");

  let speakingSlot = "center";
  if(line.speaker === "中島敦") speakingSlot = "right";
  if(line.speaker === "国木田独歩") speakingSlot = "left";

    // 5) Layering: speaker in front, others behind
  const FRONT = 6;
  const MID   = 5;
  const BACK  = 4;

  // default all to BACK
  centerSprite.style.zIndex = BACK;
  leftSprite.style.zIndex   = BACK;
  rightSprite.style.zIndex  = BACK;

  // put speaker in front; keep Dazai slightly above others when not speaking
  if (speakingSlot === "center") {
    centerSprite.style.zIndex = FRONT;
    if (leftKey)  leftSprite.style.zIndex  = BACK;
    if (rightKey) rightSprite.style.zIndex = BACK;
  } else if (speakingSlot === "left") {
    leftSprite.style.zIndex   = FRONT;
    centerSprite.style.zIndex = MID;   // Dazai behind speaker but not “gone”
    if (rightKey) rightSprite.style.zIndex = BACK;
  } else { // right
    rightSprite.style.zIndex  = FRONT;
    centerSprite.style.zIndex = MID;
    if (leftKey) leftSprite.style.zIndex = BACK;
  }

  if(speakingSlot !== "center") centerSprite.classList.add("dimmed");
  if(speakingSlot !== "left" && leftKey) leftSprite.classList.add("dimmed");
  if(speakingSlot !== "right" && rightKey) rightSprite.classList.add("dimmed");
}

function stopTyping(){
  if(typingTimer) clearInterval(typingTimer);
  typingTimer = null;
  isTyping = false;

  if (pendingOnDone){
    const cb = pendingOnDone;
    pendingOnDone = null;
    cb();
  }
}

function typeText(fullText, speed, onDone){
  currentTypingText = fullText;          // <-- add this line
  if(typingTimer) clearInterval(typingTimer);
  isTyping = true;
  el.text.textContent = "";
  let i = 0;

  pendingOnDone = typeof onDone === "function" ? onDone : null;

  typingTimer = setInterval(()=>{
    el.text.textContent += fullText[i] ?? "";
    i++;
    if(i >= fullText.length){
      clearInterval(typingTimer);
      typingTimer = null;
      isTyping = false;

      if (pendingOnDone){
        const cb = pendingOnDone;
        pendingOnDone = null;
        cb();
      }
    }
  }, speed);
}

function showMinigameContainer(title, hint){
  el.minigame.classList.remove("hidden");
  el.minigame.innerHTML = `
    <div class="mg-title">${title}</div>
    <div class="mg-hint">${hint}</div>
    <div id="mgBody"></div>
    <div id="mgStatus" class="mg-status"></div>
  `;
  return {
    body: el.minigame.querySelector("#mgBody"),
    status: el.minigame.querySelector("#mgStatus")
  };
}

function isAutoAction(action){
  return action === "mg1" || action === "mg2" || action === "mg3" || action === "finalQuestion";
}

function renderLine(){
  const line = SCRIPT[idx];

  // speaker label
  el.name.textContent = line.speaker;

  // scene sprites (persistent cast + dimming)
  applySceneForLine(line);

  // reset UI
  el.minigame.classList.add("hidden");
  el.minigame.innerHTML = "";

  el.restartBtn.classList.add("hidden");
  el.nextBtn.classList.remove("hidden");
  el.nextBtn.disabled = false;

  // lock next if minigame line
  mgLock = (line.action === "mg1" || line.action === "mg2" || line.action === "mg3");

  const speed = typingSpeedFor(line.speaker);

  typeText(line.text, speed, () => {
    if(line.action && !actionShown.has(idx)){
      if(line.action === "mg1" || line.action === "mg2" || line.action === "mg3" || line.action === "finalQuestion"){
        actionShown.add(idx);
        runActionIfAny(line);
      }
    }
  });
}

// =========================
// ACTIONS (MINIGAMES + FINAL)
// =========================
function runActionIfAny(line){
  if(!line.action) return;

  if(line.action === "mg1"){
    if(progress.mg1) { mgLock = false; return; }
    showMG1();
    return;
  }
  if(line.action === "mg2"){
    if(progress.mg2) { mgLock = false; return; }
    showMG2();
    return;
  }
  if(line.action === "mg3"){
    if(progress.mg3) { mgLock = false; return; }
    showMG3();
    return;
  }
  if(line.action === "letter"){
    // Dazai reads letter (ONLY after click)
    el.name.textContent = "太宰治（手紙）";
    const speed = typingSpeedFor("太宰治（手紙）");
    typeText(LETTER_TEXT, speed, () => {
      mgLock = false;
    });
    return;
  }
  if(line.action === "finalQuestion"){
    showFinalQuestion();
    return;
  }
}

// ----- MG1 -----
function showMG1(){
  const {body, status} = showMinigameContainer(
    "ミニゲーム ①：ニュアンス判定",
    "依頼人の気持ちに一番近い表現を選んで。"
  );

  const choices = [
    { label:"好きだよ", ok:false, why:"少し軽い。まだ距離がある感じがするね。" },
    { label:"大好き", ok:false, why:"温度はあるけど、依頼人の“決意”にはもう一段足りない。" },
    { label:"愛してる", ok:true, why:"うん。ここはそれくらい、まっすぐでいい。" },
  ];

  body.innerHTML = `<div class="choice-grid"></div>`;
  const grid = body.querySelector(".choice-grid");

  for(const c of choices){
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = c.label;
    btn.onclick = ()=>{
      if(c.ok){
        status.textContent = "正解。…ふふ。";
        progress.mg1 = true;
        mgLock = false;
        setSprite(centerSprite, "dazai_smile");
        centerKey = "dazai_smile";
      } else {
        status.textContent = `うーん…惜しい。${c.why}`;
      }
    };
    grid.appendChild(btn);
  }
}

// ----- MG2 -----
function showMG2(){
  const {body, status} = showMinigameContainer(
    "ミニゲーム ②：文の復元",
    "文片を自然な順番に並べて。ドラッグでもタップでもOK。"
  );

  const fragments = [
    {id:"a", text:"遠くにいても、"},
    {id:"b", text:"同じ言葉を選んで、"},
    {id:"c", text:"同じ意味を考えて、"},
    {id:"d", text:"心が近く感じられる。"},
  ];

  body.innerHTML = `
    <div class="mg-hint" style="margin-top:0;">
      緑の枠に入った順番が解答になります。
      （※最後は「心が近く感じられる。」で固定）
    </div>
    <div class="pool" id="pool"></div>
    <div style="height:10px"></div>
    <div class="dropzone" id="zone"></div>
    <div class="mg-actions">
      <button class="btn" id="checkOrder">確認</button>
      <button class="btn primary" id="resetOrder">戻す</button>
    </div>
  `;

  const pool = body.querySelector("#pool");
  const zone = body.querySelector("#zone");
  const checkBtn = body.querySelector("#checkOrder");
  const resetBtn = body.querySelector("#resetOrder");

  const shuffled = [...fragments].sort(()=>Math.random()-0.5);
  for(const f of shuffled){
    pool.appendChild(makeTile(f));
  }

  function makeTile(f){
    const elTile = document.createElement("div");
    elTile.className = "tile";
    elTile.id = `tile-${f.id}`;
    elTile.textContent = f.text;
    elTile.draggable = true;

    elTile.addEventListener("dragstart", (e)=>{
      e.dataTransfer.setData("text/plain", f.id);
    });

    elTile.addEventListener("click", ()=>{
      if(elTile.parentElement === pool) zone.appendChild(elTile);
      else pool.appendChild(elTile);
    });

    return elTile;
  }

  function enableDnD(container){
    container.addEventListener("dragover", (e)=>e.preventDefault());
    container.addEventListener("drop", (e)=>{
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const tile = body.querySelector(`#tile-${id}`);
      if(tile) container.appendChild(tile);
    });
  }
  enableDnD(pool);
  enableDnD(zone);

  function currentOrder(){
    return [...zone.querySelectorAll(".tile")].map(t => t.id.replace("tile-",""));
  }

  function isValidOrder(order){
    if(order.length !== 4) return false;
    if(order[3] !== "d") return false;
    const firstThree = order.slice(0,3);
    const set = new Set(firstThree);
    return set.size === 3 && set.has("a") && set.has("b") && set.has("c");
  }

  checkBtn.onclick = ()=>{
    const order = currentOrder();
    if(order.length !== 4){
      status.textContent = "まだ全部入ってないみたい。";
      return;
    }
    if(isValidOrder(order)){
      status.textContent = "正解。文章が綺麗に戻った。";
      progress.mg2 = true;
      mgLock = false;
      setSprite(centerSprite, "dazai_smile");
      centerKey = "dazai_smile";
    } else {
      status.textContent = "うーん…最後が少し不自然かも。もう一度。";
    }
  };

  resetBtn.onclick = ()=>{
    [...zone.querySelectorAll(".tile")].forEach(t => pool.appendChild(t));
    status.textContent = "";
  };
}

// ----- MG3 -----
function showMG3(){
  const {body, status} = showMinigameContainer(
    "ミニゲーム ③：身近な存在",
    "まずは正体を当てて。そのあと“日本語”で答えて。"
  );

  body.innerHTML = `
    <div class="choice-grid" id="who"></div>
    <div style="height:10px"></div>
    <div id="nameStep" class="hidden">
      <div class="mg-hint">次：コーギーの名前は？（漢字か、ひらがな）</div>
      <input type="text" id="nameInput" placeholder="" autocomplete="off" />
      <div class="mg-actions">
        <button class="btn primary" id="checkName">照合</button>
      </div>
    </div>
  `;

  const who = body.querySelector("#who");
  const nameStep = body.querySelector("#nameStep");
  const nameInput = body.querySelector("#nameInput");
  const checkName = body.querySelector("#checkName");

  const options = [
    {label:"コーヒーメーカー", ok:false},
    {label:"目覚まし時計", ok:false},
    {label:"コーギー", ok:true},
  ];

  for(const o of options){
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = o.label;
    btn.onclick = ()=>{
      if(o.ok){
        status.textContent = "正体は…コーギー。ふふ。";
        nameStep.classList.remove("hidden");
        nameInput.focus();
      } else {
        status.textContent = "惜しい。もう一度考えてみて。";
      }
    };
    who.appendChild(btn);
  }

  function normJP(s){
    return (s||"").trim().replace(/\s+/g,"");
  }

  function looksRomaji(s){
    return /^[a-zA-Z]+$/.test((s||"").trim());
  }

  checkName.onclick = ()=>{
    const raw = (nameInput.value || "").trim();
    const ans = normJP(raw);

    if(!raw){
      status.textContent = "……空欄だよ。";
      return;
    }

    if(looksRomaji(raw)){
      status.textContent = "……ここは日本だよ？（日本語でお願い）";
      return;
    }

    if(ans === "妖怪" || ans === "ようかい"){
      status.textContent = "正解。……妖怪。";
      progress.mg3 = true;
      mgLock = false;
      setSprite(centerSprite, "dazai_smile");
      centerKey = "dazai_smile";
    } else {
      status.textContent = "うーん…違うみたい。漢字か、ひらがなで。";
    }
  };

  nameInput.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") checkName.click();
  });
}

// ----- Final Question -----
function showFinalQuestion(){
  el.minigame.classList.remove("hidden");
  el.minigame.innerHTML = `
    <div class="mg-title">最終質問</div>
    <div class="mg-hint">答えを聞かせて。…“いいえ”は捕まえられないかも。</div>
    <div class="arena" id="arena">
      <button class="btn primary floating" id="yesBtn">はい</button>
      <button class="btn floating" id="noBtn">いいえ</button>
    </div>
    <div class="endWrap hidden" id="endWrap">
      <video class="endGif" id="endGif" autoplay loop muted playsinline></video>
      <div class="endText" id="endText"></div>
    </div>
  `;

  el.nextBtn.classList.add("hidden");

  const arena = el.minigame.querySelector("#arena");
  const yesBtn = el.minigame.querySelector("#yesBtn");
  const noBtn  = el.minigame.querySelector("#noBtn");
  const endWrap = el.minigame.querySelector("#endWrap");
  const endGif = el.minigame.querySelector("#endGif");
  const endText = el.minigame.querySelector("#endText");

  place(noBtn, 68, 58);
  place(yesBtn, 35, 58);

  function place(btn, px, py){
    btn.style.left = px + "%";
    btn.style.top = py + "%";
    btn.style.transform = "translate(-50%,-50%)";
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

  function dodge(pointerX, pointerY){
    const rect = arena.getBoundingClientRect();
    const cx = pointerX - rect.left;
    const cy = pointerY - rect.top;

    const corners = [
      {x:18,y:28},{x:82,y:28},{x:18,y:82},{x:82,y:82}
    ];
    corners.sort((a,b)=>{
      const da = (a.x/100*rect.width - cx)**2 + (a.y/100*rect.height - cy)**2;
      const db = (b.x/100*rect.width - cx)**2 + (b.y/100*rect.height - cy)**2;
      return db - da;
    });

    const best = corners[0];
    const jx = (Math.random()*10 - 5);
    const jy = (Math.random()*10 - 5);
    place(noBtn, clamp(best.x + jx, 12, 88), clamp(best.y + jy, 18, 88));
  }

  arena.addEventListener("mousemove", (e)=>{
    const r = noBtn.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width/2);
    const dy = e.clientY - (r.top + r.height/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < 120) dodge(e.clientX, e.clientY);
  });
  noBtn.addEventListener("mouseenter", (e)=>dodge(e.clientX, e.clientY));
  noBtn.addEventListener("touchstart", (e)=>{
    const t = e.touches[0];
    dodge(t.clientX, t.clientY);
  }, {passive:true});

  yesBtn.addEventListener("click", ()=>{
    runConfetti();

    yesBtn.disabled = true;
    noBtn.disabled = true;

    endWrap.classList.remove("hidden");
    endGif.src = YIPPEE_GIF;
    // Some browsers need an explicit play() even with autoplay
    endGif.play?.().catch(()=>{});

    endText.textContent =
      "事件解決。💗\n\n" +
      "（太宰治は、満足そうに微笑んだ。）\n\n" +
      "…さて。\n" +
      "この続きは、二人だけの物語だ。\n";

    el.restartBtn.classList.remove("hidden");

    el.name.textContent = "太宰治";
    el.text.textContent = "……ふふ。事件解決、だね。おめでとう。";
    progress.ended = true;
  });
}

// =========================
// CONFETTI (no libs)
// =========================
function runConfetti(){
  const canvas = el.confetti;
  const ctx = canvas.getContext("2d", { alpha: true });
  canvas.style.display = "block";

  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize(){
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);

  const pieces = [];
  const N = 180;

  for(let i=0;i<N;i++){
    pieces.push({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * 200,
      w: 6 + Math.random() * 8,
      h: 3 + Math.random() * 5,
      vx: -1.5 + Math.random() * 3,
      vy: 2 + Math.random() * 3.2,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      hue: Math.floor(Math.random() * 360),
      life: 220 + Math.random() * 140
    });
  }

  function tick(){
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let alive = false;

    for(const p of pieces){
      if(p.life <= 0) continue;

      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;

      if(p.y > window.innerHeight + 60) continue;

      alive = true;

      const alpha = Math.max(0, Math.min(1, (window.innerHeight - p.y) / 140));

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 62%, ${alpha})`;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }

    if(alive) requestAnimationFrame(tick);
    else canvas.style.display = "none";
  }

  requestAnimationFrame(tick);
}

// =========================
// EVENTS
// =========================
el.nextBtn.addEventListener("click", ()=>{
  const line = SCRIPT[idx];

  // 1) If typing: fast-forward text AND trigger auto-actions (minigames/final)
  if(isTyping){
  if(typingTimer) clearInterval(typingTimer);
  typingTimer = null;
  isTyping = false;

  const cb = pendingOnDone;     // keep whatever would have happened on finish
  pendingOnDone = null;

  el.text.textContent = currentTypingText;   // <-- key fix

  if (cb) cb(); // optional but nice: ensures any "onDone" logic still runs

  if(line.action && isAutoAction(line.action) && !actionShown.has(idx)){
    actionShown.add(idx);
    runActionIfAny(line);
  }
  return;
  }

  // 2) Block advance if minigame still locked
  if(mgLock) return;

  // 3) Manual letter trigger (must click next to start the letter)
  if(line.action === "letter" && !actionShown.has(idx)){
    actionShown.add(idx);
    runActionIfAny(line);
    return;
  }

  // 4) Normal advance
  if(idx < SCRIPT.length - 1){
    idx++;
    renderLine();
    saveProgress();
  }

});

// Click box to advance (VN feel)
el.dialogueBox.addEventListener("click", (e)=>{
  if(e.target.closest("#minigame")) return;
  if(e.target.closest("button")) return;
  if(progress.ended) return;
  el.nextBtn.click();
});

el.restartBtn.addEventListener("click", ()=>{
  location.reload();
});

// =========================
// START
// =========================
// =========================
// START
// =========================
(function init(){
  // Preload sprites
  Object.values(SPRITES).forEach(src => { const im = new Image(); im.src = src; });

  // Start with Dazai visible (so background scene looks alive behind title)
  centerKey = "dazai_neutral";
  setSprite(centerSprite, centerKey);

  // Show title overlay first
  showTitle();

  function startFresh(){
    // reset core state (in case player hit restart and came back)
    idx = 0;
    actionShown.clear();
    mgLock = false;

    progress.mg1 = false;
    progress.mg2 = false;
    progress.mg3 = false;
    progress.ended = false;

    leftKey = null;
    rightKey = null;
    centerKey = "dazai_neutral";
    setSprite(centerSprite, centerKey);

    hideTitle();
    renderLine();
    saveProgress();
  }

  function continueGame(){
    const s = loadProgress();
    if(!s){ startFresh(); return; }

    idx = s.idx ?? 0;

    // restore progress + actionShown
    if(s.progress){
      progress.mg1 = !!s.progress.mg1;
      progress.mg2 = !!s.progress.mg2;
      progress.mg3 = !!s.progress.mg3;
      progress.ended = !!s.progress.ended;
    }
    actionShown.clear();
    (s.actionShown || []).forEach(i => actionShown.add(i));

    leftKey = s.leftKey ?? null;
    rightKey = s.rightKey ?? null;
    centerKey = s.centerKey ?? "dazai_neutral";

    // restore sprites into slots
    setSprite(centerSprite, centerKey);
    if(leftKey) setSprite(leftSprite, leftKey);
    if(rightKey) setSprite(rightSprite, rightKey);

    hideTitle();
    renderLine();
  }

  // Wire buttons
  title?.startBtn?.addEventListener("click", startFresh);
  title?.continueBtn?.addEventListener("click", continueGame);

  // Click anywhere on title to start (but don't steal button clicks)
  title?.screen?.addEventListener("click", (e)=>{
    if(e.target.closest("button")) return;
    startFresh();
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e)=>{
    if(title?.screen?.style.display !== "none"){
      if(e.key === "Enter") startFresh();
      if(e.key === "Escape" && hasSave()) continueGame();
    }
  });

  // Auto-save periodically: after every advance, we’ll also save (see below)
})();
