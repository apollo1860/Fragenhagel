// main.js
(() => {
  // ====== State ======
  const MAX_ROUNDS = 5;
  const state = {
    players: [],
    scores: {},                     // name -> score
    currentRound: 1,
    roundQueue: [],                 // Spieler, die in Runde noch nicht dran waren
    currentPlayer: null,
    timer: { sec: 0, handle: null, running: false },
    usedQuestionIdx: new Set(),     // über alle Runden
    currentQuestionIdx: null
  };

  // --- Fallback, falls questions.js nicht geladen ist ---
  if (!window.QUESTION_POOL || !Array.isArray(window.QUESTION_POOL)) {
    console.warn("questions.js wurde nicht geladen oder QUESTION_POOL ist nicht definiert.");
    window.QUESTION_POOL = []; // Fallback, damit die App nicht blockiert
  }

  // ====== DOM ======
  const $ = (sel) => document.querySelector(sel);
  const screenSetup = $("#screen-setup");
  const screenSlot  = $("#screen-slot");
  const screenPlay  = $("#screen-play");
  const screenSum   = $("#screen-summary");

  const playerListEl = $("#player-list");
  const playerInput  = $("#player-input");
  const btnAdd       = $("#btn-add");
  const btnStart     = $("#btn-start");

  const roller       = $("#slot-roller");
  const btnSpin      = $("#btn-spin");
  const btnAccept    = $("#btn-accept");
  const roundInfo    = $("#round-info");

  const hudPlayer    = $("#hud-player");
  const hudScore     = $("#hud-score");
  const hudRound     = $("#hud-round");
  const timerEl      = $("#timer");

  const startOverlay = $("#start-overlay");
  const btnGo        = $("#btn-go");
  const qaArea       = $("#qa-area");
  const qBox         = $("#question-box");
  const aBox         = $("#answer-box");
  const btnCorrect   = $("#btn-correct");
  const btnWrong     = $("#btn-wrong");

  const timeup       = $("#timeup");
  const btnNextPl    = $("#btn-next-player");

  const summaryTbl   = $("#summary-table");
  const btnRestart   = $("#btn-restart");

  // ====== Utils ======
  function switchScreen(screenEl){
    [screenSetup, screenSlot, screenPlay, screenSum].forEach(s => s.classList.remove("active"));
    screenEl.classList.add("active");
  }

  function renderPlayers(){
    playerListEl.innerHTML = "";
    state.players.forEach((name, i) => {
      const chip = document.createElement("div");
      chip.className = "player-chip";
      chip.innerHTML = `
        <span>${escapeHTML(name)}</span>
        <button class="del" title="Entfernen" data-i="${i}" type="button">×</button>
      `;
      playerListEl.appendChild(chip);
    });

    // Start-Button aktivieren, sobald mind. 1 Spieler vorhanden ist
    btnStart.disabled = state.players.length === 0 ? true : false;
  }

  function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function mmss(sec){
    const m = Math.floor(sec/60).toString().padStart(2, "0");
    const s = (sec%60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ====== Setup Screen ======
  btnAdd.addEventListener("click", addPlayer);
  playerInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter") addPlayer(); });

  playerListEl.addEventListener("click", (e)=>{
    if (e.target.classList.contains("del")){
      const idx = Number(e.target.dataset.i);
      const [removed] = state.players.splice(idx,1);
      delete state.scores[removed];
      renderPlayers();
    }
  });

  function addPlayer(){
    let name = playerInput.value;
    if (!name) return;
    name = name.trim();
    if (!name) return;

    if(state.players.includes(name)){
      alert("Name existiert bereits.");
      return;
    }
    state.players.push(name);
    state.scores[name] = 0;
    playerInput.value = "";
    renderPlayers();

    // Komfort: Fokus wieder ins Feld, um schnell mehrere Spieler anzulegen
    playerInput.focus();
  }

  btnStart.addEventListener("click", ()=>{
    if(state.players.length === 0) return;
    state.roundQueue = [...state.players]; // Runde 1: alle
    switchScreen(screenSlot);
    prepareSlot();
    roundInfo.textContent = `Runde ${state.currentRound} von ${MAX_ROUNDS}`;
  });

  // ====== Slot Machine ======
  let spinning = false;
  let chosenName = null;
  let spinAnim = null;
  function prepareSlot(){
    // Fülle Roller mit RoundQueue (und ggf. Dummyzeilen für hübsches Scrollen)
    roller.innerHTML = "";
    const names = state.roundQueue.length ? state.roundQueue : ["–"];
    const list = [...names, ...names, ...names]; // mehrfach für Effekt
    list.forEach(n=>{
      const div = document.createElement("div");
      div.className = "slot-name";
      div.textContent = n;
      roller.appendChild(div);
    });
    roller.style.transform = `translateY(0px)`;
    btnAccept.disabled = true;
    chosenName = null;
  }

  btnSpin.addEventListener("click", ()=>{
    if (spinning) return;
    if (state.roundQueue.length === 0){
      // Sollte nicht vorkommen, aber fall-back
      proceedAfterRound();
      return;
    }
    spinning = true;
    btnAccept.disabled = true;
    const names = [...state.roundQueue];
    const rowH = document.querySelector(".slot-name")?.offsetHeight || 84;

    // Simulierter Spin: schnelle Rotation + langsames Auslaufen
    let pos = 0;
    let speed = 38; // Pixel pro Tick
    let ticks = 0;
    spinAnim = setInterval(()=>{
      ticks++;
      pos += speed;
      if (pos > rowH) pos = 0;
      roller.style.transform = `translateY(${-pos}px)`;

      // Nach ~2.2s langsamer werden
      if (ticks === 30) speed = 24;
      if (ticks === 60) speed = 14;
      if (ticks === 90){
        // Anhalten auf zufälligen Namen aus RoundQueue
        clearInterval(spinAnim);
        const index = Math.floor(Math.random() * names.length);
        chosenName = names[index];

        // Scrolle „sanft“ auf den Treffer
        const targetIdx = index + names.length; // in der mittleren Kopie
        const targetY = targetIdx * rowH;
        roller.style.transition = "transform .6s cubic-bezier(.2,.9,.2,1.2)";
        requestAnimationFrame(()=>{
          roller.style.transform = `translateY(-${targetY}px)`;
        });
        setTimeout(()=>{
          roller.style.transition = "";
          spinning = false;
          btnAccept.disabled = false;
        }, 620);
      }
    }, 40);
  });

  btnAccept.addEventListener("click", ()=>{
    if (!chosenName) return;
    // Entferne aus RoundQueue
    const idx = state.roundQueue.indexOf(chosenName);
    if (idx >= 0) state.roundQueue.splice(idx,1);
    startTurn(chosenName);
  });

  // ====== Spielen (Q/A) ======
  function startTurn(playerName){
    state.currentPlayer = playerName;
    hudPlayer.textContent = playerName;
    hudScore.textContent = state.scores[playerName] ?? 0;
    hudRound.textContent  = `${state.currentRound} / ${MAX_ROUNDS}`;
    switchScreen(screenPlay);

    // Reset UI
    timerResetUI();
    startOverlay.classList.remove("hidden");
    qaArea.classList.add("hidden");
    timeup.classList.add("hidden");
  }

  function timerResetUI(){
    state.timer.sec = 0;
    timerEl.textContent = "00:00";
    stopTimer();
  }

  function startTimer(){
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.handle = setInterval(()=>{
      state.timer.sec++;
      timerEl.textContent = mmss(state.timer.sec);
      if (state.timer.sec >= 60){
        endPlayerTurn();
      }
    }, 1000);
  }

  function stopTimer(){
    state.timer.running = false;
    if (state.timer.handle){
      clearInterval(state.timer.handle);
      state.timer.handle = null;
    }
  }

  btnGo.addEventListener("click", ()=>{
    startOverlay.classList.add("hidden");
    qaArea.classList.remove("hidden");
    nextQuestion();
    startTimer();
  });

  function nextQuestion(){
    // Hole die nächste unbenutzte Frage
    if (state.usedQuestionIdx.size >= (window.QUESTION_POOL?.length || 0)){
      // Keine Fragen mehr -> Spiel beenden
      stopTimer();
      endGame(true);
      return;
    }
    let idx;
    let tries = 0;
    do {
      idx = Math.floor(Math.random() * window.QUESTION_POOL.length);
      tries++;
      if (tries > 500) break; // Sicherheitsnetz
    } while (state.usedQuestionIdx.has(idx));

    state.currentQuestionIdx = idx;
    state.usedQuestionIdx.add(idx);

    const item = window.QUESTION_POOL[idx];
    qBox.textContent = item.q;
    aBox.textContent = item.a;

    // leichte Einblend-Animation
    qBox.style.opacity = 0; aBox.style.opacity = 0;
    requestAnimationFrame(()=>{
      qBox.style.transition = "opacity .25s ease"; aBox.style.transition = "opacity .25s ease .05s";
      qBox.style.opacity = 1; aBox.style.opacity = 1;
      setTimeout(()=>{ qBox.style.transition = ""; aBox.style.transition = ""; }, 350);
    });
  }

  // Automatischer Fragenwechsel:
  btnCorrect.addEventListener("click", ()=>{
    const p = state.currentPlayer;
    state.scores[p] = (state.scores[p] || 0) + 1;
    hudScore.textContent = state.scores[p];
    if (state.timer.running) nextQuestion();
  });

  btnWrong.addEventListener("click", ()=>{
    if (state.timer.running) nextQuestion();
  });

  function endPlayerTurn(){
    stopTimer();
    qaArea.classList.add("hidden");
    timeup.classList.remove("hidden");

    // Kurzes visuelles Feedback
    timerEl.parentElement.animate(
      [{filter:"brightness(1)"},{filter:"brightness(1.6)"},{filter:"brightness(1)"}],
      {duration:600, iterations:1}
    );
  }

  btnNextPl.addEventListener("click", ()=>{
    // Nächster Spieler oder nächste Runde/Ende
    if (state.roundQueue.length > 0){
      switchScreen(screenSlot);
      prepareSlot();
      roundInfo.textContent = `Runde ${state.currentRound} von ${MAX_ROUNDS}`;
    } else {
      // Runde vorbei
      proceedAfterRound();
    }
  });

  function proceedAfterRound(){
    if (state.currentRound >= MAX_ROUNDS){
      endGame();
      return;
    }
    state.currentRound++;
    state.roundQueue = [...state.players]; // neue Runde
    switchScreen(screenSlot);
    prepareSlot();
    roundInfo.textContent = `Runde ${state.currentRound} von ${MAX_ROUNDS}`;
  }

  function endGame(noQuestions=false){
    switchScreen(screenSum);
    renderSummary(noQuestions);
  }

  function renderSummary(exhausted){
    const playersSorted = [...state.players].sort((a,b)=> (state.scores[b]||0) - (state.scores[a]||0));
    const rows = playersSorted.map((p,i)=>`
      <tr>
        <td>${i+1}.</td>
        <td>${escapeHTML(p)}</td>
        <td><strong>${state.scores[p]||0}</strong></td>
      </tr>
    `).join("");

    const warn = exhausted ? `<p class="muted">Hinweis: Der Fragenpool war erschöpft – Spiel früher beendet.</p>` : "";

    summaryTbl.innerHTML = `
      ${warn}
      <div class="summary-table">
        <table>
          <thead><tr><th>#</th><th>Spieler</th><th>Punkte</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  btnRestart.addEventListener("click", ()=>{
    // Vollständiger Reset
    stopTimer();
    state.players = [];
    state.scores = {};
    state.currentRound = 1;
    state.roundQueue = [];
    state.currentPlayer = null;
    state.timer = {sec:0, handle:null, running:false};
    state.usedQuestionIdx.clear();
    state.currentQuestionIdx = null;
    playerInput.value = "";
    renderPlayers();
    switchScreen(screenSetup);
  });

  // ====== Init UI ======
  renderPlayers();
  switchScreen(screenSetup);
})();
