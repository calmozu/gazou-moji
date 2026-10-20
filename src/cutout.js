import {personMask} from './person-mask.js';
import {cutoutPixels} from './cutout-pixels.js';

let worker,nextJob=0;
const jobs=new Map();
function processPixels(data){
 if(typeof Worker==='undefined')return Promise.resolve(cutoutPixels(data));
 if(!worker){worker=new Worker(new URL('./cutout-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data.pixels);};worker.onerror=()=>{for(const job of jobs.values())job.reject(new Error('切り抜きに失敗しました。もう一度お試しください。'));jobs.clear();worker.terminate();worker=null;};}
 return new Promise((resolve,reject)=>{const id=++nextJob;jobs.set(id,{resolve,reject});worker.postMessage({...data,id},[data.pixels.buffer]);});
}
const defaults={mode:'color',color:'#ffffff',tolerance:15,feather:1,connected:false,strength:50};

export function createCutoutDialog({decodeImage}){
 const dialog=document.createElement('dialog');dialog.id='cutout-dialog';dialog.setAttribute('aria-labelledby','cutout-title');
 dialog.innerHTML=`<div class="dialog-top"><h2 id="cutout-title">背景を切り抜く</h2><button id="cutout-close" aria-label="切り抜きを閉じる">×</button></div>
 <div class="cutout-layout"><div><div class="segmented"><button id="cutout-color-mode" aria-pressed="true">ロゴ・イラスト</button><button id="cutout-person-mode" aria-pressed="false">人物（自動）</button></div>
 <div id="cutout-color-controls"><label class="field" style="margin-top:16px"><span class="label">消す背景色</span><div class="row"><input id="cutout-color" class="color-input" type="color" value="#ffffff"><button id="cutout-pick" aria-pressed="false">画像から色を拾う</button></div></label>
 <label class="range-label" for="cutout-tolerance"><span>消す色の範囲</span><output id="cutout-tolerance-value"></output></label><input id="cutout-tolerance" type="range" min="0" max="100" value="15">
 <label class="check"><input id="cutout-connected" type="checkbox">画像の端につながる色だけ消す</label><p class="hint">文字やロゴの内側も透かす場合は、チェックを外してください。</p></div>
 <div id="cutout-person-controls" hidden><p class="hint">人物を自動で残します。画像は外部へ送信しません。初回だけ判別用データを読み込みます。</p><label class="range-label" for="cutout-strength"><span>切り抜きの強さ</span><output id="cutout-strength-value"></output></label><input id="cutout-strength" type="range" min="0" max="100" value="50"><p class="hint">髪の毛・半透明な部分・複雑な背景は、きれいに抜けない場合があります。</p></div>
 <label class="range-label" for="cutout-feather"><span>輪郭のぼかし</span><output id="cutout-feather-value"></output></label><input id="cutout-feather" type="range" min="0" max="10" value="1">
 <label class="check"><input id="cutout-original" type="checkbox">元画像と比較する</label><p class="hint">スライダーを動かすたびに元画像から調整します。適用後も元画像に戻せます。</p></div>
 <div><div class="cutout-preview"><canvas id="cutout-preview" aria-label="切り抜きプレビュー"></canvas></div><p class="hint">市松模様の部分は透明です。</p><p id="cutout-status" role="status" aria-live="polite"></p></div></div>
 <div class="export-options"><button id="cutout-cancel">キャンセル</button><button id="cutout-apply" class="primary" disabled>この切り抜きを適用</button></div>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#cutout-'+id),canvas=$('preview');let session=null,generation=0,timer;
 const maskCache=new Map();
 function finish(value){generation++;clearTimeout(timer);const old=session;session=null;dialog.close();old?.resolve(value);}
 $('close').onclick=$('cancel').onclick=()=>finish(null);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});
 dialog.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase()))e.stopPropagation();});
 function sync(){const s=session.settings;for(const key of ['color','tolerance','strength','feather'])$(key).value=s[key];$('connected').checked=s.connected;for(const key of ['tolerance','strength','feather'])$(key+'-value').textContent=s[key]+(key==='feather'?' px':'%');$('color-controls').hidden=s.mode!=='color';$('person-controls').hidden=s.mode!=='person';for(const mode of ['color','person']){$(mode+'-mode').classList.toggle('active',mode===s.mode);$(mode+'-mode').setAttribute('aria-pressed',String(mode===s.mode));}if(s.mode==='person'){session.picking=false;$('pick').setAttribute('aria-pressed','false');canvas.style.cursor='';}}
 async function result(image,settings,maxEdge){
  let person;if(settings.mode==='person'){
   const key=session.src;let pending=maskCache.get(key);if(!pending){pending=personMask(image);maskCache.set(key,pending);if(maskCache.size>3)maskCache.delete(maskCache.keys().next().value);pending.catch(()=>maskCache.delete(key));}person=await pending;
  }
  const ratio=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight)),out=document.createElement('canvas');out.width=Math.max(1,Math.round(image.naturalWidth*ratio));out.height=Math.max(1,Math.round(image.naturalHeight*ratio));const ctx=out.getContext('2d');ctx.drawImage(image,0,0,out.width,out.height);const data=ctx.getImageData(0,0,out.width,out.height);
  const pixels=await processPixels({width:out.width,height:out.height,pixels:data.data,settings:{...settings,feather:settings.feather*ratio},person});ctx.putImageData(new ImageData(pixels,out.width,out.height),0,0);return out;
 }
 function draw(){if(!session)return;const source=$('original').checked?session.original:session.preview;if(!source)return;canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);}
 function schedule(){const token=++generation;clearTimeout(timer);$('apply').disabled=true;$('status').textContent=session.settings.mode==='person'?'人物を判別しています…':'プレビューを更新しています…';timer=setTimeout(async()=>{const current=session;if(!current?.image)return;try{const preview=await result(current.image,{...current.settings},768);if(session!==current||token!==generation)return;current.preview=preview;draw();$('status').textContent='プレビューを確認してから適用してください。';$('apply').disabled=false;}catch(error){if(session===current&&token===generation)$('status').textContent=error.message;}},80);}
 for(const key of ['color','tolerance','strength','feather','connected'])$(key).addEventListener(key==='connected'?'change':'input',()=>{if(!session)return;session.settings[key]=key==='connected'?$(key).checked:key==='color'?$(key).value:Number($(key).value);sync();schedule();});
 for(const mode of ['color','person'])$(mode+'-mode').onclick=()=>{if(!session)return;session.settings.mode=mode;sync();schedule();};
 $('original').onchange=draw;
 $('pick').onclick=()=>{if(!session)return;session.picking=!session.picking;$('pick').setAttribute('aria-pressed',String(session.picking));canvas.style.cursor=session.picking?'crosshair':'';$('status').textContent=session.picking?'プレビューで消したい背景色をクリックしてください。':'';};
 canvas.onclick=e=>{if(!session?.picking||!session.original)return;const rect=canvas.getBoundingClientRect(),source=session.original,x=Math.max(0,Math.min(source.width-1,Math.floor((e.clientX-rect.left)/rect.width*source.width))),y=Math.max(0,Math.min(source.height-1,Math.floor((e.clientY-rect.top)/rect.height*source.height))),rgba=source.getContext('2d').getImageData(x,y,1,1).data;if(!rgba[3]){$('status').textContent='すでに透明な部分です。色のある背景を選んでください。';return;}session.settings.color='#'+[...rgba.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join('');session.picking=false;$('pick').setAttribute('aria-pressed','false');canvas.style.cursor='';sync();schedule();};
 $('apply').onclick=async()=>{const current=session;if(!current||$('apply').disabled)return;const token=++generation;$('apply').disabled=true;$('status').textContent='切り抜きを仕上げています…';const settings={...current.settings};try{const out=await result(current.image,settings,2048);if(session!==current||token!==generation)return;finish({src:out.toDataURL('image/png'),settings});}catch(error){if(session===current){$('status').textContent=error.message;$('apply').disabled=false;}}};
 return async function open(src,saved){
  if(session)finish(null);
  return new Promise(resolve=>{const current={src,settings:{...defaults,...saved},resolve,picking:false};session=current;canvas.width=1;canvas.height=1;$('original').checked=false;$('apply').disabled=true;$('status').textContent='画像を読み込んでいます…';dialog.showModal();sync();
   decodeImage(src).then(image=>{if(session!==current)return;current.image=image;const original=document.createElement('canvas');original.width=image.naturalWidth;original.height=image.naturalHeight;original.getContext('2d').drawImage(image,0,0);current.original=original;
    if(!saved){const ctx=original.getContext('2d'),colors=[[0,0],[original.width-1,0],[0,original.height-1],[original.width-1,original.height-1]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]).filter(c=>c[3]>200);if(colors.length)current.settings.color='#'+[0,1,2].map(i=>colors.map(c=>c[i]).sort((a,b)=>a-b)[Math.floor(colors.length/2)].toString(16).padStart(2,'0')).join('');}
    sync();schedule();
   }).catch(error=>{if(session===current)$('status').textContent=error.message;});
  });
 };
}
