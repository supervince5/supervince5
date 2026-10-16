'use strict';
const canvas=document.querySelector('#tiles'),ctx=canvas.getContext('2d'),keyBox=document.querySelector('#keys');
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
// Transcribed from the user-supplied Sprouty violin arrangement, measures 1–9.
// Concert pitch; A-major key signature. E-sharp in m3, F-natural in m5/m9.
const measures=[
 [[73,.5],[null,.5]],
 [[57,.5],[59,.5],[61,.5],[62,.5],[64,.5],[66,.5],[68,.5],[69,.5]],
 [[65,.5],[66,.5],[68,.5],[69,.5],[73,.5],[71,.5],[69,.5],[68,.5]],
 [[66,1],[73,1],[71,1],[69,1]],
 [[65,1],[73,1],[71,1],[69,1]],
 [[73,.5],[74,.5],[76,.5],[78,.5],[80,.5],[81,.5],[83,.5],[85,.5]],
 [[80,.5],[81,.5],[83,.5],[85,.5],[88,.5],[86,.5],[85,.5],[83,.5]],
 [[81,1],[88,1],[86,1],[85,1]],
 [[89,1],[88,1],[86,1],[88,1]]
];
const baseMidi=57,keyCount=37,whiteTotal=22;
const melody=measures.flatMap((bar,m)=>bar.filter(n=>n[0]!==null).map(([midi,beats])=>({i:midi-baseMidi,beats,measure:m+1})));
const used=[...new Set(melody.map(n=>n.i))].sort((a,b)=>a-b);
const letters=[...'asdfghjklqwertyuiopzxcvbnm'];
const bindings=Array(keyCount).fill('');used.forEach((i,n)=>bindings[i]=letters[n]);
const spare=[...letters.slice(used.length),...'1234567890[];'];let spareIndex=0;bindings.forEach((v,i)=>{if(!v)bindings[i]=spare[spareIndex++]});
let practice=false,cursor=0,attempts=0,correct=0,listening=false,timers=[];
const keys=[],waves=[],voices=new Map(),sources=new Map(); let audio,master,compressor,sustain=false,space=false,demoTimer=null,demoStep=0,width=1000,height=300;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let whiteCount=0;
for(let i=0;i<keyCount;i++){const black=[1,3,6,8,10].includes((i+baseMidi)%12),key=document.createElement('button'),name=names[(i+baseMidi)%12]+(Math.floor((i+baseMidi)/12)-1);key.type='button';key.className='key '+(black?'black':'white');key.style.setProperty('--hue',String((i*19+245)%360));key.setAttribute('aria-label',name+', keyboard '+bindings[i]);key.dataset.note=String(i);key.innerHTML='<span class=key-binding>'+bindings[i]+'</span>';if(black)key.style.left=(whiteCount/whiteTotal*100-1.35)+'%';else whiteCount++;keyBox.append(key);keys.push(key);key.addEventListener('pointerdown',e=>{e.preventDefault();key.setPointerCapture(e.pointerId);playInput(i,'p'+e.pointerId)});key.addEventListener('pointerup',e=>release('p'+e.pointerId));key.addEventListener('pointercancel',e=>release('p'+e.pointerId));key.addEventListener('lostpointercapture',e=>release('p'+e.pointerId));key.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!e.repeat)playInput(i,'enter')}});key.addEventListener('keyup',e=>{if(e.key==='Enter')release('enter')});}
function initAudio(){if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=.19;compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=5;master.connect(compressor);compressor.connect(audio.destination);}if(audio.state==='suspended')audio.resume();}
function sound(i){initAudio();const t=audio.currentTime,freq=220*Math.pow(2,i/12),envelope=audio.createGain();envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(.65,t+.008);envelope.gain.exponentialRampToValueAtTime(.18,t+.35);envelope.gain.exponentialRampToValueAtTime(.001,t+4);envelope.connect(master);const oscs=[];for(const [ratio,level] of [[1,1],[2,.38],[3,.12],[4,.045]]){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq*ratio;o.detune.value=ratio===1?0:1.5;g.gain.value=level;o.connect(g);g.connect(envelope);o.start(t);o.stop(t+5);oscs.push(o);}const voice={envelope,oscs,ended:false};setTimeout(()=>{envelope.disconnect();for(const o of oscs)o.disconnect();if(voices.get(i)===voice)voices.delete(i)},5200);return voice;}
function endVoice(i){const voice=voices.get(i);if(!voice||voice.ended)return;voice.ended=true;const t=audio.currentTime;voice.envelope.gain.cancelAndHoldAtTime(t);voice.envelope.gain.setTargetAtTime(.0001,t,.12);}
function press(i,source){if(sources.has(source))return;sources.set(source,i);if(voices.has(i))endVoice(i);voices.set(i,sound(i));keys[i].classList.add('active');const r=keys[i].getBoundingClientRect(),b=canvas.getBoundingClientRect();waves.push({x:(r.left+r.width/2-b.left)/b.width*width,y:height+10,start:performance.now(),hue:(i*19+245)%360});if(waves.length>36)waves.shift();}
function release(source){const i=sources.get(source);if(i===undefined)return;sources.delete(source);if(![...sources.values()].includes(i)){keys[i].classList.remove('active');if(!sustain&&!space)endVoice(i);}}
function releaseSustain(){if(!sustain&&!space)for(const i of voices.keys())if(![...sources.values()].includes(i))endVoice(i);}
window.addEventListener('keydown',e=>{if(e.target.matches('input')||((e.key==='Enter'||e.code==='Space')&&e.target.tagName==='BUTTON')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();space=true;return}const i=bindings.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();if(!e.repeat)playInput(i,'k'+e.code)}});
window.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;releaseSustain()}release('k'+e.code)});
window.addEventListener('blur',()=>{stopListen();space=false;for(const s of [...sources.keys()])release(s);for(const i of voices.keys())endVoice(i)});
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0)}new ResizeObserver(resize).observe(canvas);resize();
function draw(now){ctx.fillStyle='#080808';ctx.fillRect(0,0,width,height);const cell=width<600?20:24,gap=4,cols=Math.floor((width-12+gap)/cell),rows=Math.floor((height-14+gap)/cell),left=(width-(cols*cell-gap))/2,top=(height-(rows*cell-gap))/2;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const x=left+col*cell,y=top+row*cell;let power=0,hue=250;for(const w of waves){const age=(now-w.start)/1000;if(age>2.6)continue;const distance=Math.hypot(x-w.x,(y-w.y)*1.05),radius=age*300;const p=Math.exp(-Math.pow((distance-radius)/40,2))*Math.max(0,1-age/2.6);if(p>power){power=p;hue=(w.hue+distance*.33)%360}}if(reduced)power*=.25;const idle=.025+.018*Math.sin(x*.01+y*.02);ctx.fillStyle=`hsl(${hue} ${Math.min(85,power*150)}% ${12+idle*20+power*45}%)`;ctx.shadowBlur=power> .1?power*17:0;ctx.shadowColor=`hsla(${hue},95%,65%,${power})`;ctx.beginPath();ctx.roundRect(x,y,cell-gap,cell-gap,3);ctx.fill();ctx.shadowBlur=0;if(power>.18){ctx.strokeStyle=`hsla(${hue},95%,85%,${power*.65})`;ctx.lineWidth=.7;ctx.stroke();}}while(waves.length&&now-waves[0].start>2800)waves.shift();requestAnimationFrame(draw)}requestAnimationFrame(draw);

const prompt=document.querySelector('#prompt'),feedback=document.querySelector('#feedback');
function renderLesson(){
 prompt.replaceChildren();for(let m=1;m<=9;m++){const bar=document.createElement('div');bar.className='measure';bar.setAttribute('aria-label','Measure '+m);for(let n=0;n<melody.length;n++){const item=melody[n];if(item.measure!==m)continue;const char=document.createElement('span');char.className='letter '+(n<cursor?'done':n===cursor?'current':'');char.textContent=bindings[item.i];char.title='Measure '+m+' · '+names[(item.i+baseMidi)%12]+(Math.floor((item.i+baseMidi)/12)-1);bar.append(char)}prompt.append(bar)}
 document.querySelector('#progress').textContent=cursor+' / '+melody.length;
 document.querySelector('#accuracy').textContent=(attempts?Math.round(correct/attempts*100):100)+'% accuracy';
 keys.forEach((key,i)=>key.classList.toggle('next',practice&&!listening&&cursor<melody.length&&melody[cursor].i===i));
 document.body.classList.toggle('practicing',practice);
}
function playInput(i,source){
 if(listening)return;
 if(practice){if(cursor>=melody.length)return;attempts++;
 if(i!==melody[cursor].i){feedback.textContent='try '+bindings[melody[cursor].i];prompt.classList.remove('miss');void prompt.offsetWidth;prompt.classList.add('miss');renderLesson();return}
 correct++;cursor++;feedback.textContent=cursor===melody.length?'complete · restart to play again':'measure '+melody[Math.min(cursor,melody.length-1)].measure+' / 9';renderLesson();}
 press(i,source);
}
function stopListen(){timers.forEach(clearTimeout);timers=[];listening=false;document.querySelector('#listen').textContent='listen';document.querySelector('#listen').setAttribute('aria-pressed','false');for(const source of [...sources.keys()])if(source.startsWith('listen'))release(source);renderLesson()}
document.querySelector('#restart').onclick=()=>{stopListen();for(const source of [...sources.keys()])release(source);cursor=attempts=correct=0;feedback.textContent='type the highlighted letter';renderLesson();prompt.focus()};
document.querySelector('#practice-toggle').onclick=()=>{stopListen();practice=!practice;document.querySelector('#practice-toggle').setAttribute('aria-pressed',String(practice));document.querySelector('#practice-toggle').textContent=practice?'back to free play':'play love.';document.querySelector('#lesson').hidden=!practice;renderLesson()};
document.querySelector('#listen').onclick=()=>{if(listening){stopListen();return}initAudio();listening=true;document.querySelector('#listen').textContent='stop';document.querySelector('#listen').setAttribute('aria-pressed','true');feedback.textContent='listening · 68 bpm';let beat=0,step=0;for(const bar of measures)for(const [midi,duration] of bar){if(midi!==null){const id='listen'+step++,at=beat*60000/68;timers.push(setTimeout(()=>press(midi-baseMidi,id),at));timers.push(setTimeout(()=>release(id),at+duration*60000/68*.9))}beat+=duration}timers.push(setTimeout(()=>{stopListen();feedback.textContent='type the highlighted letter'},beat*60000/68));renderLesson()};
renderLesson();
