(()=>{
"use strict";

const FIREBASE_CONFIG={
  apiKey:"AIzaSyA9sFi7r006bjzRd4jNUGPPbZ8KDjlif04",
  authDomain:"wildspell.firebaseapp.com",
  databaseURL:"https://wildspell-default-rtdb.firebaseio.com",
  projectId:"wildspell",
  storageBucket:"wildspell.firebasestorage.app",
  messagingSenderId:"601752417654",
  appId:"1:601752417654:web:50219d23c03b47bc5ff657"
};

let db=null;
try{
  if(window.firebase){
    firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.database();
  }
}catch(error){console.error("Firebase failed:",error)}

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const COLORS=["red","yellow","green","blue"];
const TURN_SECONDS=30;
const SPECIAL_TYPES=new Set(["freeze","rewind","draw2","arsonist","whirlwind","stormcall","frostbite","mirror","cleanse","wild","wild4"]);

const settings=Object.assign({
  music:true,sfx:true,voice:true,reducedMotion:false,musicVolume:.45,sfxVolume:.7
},JSON.parse(localStorage.getItem("wildspellSettings")||"{}"));

let audioManifest=null;
const audioCache=new Map();
let currentMusic=null;
let mode="menu";
let roomId=null;
let mySlot=0;
let roomRef=null;
let roomListener=null;
let presenceTimer=null;
let state=null;
let pendingWildCardId=null;
let aiTimer=null;
let turnTimerInterval=null;
let lastRenderedActionId=0;
let challengeRuntime=null;

const cardNames={
  freeze:"FREEZE",
  rewind:"REWIND",
  draw2:"ARCANE +2",
  arsonist:"ARSONIST",
  whirlwind:"WHIRLWIND SWAP",
  stormcall:"STORMCALL",
  frostbite:"FROSTBITE",
  mirror:"MIRROR TRICK",
  cleanse:"CLEANSE",
  wild:"PRISM SHIFT",
  wild4:"CHAOS +4"
};

async function preload(){
  $("#loadingText").textContent="Loading character animations…";
  const imagePaths=[
    "assets/backgrounds/arena.png","assets/cards/arsonist.png",
    ...["you","gabby","skeleton"].flatMap(c=>["idle","spellcast","hurt","emote","walk","slash","thrust"].map(a=>`assets/characters/${c}/${a}.png`))
  ];
  await Promise.all(imagePaths.map(src=>new Promise(resolve=>{
    const i=new Image();i.onload=i.onerror=resolve;i.src=src;
  })));
  try{audioManifest=await fetch("assets/audio-manifest.json").then(r=>r.json())}catch(e){}
  $("#loadingText").textContent="Opening the arena…";
  await new Promise(r=>setTimeout(r,300));
  $("#loadingScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  showScreen("menu");
  playMusic("menu");
}
window.addEventListener("load",preload);

function saveSettings(){localStorage.setItem("wildspellSettings",JSON.stringify(settings))}
function playOptional(kind,name,volume=1){
  if(!audioManifest)return;
  if(kind==="sfx"&&!settings.sfx)return;
  if(kind==="voices"&&!settings.voice)return;
  const path=audioManifest[kind]?.[name];
  if(!path)return;
  let base=audioCache.get(path);
  if(!base){base=new Audio(path);base.preload="auto";audioCache.set(path,base)}
  const a=base.cloneNode();
  a.volume=Math.max(0,Math.min(1,(kind==="sfx"?settings.sfxVolume:1)*volume));
  a.play().catch(()=>{});
}
function playMusic(name){
  if(!settings.music||!audioManifest)return;
  const path=audioManifest.music?.[name];if(!path)return;
  if(currentMusic&&currentMusic.dataset.path===path)return;
  if(currentMusic){currentMusic.pause();currentMusic=null}
  const a=new Audio(path);a.dataset.path=path;a.loop=true;a.volume=settings.musicVolume;
  a.play().catch(()=>{});currentMusic=a;
}
function stopMusic(){if(currentMusic){currentMusic.pause();currentMusic=null}}

document.addEventListener("pointerdown",()=>{
  if(settings.music&&!currentMusic)playMusic(mode==="menu"?"menu":"battle")
},{once:true});

function showScreen(name){
  ["menuScreen","lobbyScreen","gameScreen"].forEach(id=>$("#"+id).classList.add("hidden"));
  $("#"+name+"Screen").classList.remove("hidden");
  if(name==="game")playMusic("battle");else if(name==="menu")playMusic("menu");
}
function toast(text){
  const e=document.createElement("div");
  e.style.cssText="position:fixed;z-index:1000;left:50%;bottom:20px;transform:translateX(-50%);background:#081321;border:2px solid #e0a547;padding:11px 17px;color:white";
  e.textContent=text;document.body.append(e);setTimeout(()=>e.remove(),2300);
}
function randomId(){return (crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now())}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function clone(o){return JSON.parse(JSON.stringify(o))}
function opponent(p){return 1-p}
function roomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function card(color,type,value=null){return{id:randomId(),color,type,value}}

function buildDeck(ruleset){
  const d=[];
  for(const color of COLORS){
    d.push(card(color,"number",0));
    for(let n=1;n<=9;n++)d.push(card(color,"number",n),card(color,"number",n));
    d.push(card(color,"freeze"),card(color,"freeze"));
    d.push(card(color,"rewind"),card(color,"rewind"));
    d.push(card(color,"draw2"),card(color,"draw2"));
  }
  for(let i=0;i<4;i++)d.push(card("wild","wild"),card("wild","wild4"));
  if(ruleset==="wild"){
    d.push(card("red","arsonist"),card("red","arsonist"));
    d.push(card("green","whirlwind"),card("green","whirlwind"));
    d.push(card("yellow","stormcall"),card("yellow","stormcall"));
    d.push(card("blue","frostbite"),card("blue","frostbite"));
    d.push(card("wild","mirror"),card("wild","mirror"));
    d.push(card("wild","cleanse"),card("wild","cleanse"));
  }
  return shuffle(d)
}
function cardPoints(c){
  if(c.type==="number")return c.value;
  if(c.type==="wild"||c.type==="wild4"||c.type==="mirror"||c.type==="cleanse")return 50;
  return 20
}
function newGameState(names,ruleset="wild",difficulty=null,scores=[0,0],round=1,starter=0){
  let deck=buildDeck(ruleset);
  const hands=[deck.splice(0,7),deck.splice(0,7)];
  let first;
  while(true){
    first=deck.shift();
    if(first.color!=="wild"&&first.type==="number")break;
    deck.push(first);deck=shuffle(deck)
  }
  return{
    names,ruleset,difficulty,
    deck,hands,discard:[first],currentColor:first.color,
    turn:starter,turnStartedAt:Date.now(),
    scores,round,targetScore:200,winner:null,roundWinner:null,
    drawStack:{amount:0,type:null},
    statuses:[
      {burn:0,burnCardIds:[],frozenCardIds:[],storm:false},
      {burn:0,burnCardIds:[],frozenCardIds:[],storm:false}
    ],
    finalCalled:[false,false],
    drawnCardId:null,
    challenge:null,
    lastSpecial:null,
    recent:[],
    action:{id:1,type:"roundStart",actor:starter,target:null,card:null},
    version:4
  }
}
function topCard(s){return s.discard[s.discard.length-1]}
function isDrawCard(c){return c.type==="draw2"||c.type==="wild4"}
function isPlayable(c,s,p){
  if(s.challenge||s.roundWinner!==null||s.winner!==null||s.turn!==p)return false;
  if(s.statuses[p].frozenCardIds.includes(c.id))return false;
  if(s.drawStack.amount>0){
    if(s.ruleset==="wild")return isDrawCard(c);
    return c.type===s.drawStack.type
  }
  if(s.statuses[p].storm)return c.color==="yellow"||c.color==="wild";
  const top=topCard(s);
  return c.color==="wild"||c.color===s.currentColor||c.type===top.type||(c.type==="number"&&top.type==="number"&&c.value===top.value)
}
function refillDeck(s){
  if(s.deck.length)return;
  const top=s.discard.pop();
  s.deck=shuffle(s.discard);
  s.discard=[top]
}
function drawCards(s,p,count){
  for(let i=0;i<count;i++){
    refillDeck(s);if(!s.deck.length)break;
    s.hands[p].push(s.deck.shift())
  }
  normalizeStatusCards(s,p)
}
function normalizeStatusCards(s,p){
  const st=s.statuses[p];
  const ids=new Set(s.hands[p].map(c=>c.id));
  st.burnCardIds=st.burnCardIds.filter(id=>ids.has(id));
  st.frozenCardIds=st.frozenCardIds.filter(id=>ids.has(id));
  while(st.burnCardIds.length<st.burn&&s.hands[p].length){
    const candidates=s.hands[p].filter(c=>!st.burnCardIds.includes(c.id));
    if(!candidates.length)break;
    st.burnCardIds.push(candidates[Math.floor(Math.random()*candidates.length)].id)
  }
}
function chooseBestColor(hand){
  const count={red:0,yellow:0,green:0,blue:0};
  hand.forEach(c=>{if(count[c.color]!==undefined)count[c.color]++});
  return COLORS.sort((a,b)=>count[b]-count[a])[0]
}
function addRecent(s,text,color="#fff"){
  s.recent.unshift({text,color,time:Date.now()});s.recent=s.recent.slice(0,8)
}
function setAction(s,type,actor,target=null,cardObj=null,extra={}){
  s.action={id:(s.action?.id||0)+1,type,actor,target,card:cardObj?{color:cardObj.color,type:cardObj.type,value:cardObj.value}:null,...extra};
  s.turnStartedAt=Date.now()
}
function resolveEndStatuses(s,p,playedColor){
  const st=s.statuses[p];
  if(st.burn>0){
    if(playedColor==="red"){
      st.burn=Math.max(0,st.burn-1);
      st.burnCardIds.pop();
      addRecent(s,`${s.names[p]} extinguished one Burn.`,"#ff9b56")
    }else{
      drawCards(s,p,st.burn);
      addRecent(s,`${s.names[p]} drew ${st.burn} from Burn.`,"#ff6a35");
      st.burn=Math.min(2,st.burn+1);
      normalizeStatusCards(s,p)
    }
  }
  if(st.storm){
    if(playedColor!=="yellow"&&playedColor!=="wild"){
      drawCards(s,p,2);
      addRecent(s,`${s.names[p]} failed Stormcall and drew 2.`,"#ffe35c")
    }
    st.storm=false
  }
  st.frozenCardIds=[]
}
function applySpecialEffect(s,type,p,target,colorChoice,copied=false){
  switch(type){
    case"freeze":
      addRecent(s,`${s.names[p]} froze ${s.names[target]}.`,"#8eeaff");
      setAction(s,"freeze",p,target,null,{copied});
      s.turn=p;
      return;
    case"rewind":
      addRecent(s,`${s.names[p]} rewound the turn.`,"#73eca0");
      setAction(s,"rewind",p,target,null,{copied});
      s.turn=p;
      return;
    case"draw2":
      s.drawStack.amount+=2;s.drawStack.type="draw2";
      addRecent(s,`Draw stack increased to +${s.drawStack.amount}.`,"#ffd968");
      setAction(s,"draw2",p,target,null,{amount:s.drawStack.amount,copied});
      s.turn=target;
      return;
    case"wild4":
      s.drawStack.amount+=4;s.drawStack.type="wild4";
      s.currentColor=colorChoice||chooseBestColor(s.hands[p]);
      addRecent(s,`Chaos stack increased to +${s.drawStack.amount}.`,"#df8cff");
      setAction(s,"wild4",p,target,null,{amount:s.drawStack.amount,copied});
      s.turn=target;
      return;
    case"arsonist":
      s.statuses[target].burn=Math.min(2,s.statuses[target].burn+1);
      normalizeStatusCards(s,target);
      addRecent(s,`${s.names[target]} gained Burn ${s.statuses[target].burn}.`,"#ff6338");
      setAction(s,"arsonist",p,target,null,{burn:s.statuses[target].burn,copied});
      s.turn=target;
      return;
    case"whirlwind":{
      if(s.hands[p].length&&s.hands[target].length){
        const a=Math.floor(Math.random()*s.hands[p].length);
        const b=Math.floor(Math.random()*s.hands[target].length);
        [s.hands[p][a],s.hands[target][b]]=[s.hands[target][b],s.hands[p][a]];
        normalizeStatusCards(s,p);normalizeStatusCards(s,target)
      }
      addRecent(s,`${s.names[p]} and ${s.names[target]} swapped cards.`,"#7ef0c0");
      setAction(s,"whirlwind",p,target,null,{copied});
      s.turn=target;
      return
    }
    case"stormcall":
      s.statuses[target].storm=true;
      addRecent(s,`${s.names[target]} must answer with yellow.`,"#ffe665");
      setAction(s,"stormcall",p,target,null,{copied});
      s.turn=target;
      return;
    case"frostbite":{
      const candidates=s.hands[target].filter(c=>!s.statuses[target].frozenCardIds.includes(c.id));
      if(candidates.length)s.statuses[target].frozenCardIds.push(candidates[Math.floor(Math.random()*candidates.length)].id);
      addRecent(s,`One of ${s.names[target]}'s cards was frost-locked.`,"#9fefff");
      setAction(s,"frostbite",p,target,null,{copied});
      s.turn=target;
      return
    }
    case"cleanse":
      s.statuses[p]={burn:0,burnCardIds:[],frozenCardIds:[],storm:false};
      s.currentColor=colorChoice||chooseBestColor(s.hands[p]);
      addRecent(s,`${s.names[p]} cleansed every status.`,"#aaffc5");
      setAction(s,"cleanse",p,p,null,{copied});
      s.turn=target;
      return;
    case"mirror":{
      const copiedType=s.lastSpecial&&s.lastSpecial!=="mirror"?s.lastSpecial:"freeze";
      addRecent(s,`${s.names[p]} mirrored ${cardNames[copiedType]||copiedType}.`,"#d6c5ff");
      setAction(s,"mirror",p,target,null,{copiedType});
      applySpecialEffect(s,copiedType,p,target,colorChoice,true);
      return
    }
    case"wild":
      s.currentColor=colorChoice||chooseBestColor(s.hands[p]);
      addRecent(s,`${s.names[p]} shifted the color to ${s.currentColor}.`,"#e5a5ff");
      setAction(s,"wild",p,target,null,{color:s.currentColor,copied});
      s.turn=target;
      return
  }
}
function calculateRoundScore(s,winner){
  return s.hands[opponent(winner)].reduce((sum,c)=>sum+cardPoints(c),0)
}
function startChallenge(s,unoPlayer){
  const types=["reaction","timing","memory"];
  s.challenge={
    id:randomId(),
    type:types[Math.floor(Math.random()*types.length)],
    unoPlayer,
    seed:Math.floor(Math.random()*999999),
    results:{},
    startedAt:Date.now(),
    resolved:false
  };
  setAction(s,"challengeStart",unoPlayer,opponent(unoPlayer),null,{challengeType:s.challenge.type})
}
function finishRound(s,winner){
  s.roundWinner=winner;
  const points=calculateRoundScore(s,winner);
  s.scores[winner]+=points;
  if(s.scores[winner]>=s.targetScore)s.winner=winner;
  addRecent(s,`${s.names[winner]} won the round for ${points} points.`,"#ffe06b");
  setAction(s,"roundEnd",winner,opponent(winner),null,{points})
}
function playCard(s,p,cardId,colorChoice=null){
  if(s.turn!==p||s.challenge||s.roundWinner!==null||s.winner!==null)return false;
  const index=s.hands[p].findIndex(c=>c.id===cardId);
  if(index<0)return false;
  const c=s.hands[p][index];
  if(!isPlayable(c,s,p))return false;

  s.hands[p].splice(index,1);
  s.discard.push(c);
  const target=opponent(p);
  const playedColor=c.color==="wild"?(colorChoice||chooseBestColor(s.hands[p])):c.color;
  s.currentColor=playedColor;
  s.drawnCardId=null;

  let nextTurn=target;
  if(c.type==="number"){
    setAction(s,"play",p,target,c);
    nextTurn=target
  }else{
    applySpecialEffect(s,c.type,p,target,colorChoice);
    if(!["wild","cleanse"].includes(c.type))s.lastSpecial=c.type;
    nextTurn=s.turn
  }

  resolveEndStatuses(s,p,playedColor);

  if(s.hands[p].length===0){
    finishRound(s,p);
    s.finalCalled[p]=false;
    return true
  }

  if(s.hands[p].length===1){
    if(s.finalCalled[p]){
      if(s.ruleset==="wild")startChallenge(s,p);
      else setAction(s,"finalSafe",p,target,c)
    }else{
      drawCards(s,p,2);
      addRecent(s,`${s.names[p]} forgot Final Card and drew 2.`,"#ff6f6f");
      setAction(s,"finalMiss",p,target,c)
    }
  }

  s.finalCalled[p]=false;
  if(!s.challenge)s.turn=nextTurn;
  s.turnStartedAt=Date.now();
  normalizeStatusCards(s,p);normalizeStatusCards(s,target);
  return true
}
function drawAction(s,p){
  if(s.turn!==p||s.challenge||s.roundWinner!==null||s.winner!==null)return false;
  if(s.drawStack.amount>0){
    const amount=s.drawStack.amount;
    drawCards(s,p,amount);
    s.drawStack={amount:0,type:null};
    resolveEndStatuses(s,p,null);
    s.turn=opponent(p);
    setAction(s,"takeStack",p,opponent(p),null,{amount});
    addRecent(s,`${s.names[p]} took +${amount}.`,"#ffca66");
    return true
  }
  if(s.drawnCardId)return false;
  refillDeck(s);if(!s.deck.length)return false;
  const c=s.deck.shift();s.hands[p].push(c);s.drawnCardId=c.id;
  setAction(s,"draw",p,p,c);
  addRecent(s,`${s.names[p]} drew a card.`,"#bcd9ff");
  return true
}
function passDrawn(s,p){
  if(s.turn!==p||!s.drawnCardId)return false;
  s.drawnCardId=null;
  resolveEndStatuses(s,p,null);
  s.turn=opponent(p);
  setAction(s,"pass",p,s.turn);
  return true
}
function callFinal(s,p){
  if(s.hands[p].length!==2||s.turn!==p)return false;
  s.finalCalled[p]=true;
  setAction(s,"finalCall",p,opponent(p));
  addRecent(s,`${s.names[p]} called Final Card!`,"#ffdd68");
  return true
}
function submitChallengeResult(s,p,score){
  if(!s.challenge||s.challenge.resolved||s.challenge.results[p]!=null)return false;
  s.challenge.results[p]=score;
  setAction(s,"challengeScore",p,opponent(p),null,{score});
  if(s.challenge.results[0]!=null&&s.challenge.results[1]!=null){
    const a=s.challenge.results[0],b=s.challenge.results[1];
    const winner=a===b?s.challenge.unoPlayer:(a>b?0:1);
    const uno=s.challenge.unoPlayer;
    if(winner!==uno){
      drawCards(s,uno,2);
      addRecent(s,`${s.names[uno]} lost the Final Card challenge and drew 2.`,"#ff7272");
      setAction(s,"challengeLose",uno,winner,null,{scores:[a,b]})
    }else{
      addRecent(s,`${s.names[uno]} survived the Final Card challenge.`,"#71f09b");
      setAction(s,"challengeWin",uno,opponent(uno),null,{scores:[a,b]})
    }
    s.challenge.resolved=true;
    s.challenge=null;
    s.turnStartedAt=Date.now()
  }
  return true
}
function nextRoundState(s){
  const scores=s.winner!==null?[0,0]:s.scores;
  const round=s.winner!==null?1:s.round+1;
  const starter=s.roundWinner==null?0:opponent(s.roundWinner);
  return newGameState(s.names,s.ruleset,s.difficulty,scores,round,starter)
}

function cardLabel(c){
  if(c.type==="number")return String(c.value);
  return{freeze:"❄",rewind:"↻",draw2:"+2",arsonist:"🔥",whirlwind:"🌀",stormcall:"⚡",frostbite:"❄",mirror:"◈",cleanse:"✦",wild:"✦",wild4:"+4"}[c.type]||"?"
}
function faceClass(c){return "face-"+c.type}
function makeCardElement(c,{back=false,playable=false,burn=false,frost=false,delay=0}={}){
  const el=document.createElement(back?"div":"button");
  el.className=`game-card ${back?"card-back":c.color} ${playable?"playable":""} ${burn?"burn-mark":""} ${frost?"frost-mark":""}`;
  el.style.animationDelay=`${delay}ms`;
  if(back)return el;
  const label=cardLabel(c);
  el.innerHTML=`<span class="card-corner">${label}</span><span class="card-corner bottom">${label}</span>`;
  if(c.type==="number")el.append(document.createTextNode(c.value));
  else{
    const face=document.createElement("span");face.className=`card-face ${faceClass(c)}`;face.textContent=["arsonist","rewind","draw2","freeze","frostbite","whirlwind","stormcall","mirror","cleanse","wild","wild4"].includes(c.type)?"":label;
    el.append(face);
    const title=document.createElement("span");title.className="card-title";title.textContent=cardNames[c.type];el.append(title)
  }
  el.dataset.cardId=c.id;
  return el
}
function avatarClass(slot,ai){
  if(ai&&slot===1)return"skeleton";
  return slot===0?"you":"gabby"
}
function setCharacterBase(el,who){
  el.className=`lpc-sprite char-${who} ${el.id==="localCharacter"?"facing-right":"facing-left"}`;
  el.dataset.who=who
}
function animateCharacter(slot,animation="spellcast"){
  const me=mode==="solo"?0:mySlot;
  const el=slot===me?$("#localCharacter"):$("#opponentCharacter");
  if(!el)return;
  const who=el.dataset.who||"you";
  el.style.backgroundImage=`url("assets/characters/${who}/${animation}.png")`;
  el.classList.add("action");
  void el.offsetWidth;
  setTimeout(()=>{
    el.classList.remove("action");
    el.style.backgroundImage=`url("assets/characters/${who}/idle.png")`
  },animation==="hurt"?600:850)
}
function renderStatuses(p,element,fx){
  const st=state.statuses[p],labels=[];
  if(st.burn)labels.push(`BURN ${st.burn}`);
  if(st.storm)labels.push("STORMCALL");
  if(st.frozenCardIds.length)labels.push("FROST-LOCKED");
  element.textContent=labels.length?labels.join(" · "):"Ready";
  fx.className="character-status-fx";
  if(st.burn)fx.classList.add("burning");
  if(state.action?.type==="freeze"&&state.action.target===p)fx.classList.add("frozen")
}
function guideText(me){
  if(!state)return"Loading…";
  if(state.winner!==null)return state.winner===me?"You won the match!":"The opponent won the match.";
  if(state.roundWinner!==null)return state.roundWinner===me?"Round won. Continue when ready.":"Round lost. Prepare for the next one.";
  if(state.challenge)return"Final Card challenge in progress.";
  if(state.turn!==me)return`${state.names[opponent(me)]} is choosing a card…`;
  if(state.drawStack.amount>0){
    const count=state.hands[me].filter(c=>isPlayable(c,state,me)).length;
    return count?`A +${state.drawStack.amount} stack is active. Stack another draw card or take the full pile.`:`No stack card available. Draw ${state.drawStack.amount}.`
  }
  if(state.drawnCardId){
    const c=state.hands[me].find(x=>x.id===state.drawnCardId);
    return c&&isPlayable(c,state,me)?"Your drawn card is playable. Play it or end your turn.":"The drawn card cannot be played. End your turn."
  }
  const legal=state.hands[me].filter(c=>isPlayable(c,state,me)).length;
  if(!legal)return"No legal card. Draw from the highlighted draw pile.";
  if(state.hands[me].length===2&&!state.finalCalled[me])return"Call FINAL CARD before playing down to one card.";
  if(state.statuses[me].storm)return"Stormcall is active. Play yellow or Wild to avoid drawing 2.";
  return`Your turn — ${legal} playable card${legal===1?"":"s"} glowing.`
}
function render(){
  if(!state)return;
  const me=mode==="solo"?0:mySlot,o=opponent(me);
  $("#localName").textContent=state.names[me];$("#opponentName").textContent=state.names[o];
  $("#localCardCount").textContent=state.hands[me].length;$("#opponentCardCount").textContent=state.hands[o].length;
  $("#localScore").textContent=state.scores[me];$("#opponentScore").textContent=state.scores[o];
  $("#roundNumber").textContent=state.round;$("#targetScoreLabel").textContent=state.targetScore;
  $("#roomLabel").textContent=mode==="solo"?`SOLO · ${(state.difficulty||"normal").toUpperCase()}`:`ROOM ${roomId}`;
  $("#turnLabel").textContent=state.challenge?"CHALLENGE":state.roundWinner!==null?"ROUND COMPLETE":state.turn===me?"YOUR TURN":"OPPONENT TURN";
  $("#drawStackValue").textContent=`+${state.drawStack.amount}`;
  $("#guideBanner").textContent=guideText(me);
  $("#finalCardBtn").classList.toggle("called",state.finalCalled[me]);
  $("#finalCardBtn").innerHTML=state.finalCalled[me]?"CALLED!":"FINAL<br>CARD!";

  const myWho=avatarClass(me,state.difficulty),opWho=avatarClass(o,state.difficulty);
  $("#localPortrait").className=`hud-portrait ${myWho}-portrait`;
  $("#opponentPortrait").className=`hud-portrait ${opWho}-portrait`;
  setCharacterBase($("#localCharacter"),myWho);
  setCharacterBase($("#opponentCharacter"),opWho);
  renderStatuses(me,$("#localStatuses"),$("#localStatusFx"));
  renderStatuses(o,$("#opponentStatuses"),$("#opponentStatusFx"));

  $("#discardPile").replaceChildren(makeCardElement({...topCard(state),color:state.currentColor}));
  const oppHand=$("#opponentHand");oppHand.innerHTML="";
  state.hands[o].forEach((_,i)=>oppHand.append(makeCardElement({}, {back:true,delay:i*45})));

  const hand=$("#localHand");hand.innerHTML="";
  state.hands[me].forEach((c,i)=>{
    const playable=isPlayable(c,state,me)&&(state.drawnCardId==null||state.drawnCardId===c.id);
    const el=makeCardElement(c,{
      playable,
      burn:state.statuses[me].burnCardIds.includes(c.id),
      frost:state.statuses[me].frozenCardIds.includes(c.id),
      delay:i*35
    });
    el.addEventListener("click",()=>handleCardClick(c,el));
    hand.append(el)
  });

  const canDraw=state.turn===me&&!state.challenge&&state.roundWinner===null&&state.drawnCardId==null;
  $("#drawPile").disabled=!canDraw;
  $("#drawPile").classList.toggle("playable",canDraw&&(state.drawStack.amount>0||!state.hands[me].some(c=>isPlayable(c,state,me))));
  $("#drawnChoice").classList.toggle("hidden",!(state.turn===me&&state.drawnCardId));

  $("#recentPlays").innerHTML="";
  state.recent.forEach(r=>{
    const e=document.createElement("div");e.className="recent-entry";e.style.color=r.color;e.textContent=r.text;$("#recentPlays").append(e)
  });

  if(state.action?.id>lastRenderedActionId){
    lastRenderedActionId=state.action.id;
    playActionCinematic(state.action)
  }
  if(state.challenge)openChallenge(state.challenge);
  else closeChallenge();
  if(state.roundWinner!==null)openRoundResult();
  updateTimer();
}
function invalidFeedback(el,msg){
  el.classList.remove("invalid");void el.offsetWidth;el.classList.add("invalid");
  playOptional("sfx","invalid");toast(msg)
}
function handleCardClick(c,el){
  const me=mode==="solo"?0:mySlot;
  if(!isPlayable(c,state,me)){invalidFeedback(el,state.turn!==me?"Wait for your turn.":"That card cannot be played now.");return}
  if(c.color==="wild"){pendingWildCardId=c.id;$("#colorModal").classList.remove("hidden");return}
  flyCardToDiscard(el,()=>commit(s=>playCard(s,me,c.id,null)))
}
function flyCardToDiscard(el,done){
  if(settings.reducedMotion){done();return}
  const cloneEl=el.cloneNode(true),from=el.getBoundingClientRect(),to=$("#discardPile").getBoundingClientRect();
  cloneEl.classList.add("card-flight");cloneEl.style.left=from.left+"px";cloneEl.style.top=from.top+"px";cloneEl.style.width=from.width+"px";cloneEl.style.height=from.height+"px";
  document.body.append(cloneEl);el.style.visibility="hidden";
  requestAnimationFrame(()=>{
    cloneEl.style.transform=`translate(${to.left-from.left}px,${to.top-from.top}px) rotate(12deg) scale(.92)`;
    cloneEl.style.opacity=".65"
  });
  setTimeout(()=>{cloneEl.remove();done()},470)
}
$$(".color-choice").forEach(b=>b.addEventListener("click",()=>{
  const id=pendingWildCardId;pendingWildCardId=null;$("#colorModal").classList.add("hidden");
  const me=mode==="solo"?0:mySlot;
  const el=$(`[data-card-id="${id}"]`);
  if(el)flyCardToDiscard(el,()=>commit(s=>playCard(s,me,id,b.dataset.color)));
  else commit(s=>playCard(s,me,id,b.dataset.color))
}));
$("#drawPile").addEventListener("click",()=>{
  const me=mode==="solo"?0:mySlot;
  if(state.turn!==me)return;
  playOptional("sfx","draw");
  commit(s=>drawAction(s,me))
});
$("#playDrawnBtn").addEventListener("click",()=>{
  const me=mode==="solo"?0:mySlot,c=state.hands[me].find(x=>x.id===state.drawnCardId);
  if(!c||!isPlayable(c,state,me)){toast("The drawn card is not playable.");return}
  const el=$(`[data-card-id="${c.id}"]`);
  handleCardClick(c,el)
});
$("#endTurnBtn").addEventListener("click",()=>{const me=mode==="solo"?0:mySlot;commit(s=>passDrawn(s,me))});
$("#finalCardBtn").addEventListener("click",()=>{
  const me=mode==="solo"?0:mySlot;
  commit(s=>callFinal(s,me))
});
$("#emojiBtn").addEventListener("click",()=>{
  const me=mode==="solo"?0:mySlot;animateCharacter(me,"emote");toast("Emote sent!")
});

function spawnParticles(color,count=35){
  const layer=$("#cinematicLayer");
  for(let i=0;i<count;i++){
    const p=document.createElement("i");p.className="particle";p.style.background=color;p.style.left="50%";p.style.top="45%";
    p.style.setProperty("--x",`${(Math.random()-.5)*700}px`);p.style.setProperty("--y",`${(Math.random()-.65)*500}px`);
    layer.append(p);setTimeout(()=>p.remove(),1100)
  }
}
function actionColors(type){
  return{freeze:"#8deaff",frostbite:"#b8f5ff",rewind:"#77efa8",draw2:"#ffd966",wild4:"#c887ff",arsonist:"#ff6438",whirlwind:"#79edbd",stormcall:"#ffe765",mirror:"#d6c4ff",cleanse:"#9dffbd",wild:"#dc8cff"}[type]||"#fff"
}
function actionAnimation(type){
  return{freeze:"spellcast",frostbite:"spellcast",rewind:"emote",draw2:"thrust",wild4:"spellcast",arsonist:"spellcast",whirlwind:"emote",stormcall:"spellcast",mirror:"emote",cleanse:"spellcast",wild:"spellcast",play:"slash"}[type]||"slash"
}
function playActionCinematic(a){
  if(!a||["roundStart","challengeScore","pass"].includes(a.type))return;
  const color=actionColors(a.type);
  if(["draw","takeStack"].includes(a.type)){playOptional("sfx","draw");return}
  if(a.type==="roundEnd"){playOptional("sfx","win");return}
  if(a.type==="finalCall"){playOptional("voices","final");return}
  if(a.type==="challengeStart"){playOptional("sfx","challenge");return}

  const flash=document.createElement("div");flash.className="cinematic-flash";flash.style.background=color+"88";
  const title=document.createElement("div");title.className="cinematic-title";title.style.color=color;title.textContent=cardNames[a.type]||a.type.toUpperCase();
  const runner=document.createElement("div");
  const who=avatarClass(a.actor,state.difficulty);
  runner.className="cinematic-character"+(a.actor===1?" reverse":"");
  runner.style.backgroundImage=`url("assets/characters/${who}/${actionAnimation(a.type)}.png")`;
  $("#cinematicLayer").append(flash,title,runner);
  $("#gameScreen").classList.add("screen-shake");
  spawnParticles(color,42);
  animateCharacter(a.actor,actionAnimation(a.type));
  if(a.target!=null&&["freeze","frostbite","arsonist","draw2","wild4","stormcall"].includes(a.type))animateCharacter(a.target,"hurt");
  playOptional("sfx",a.type==="arsonist"?"fire":a.type==="freeze"||a.type==="frostbite"?"freeze":a.type==="whirlwind"?"wind":a.type==="stormcall"?"lightning":a.type==="draw2"||a.type==="wild4"?"stack":"play");
  playOptional("voices",a.type==="wild4"?"stack":a.type);
  const atmosphere=$("#arenaAtmosphere");atmosphere.style.background=`radial-gradient(circle at center,${color}77,transparent 68%)`;atmosphere.classList.add("active");
  setTimeout(()=>{$("#gameScreen").classList.remove("screen-shake");atmosphere.classList.remove("active");flash.remove();title.remove();runner.remove()},950)
}

function openChallenge(ch){
  if(challengeRuntime?.id===ch.id)return;
  challengeRuntime={id:ch.id,submitted:false,cleanup:null};
  $("#challengeModal").classList.remove("hidden");
  $("#challengeTitle").textContent="FINAL CARD CHALLENGE";
  $("#challengeStatus").textContent="Both players must finish.";
  $("#challengeStage").innerHTML="";
  const seed=ch.seed;
  if(ch.type==="reaction")setupReactionChallenge(seed);
  if(ch.type==="timing")setupTimingChallenge(seed);
  if(ch.type==="memory")setupMemoryChallenge(seed)
}
function closeChallenge(){
  if(challengeRuntime?.cleanup)challengeRuntime.cleanup();
  challengeRuntime=null;$("#challengeModal").classList.add("hidden")
}
function submitLocalChallenge(score){
  if(!challengeRuntime||challengeRuntime.submitted)return;
  challengeRuntime.submitted=true;$("#challengeStatus").textContent=`Score submitted: ${score}. Waiting…`;
  const me=mode==="solo"?0:mySlot;
  commit(s=>submitChallengeResult(s,me,score));
  if(mode==="solo"){
    const difficulty=state.difficulty||"normal";
    const ranges={easy:[300,650],normal:[500,800],hard:[650,920],nightmare:[780,990]};
    const [lo,hi]=ranges[difficulty];const aiScore=Math.floor(lo+Math.random()*(hi-lo));
    setTimeout(()=>commit(s=>submitChallengeResult(s,1,aiScore)),700)
  }
}
function setupReactionChallenge(seed){
  $("#challengeInstructions").textContent="Wait for the rune to light up, then hit it as quickly as possible.";
  const btn=document.createElement("button");btn.className="reaction-target";btn.textContent="WAIT";btn.disabled=true;$("#challengeStage").append(btn);
  const delay=900+(seed%1600),start=performance.now()+delay;
  const timer=setTimeout(()=>{btn.disabled=false;btn.textContent="HIT!";btn.onclick=()=>submitLocalChallenge(Math.max(0,1000-Math.floor(performance.now()-start)))},delay);
  challengeRuntime.cleanup=()=>clearTimeout(timer)
}
function setupTimingChallenge(seed){
  $("#challengeInstructions").textContent="Stop the moving marker inside the green zone.";
  const track=document.createElement("div");track.className="timing-track";track.innerHTML='<div class="timing-zone"></div><div class="timing-marker"></div>';const marker=track.lastElementChild;
  const button=document.createElement("button");button.className="button gold";button.textContent="STOP";$("#challengeStage").append(track,button);
  let active=true,start=performance.now();function frame(t){if(!active)return;const x=(Math.sin((t-start)/420)+1)/2*96;marker.style.left=x+"%";requestAnimationFrame(frame)}requestAnimationFrame(frame);
  button.onclick=()=>{active=false;const x=parseFloat(marker.style.left||"0");const distance=Math.abs(50-x);submitLocalChallenge(Math.max(0,1000-Math.floor(distance*20)))};
  challengeRuntime.cleanup=()=>{active=false}
}
function setupMemoryChallenge(seed){
  $("#challengeInstructions").textContent="Memorize the rune sequence, then repeat it.";
  const runes=["◆","●","▲","✦"],seq=[runes[seed%4],runes[Math.floor(seed/7)%4],runes[Math.floor(seed/19)%4]];
  const display=document.createElement("div");display.className="memory-sequence";display.textContent=seq.join(" ");$("#challengeStage").append(display);
  let input=[],start;
  const timer=setTimeout(()=>{
    display.textContent="";
    const grid=document.createElement("div");grid.className="rune-grid";
    runes.forEach(r=>{const b=document.createElement("button");b.className="rune-button";b.textContent=r;b.onclick=()=>{input.push(r);if(input.length===seq.length){const correct=input.filter((x,i)=>x===seq[i]).length;submitLocalChallenge(correct*300+Math.max(0,100-Math.floor((performance.now()-start)/30)))}};grid.append(b)});
    $("#challengeStage").append(grid);start=performance.now()
  },1800);
  challengeRuntime.cleanup=()=>clearTimeout(timer)
}

function openRoundResult(){
  if(!$("#roundModal").classList.contains("hidden"))return;
  const me=mode==="solo"?0:mySlot;
  const match=state.winner!==null,won=(match?state.winner:state.roundWinner)===me;
  $("#roundResultTitle").textContent=match?(won?"MATCH VICTORY!":"MATCH DEFEAT"):(won?"ROUND WON!":"ROUND LOST");
  $("#roundResultText").textContent=`Score: ${state.scores[me]} – ${state.scores[opponent(me)]}`;
  $("#nextRoundBtn").textContent=match?"REMATCH":"NEXT ROUND";
  $("#roundModal").classList.remove("hidden");
  playOptional("voices",won?"victory":"defeat");playOptional("sfx",won?"win":"lose")
}
$("#nextRoundBtn").addEventListener("click",()=>{
  $("#roundModal").classList.add("hidden");
  if(mode==="online"&&mySlot!==0){toast("Waiting for the host.");return}
  commit(s=>{Object.assign(s,nextRoundState(s));return true})
});
$("#resultMenuBtn").addEventListener("click",leaveGame);

function updateTimer(){
  clearInterval(turnTimerInterval);
  turnTimerInterval=setInterval(()=>{
    if(!state)return;
    const remain=Math.max(0,TURN_SECONDS-Math.floor((Date.now()-state.turnStartedAt)/1000));
    $("#turnTimer").textContent=remain;
    if(remain===0&&!state.challenge&&state.roundWinner===null){
      const me=mode==="solo"?0:mySlot;
      if(state.turn===me)commit(s=>{if(s.drawnCardId)return passDrawn(s,me);drawAction(s,me);return passDrawn(s,me)});
      clearInterval(turnTimerInterval)
    }
  },250)
}
function commit(mutator){
  if(mode==="solo"){
    const s=clone(state);
    const changed=mutator(s);
    if(changed!==false){state=s;render();scheduleAI()}
    return Promise.resolve()
  }
  if(!db||!roomId)return Promise.resolve();
  return db.ref(`rooms/${roomId}/state`).transaction(current=>{
    if(!current)return;
    const s=clone(current);const changed=mutator(s);return changed===false?undefined:s
  })
}

function scheduleAI(){
  clearTimeout(aiTimer);
  if(mode!=="solo"||!state)return;
  if(state.challenge){
    if(state.challenge.results[1]==null){
      const difficulty=state.difficulty||"normal";
      const ranges={easy:[250,620],normal:[480,800],hard:[650,925],nightmare:[800,990]};
      const [lo,hi]=ranges[difficulty];
      aiTimer=setTimeout(()=>commit(s=>submitChallengeResult(s,1,Math.floor(lo+Math.random()*(hi-lo)))),900)
    }
    return
  }
  if(state.turn!==1||state.roundWinner!==null||state.winner!==null)return;
  aiTimer=setTimeout(aiTurn,650+Math.random()*500)
}
function aiCardScore(c,s){
  const difficulty=s.difficulty||"normal";let score=Math.random()*2;
  if(c.type==="wild4")score+=s.hands[0].length<=3?15:7;
  if(c.type==="draw2")score+=s.hands[0].length<=3?12:6;
  if(c.type==="freeze")score+=s.hands[0].length<=3?13:5;
  if(c.type==="arsonist")score+=s.statuses[0].burn<2?9:2;
  if(c.type==="stormcall")score+=7;
  if(c.type==="frostbite")score+=6;
  if(c.type==="cleanse"&&(s.statuses[1].burn||s.statuses[1].storm||s.statuses[1].frozenCardIds.length))score+=14;
  if(c.type==="whirlwind"&&s.hands[1].length<s.hands[0].length)score+=5;
  if(c.color===chooseBestColor(s.hands[1]))score+=3;
  if(difficulty==="easy")score=Math.random()*10;
  if(difficulty==="nightmare"&&SPECIAL_TYPES.has(c.type))score+=4;
  return score
}
function aiTurn(){
  if(mode!=="solo"||state.turn!==1||state.challenge)return;
  const s=clone(state);
  if(s.hands[1].length===2)s.finalCalled[1]=true;
  let options=s.hands[1].filter(c=>isPlayable(c,s,1));
  if(options.length){
    options.sort((a,b)=>aiCardScore(b,s)-aiCardScore(a,s));
    const c=options[0],color=c.color==="wild"?chooseBestColor(s.hands[1]):null;
    playCard(s,1,c.id,color)
  }else{
    drawAction(s,1);
    const drawn=s.hands[1].find(c=>c.id===s.drawnCardId);
    if(drawn&&isPlayable(drawn,s,1))playCard(s,1,drawn.id,drawn.color==="wild"?chooseBestColor(s.hands[1]):null);
    else passDrawn(s,1)
  }
  state=s;render();scheduleAI()
}

function listenRoom(){
  if(roomRef&&roomListener)roomRef.off("value",roomListener);
  roomRef=db.ref(`rooms/${roomId}`);
  roomListener=roomRef.on("value",snap=>{
    const room=snap.val();if(!room)return;
    $("#hostLobbyName").textContent=room.players?.[0]?.name||"Host";
    $("#guestLobbyName").textContent=room.players?.[1]?.name||"Waiting…";
    $("#guestLobbyCard").classList.toggle("ready",!!room.players?.[1]);
    $("#guestLobbyStatus").textContent=room.players?.[1]?"READY":"NOT JOINED";
    if(mySlot===0&&room.players?.[1]&&!room.state){
      db.ref(`rooms/${roomId}/state`).set(newGameState([room.players[0].name,room.players[1].name],room.ruleset||"wild",null,[0,0],1,Math.random()<.5?0:1))
    }
    if(room.state){mode="online";state=room.state;showScreen("game");render()}
  });
  const presence=db.ref(`rooms/${roomId}/presence/${mySlot}`);
  presence.set(Date.now());presence.onDisconnect().remove();
  clearInterval(presenceTimer);presenceTimer=setInterval(()=>presence.set(Date.now()),5000)
}
async function createRoom(){
  if(!db)throw new Error("Firebase did not load.");
  roomId=roomCode();mySlot=0;mode="online";
  const name=$("#onlineName").value.trim()||"Player 1",ruleset=$("#onlineRuleset").value;
  await db.ref(`rooms/${roomId}`).set({players:{0:{name}},ruleset,created:Date.now()});
  $("#lobbyCode").textContent=roomId;showScreen("lobby");listenRoom()
}
async function joinRoom(){
  if(!db)throw new Error("Firebase did not load.");
  const code=$("#roomCodeInput").value.trim().toUpperCase();if(!code)throw new Error("Enter a room code.");
  const snap=await db.ref(`rooms/${code}`).once("value");if(!snap.exists())throw new Error("Room not found.");
  const room=snap.val();if(room.players?.[1])throw new Error("Room is full.");
  roomId=code;mySlot=1;mode="online";
  await db.ref(`rooms/${code}/players/1`).set({name:$("#onlineName").value.trim()||"Player 2"});
  $("#lobbyCode").textContent=roomId;showScreen("lobby");listenRoom()
}
async function quickMatch(){
  if(!db)throw new Error("Firebase did not load.");
  const name=$("#onlineName").value.trim()||"Player",ruleset=$("#onlineRuleset").value;
  $("#menuStatus").textContent="Searching…";
  const q=db.ref(`matchmaking/${ruleset}`);
  const snap=await q.once("value"),waiting=snap.val();
  if(waiting&&Date.now()-waiting.created<60000){
    roomId=waiting.roomId;mySlot=1;mode="online";
    await db.ref(`rooms/${roomId}/players/1`).set({name});
    await q.remove();$("#lobbyCode").textContent=roomId;showScreen("lobby");listenRoom()
  }else{
    roomId=roomCode();mySlot=0;mode="online";
    await db.ref(`rooms/${roomId}`).set({players:{0:{name}},ruleset,created:Date.now()});
    await q.set({roomId,name,created:Date.now()});
    $("#lobbyCode").textContent=roomId;showScreen("lobby");listenRoom()
  }
}
function leaveGame(){
  clearTimeout(aiTimer);clearInterval(turnTimerInterval);clearInterval(presenceTimer);
  if(roomRef&&roomListener)roomRef.off("value",roomListener);
  if(mode==="online"&&db&&roomId)db.ref(`rooms/${roomId}/presence/${mySlot}`).remove();
  mode="menu";roomId=null;state=null;$("#roundModal").classList.add("hidden");closeChallenge();showScreen("menu")
}

$("#createRoomBtn").addEventListener("click",()=>createRoom().catch(e=>$("#menuStatus").textContent=e.message));
$("#joinRoomBtn").addEventListener("click",()=>joinRoom().catch(e=>$("#menuStatus").textContent=e.message));
$("#quickMatchBtn").addEventListener("click",()=>quickMatch().catch(e=>$("#menuStatus").textContent=e.message));
$("#startSoloBtn").addEventListener("click",()=>{
  mode="solo";mySlot=0;roomId=null;
  state=newGameState([$("#soloName").value.trim()||"Cole","Skeleton AI"],$("#soloRuleset").value,$("#difficultySelect").value,[0,0],1,Math.random()<.5?0:1);
  showScreen("game");render();scheduleAI()
});
$("#copyInviteBtn").addEventListener("click",()=>{
  const u=new URL(location.href);u.searchParams.set("room",roomId);
  navigator.clipboard.writeText(u.href).then(()=>{$("#lobbyMessage").textContent="Invite copied. Send it to your opponent."})
});
$("#leaveLobbyBtn").addEventListener("click",leaveGame);
$("#quitGameBtn").addEventListener("click",leaveGame);

$$(".tab").forEach(tab=>tab.addEventListener("click",()=>{
  $$(".tab").forEach(t=>t.classList.remove("active"));$$(".tab-pane").forEach(p=>p.classList.remove("active"));
  tab.classList.add("active");$(`[data-pane="${tab.dataset.tab}"]`).classList.add("active")
}));
$("#openSettingsBtn").addEventListener("click",()=>$("#settingsModal").classList.remove("hidden"));
$("#gameSettingsBtn").addEventListener("click",()=>$("#settingsModal").classList.remove("hidden"));
$("#openCreditsBtn").addEventListener("click",()=>$("#creditsModal").classList.remove("hidden"));
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).classList.add("hidden")));

$("#musicEnabled").checked=settings.music;$("#sfxEnabled").checked=settings.sfx;$("#voiceEnabled").checked=settings.voice;$("#reducedMotion").checked=settings.reducedMotion;$("#musicVolume").value=settings.musicVolume;$("#sfxVolume").value=settings.sfxVolume;
$("#musicEnabled").addEventListener("change",e=>{settings.music=e.target.checked;saveSettings();settings.music?playMusic(mode==="menu"?"menu":"battle"):stopMusic()});
$("#sfxEnabled").addEventListener("change",e=>{settings.sfx=e.target.checked;saveSettings()});
$("#voiceEnabled").addEventListener("change",e=>{settings.voice=e.target.checked;saveSettings()});
$("#reducedMotion").addEventListener("change",e=>{settings.reducedMotion=e.target.checked;saveSettings();document.documentElement.classList.toggle("reduce-motion",settings.reducedMotion)});
$("#musicVolume").addEventListener("input",e=>{settings.musicVolume=+e.target.value;if(currentMusic)currentMusic.volume=settings.musicVolume;saveSettings()});
$("#sfxVolume").addEventListener("input",e=>{settings.sfxVolume=+e.target.value;saveSettings()});

const invite=new URLSearchParams(location.search).get("room");
if(invite){$("#roomCodeInput").value=invite.toUpperCase();$("#menuStatus").textContent="Enter your name, then join the room."}
if(new URLSearchParams(location.search).get("autostart")==="solo"){
  window.addEventListener("load",()=>setTimeout(()=>$("#startSoloBtn").click(),700))
}

})();