import { dimensions, imageBounds } from './render.js';

export const overlayPanel=`
<div id="panel-overlay" class="panel" role="tabpanel" aria-labelledby="tab-overlay" hidden>
 <div class="section"><p class="eyebrow">IMAGES</p><h2>画像を、自由に重ねる。</h2>
  <button id="add-overlay" class="upload">＋ PNG・画像を追加</button>
  <input id="overlay-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
  <p class="hint">透明なPNGのロゴやイラストも、そのまま重ねられます。最大12枚。画像はこのブラウザー内で処理します。</p>
  <label id="overlay-select-field" class="field" hidden><span class="label">編集する画像</span><select id="overlay-select"></select></label>
 </div>
 <div id="overlay-controls" hidden>
  <div class="section"><h2>位置と大きさ</h2><p class="hint" id="overlay-help">用紙上の青い枠をドラッグして移動。四隅の丸で縦横比を保って大きさを変えられます。</p>
   <div class="margin-grid" style="margin-top:14px">${[['x','左から'],['y','上から'],['width','幅'],['height','高さ']].map(([key,label])=>`<label class="field"><span class="label">${label}</span><div class="number-unit"><input id="overlay-${key}" data-overlay-value="${key}" type="number" min="0" step="0.1"><span data-layout-unit>mm</span></div></label>`).join('')}</div>
   <p class="hint">幅・高さは連動します。</p><button id="center-overlay">用紙の中央へ</button>
  </div>
  <div class="section"><h2>重なり方</h2>
   <label class="range-label" for="overlay-opacity"><span>不透明度</span><output id="overlay-opacity-value">100%</output></label><input id="overlay-opacity" type="range" min="0" max="100" value="100">
   <label class="field"><span class="label">文字との重なり</span><select id="overlay-placement"><option value="front">文字の手前</option><option value="back">文字の奥</option></select></label>
   <div class="row"><button id="overlay-backward">画像の奥へ</button><button id="overlay-forward">画像の手前へ</button></div><p class="hint">同じ「文字との重なり」の画像同士で、下の画像ほど手前になります。</p>
  </div>
  <button id="delete-overlay" class="quiet overlay-delete">この画像を削除</button><p class="hint">削除や移動は「元に戻す」で取り消せます。</p>
 </div>
</div>`;

export function createOverlayEditor({getState,getImages,getTab,remember,changed,toast,readDataURL,decodeImage,layoutFactor}){
 const $=id=>document.getElementById(id),host=document.createElement('div');host.id='image-frames';$('paper-wrap').append(host);
 let selectedId=null,gesture=null,listKey='',loading=false;
 const items=()=>getState().overlays || [],active=()=>items().find(item=>item.id===selectedId);
 function commit(fn){remember();fn();changed();}
 function select(id){selectedId=id;sync();}
 function sync(){
  if(!active())selectedId=items().at(-1)?.id||null;
  const selected=active(),state=getState(),factor=layoutFactor(),[w,h]=dimensions(state);
  $('overlay-controls').hidden=!selected;$('overlay-select-field').hidden=!selected;host.hidden=getTab()!=='overlay';$('add-overlay').disabled=loading||items().length>=12;
  const key=JSON.stringify(items().map(item=>[item.id,item.name]));
  if(key!==listKey){$('overlay-select').replaceChildren(...items().map((item,i)=>{const option=document.createElement('option');option.value=item.id;option.textContent=`${i+1}. ${item.name}`;return option;}));listKey=key;}
  $('overlay-select').value=selectedId||'';
  for(const frame of [...host.children])if(!items().some(item=>item.id===frame.dataset.id))frame.remove();
  items().forEach((item,i)=>{
   let frame=[...host.children].find(el=>el.dataset.id===item.id);
   if(!frame){frame=document.createElement('div');frame.className='text-box overlay-frame';frame.dataset.id=item.id;frame.id='image-layer-'+item.id;frame.tabIndex=0;frame.setAttribute('role','group');frame.setAttribute('aria-describedby','overlay-help');
    const caption=document.createElement('span');caption.className='text-box-caption';caption.setAttribute('aria-hidden','true');frame.append(caption);
    for(const [corner,label] of [['nw','左上'],['ne','右上'],['sw','左下'],['se','右下']]){const handle=document.createElement('button');handle.className='box-handle '+corner;handle.dataset.imageResize=corner;handle.setAttribute('aria-label','画像の'+label+'を調整');frame.append(handle);}
    frame.addEventListener('pointerdown',e=>start(e,frame));frame.addEventListener('pointermove',move);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(name,e=>{if(gesture?.pointer===e.pointerId)gesture=null;});
    frame.addEventListener('keydown',e=>{
     if(getTab()!=='overlay')return;
     if(e.key==='Enter'||e.key===' '){e.preventDefault();select(frame.dataset.id);return;}
     if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
     e.preventDefault();select(frame.dataset.id);const item=active(),delta=(e.shiftKey?5:1)/layoutFactor();
     commit(()=>Object.assign(item,imageBounds(getState(),{...item,x:item.x+(e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0),y:item.y+(e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0)})));
    });host.append(frame);
   }
   const b=imageBounds(state,item),isSelected=item.id===selectedId;
   frame.classList.toggle('selected',isSelected);frame.setAttribute('aria-label',`画像 ${i+1}：${item.name}`);
   Object.assign(frame.style,{left:`${b.x/w*100}%`,top:`${b.y/h*100}%`,width:`${b.width/w*100}%`,height:`${b.height/h*100}%`,zIndex:isSelected?items().length+1:i+1});
   frame.querySelector('.text-box-caption').textContent=`画像${i+1} · ${item.name}`;
   frame.querySelectorAll('button').forEach(button=>button.hidden=!isSelected);
  });
  if(!selected)return;
  for(const key of ['x','y','width','height']){const el=$('overlay-'+key);el.value=+(selected[key]*factor).toFixed(1);el.min=key==='x'||key==='y'?0:.1;el.max=+((key==='x'?w-selected.width:key==='y'?h-selected.height:key==='width'?Math.min(w,h*selected.width/selected.height):Math.min(h,w*selected.height/selected.width))*factor).toFixed(1);}
  $('overlay-opacity').value=selected.opacity;$('overlay-opacity-value').value=selected.opacity+'%';$('overlay-placement').value=selected.placement;
  const index=items().indexOf(selected);$('overlay-backward').disabled=index===0;$('overlay-forward').disabled=index===items().length-1;
 }
 $('overlay-select').onchange=e=>select(e.target.value);
 $('add-overlay').onclick=()=>$('overlay-file').click();
 $('overlay-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('PNG・JPEG・WebP形式の画像を選んでください。');return;}
  if(file.size>40000000){toast('画像が大きすぎます。40 MB以下の画像を選んでください。');return;}
  const state=getState();if(items().length>=12)return;
  loading=true;$('add-overlay').disabled=true;
  try{
   const original=await decodeImage(await readDataURL(file)),ratio=Math.min(1,2048/Math.max(original.naturalWidth,original.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(original.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(original.naturalHeight*ratio));canvas.getContext('2d').drawImage(original,0,0,canvas.width,canvas.height);
   const src=canvas.toDataURL('image/png');
   if(src.length>12000000||items().reduce((sum,item)=>sum+item.src.length,0)+src.length>30000000)throw new Error('画像が大きすぎます。小さな画像を選ぶか、不要な画像を削除してください。');
   const image=await decodeImage(src);if(getState()!==state)return;
   const [w,h]=dimensions(state),scale=Math.min(w*.5/image.naturalWidth,h*.5/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
   const item={id:crypto.randomUUID(),name:file.name.slice(0,150),src,x:(w-width)/2,y:(h-height)/2,width,height,opacity:100,placement:'front'};
   Object.assign(item,imageBounds(state,item));remember();state.overlays ||= [];state.overlays.push(item);getImages().set(src,image);selectedId=item.id;changed();
  }catch(error){toast(error.message);}finally{loading=false;sync();}
 };
 document.querySelectorAll('[data-overlay-value]').forEach(el=>el.onchange=()=>{
  const item=active(),value=Number(el.value)/layoutFactor(),key=el.dataset.overlayValue;
  if(!item||el.value===''||!Number.isFinite(value)||value<0||(['width','height'].includes(key)&&value<=0)){sync();return;}
  const next={...item,[key]:value};
  if(key==='width')next.height=value*item.height/item.width;if(key==='height')next.width=value*item.width/item.height;
  commit(()=>Object.assign(item,imageBounds(getState(),next)));
 });
 $('center-overlay').onclick=()=>{const item=active();if(!item)return;commit(()=>{const [w,h]=dimensions(getState());item.x=(w-item.width)/2;item.y=(h-item.height)/2;});};
 const opacity=$('overlay-opacity');opacity.addEventListener('pointerdown',()=>{if(active())remember();});opacity.addEventListener('keydown',e=>{if(active()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))remember();});
 opacity.oninput=e=>{if(active()){active().opacity=Number(e.target.value);changed();}};
 $('overlay-placement').onchange=e=>{if(active())commit(()=>active().placement=e.target.value);};
 for(const [id,delta] of [['overlay-backward',-1],['overlay-forward',1]])$(id).onclick=()=>{const list=items(),index=list.indexOf(active()),next=index+delta;if(index<0||next<0||next>=list.length)return;commit(()=>{[list[index],list[next]]=[list[next],list[index]];});};
 $('delete-overlay').onclick=()=>{if(!active())return;commit(()=>getState().overlays=items().filter(item=>item.id!==selectedId));toast('画像を削除しました。「元に戻す」で復元できます。');};
 function start(e,frame){
  if(getTab()!=='overlay'||e.button!==0||gesture)return;e.preventDefault();select(frame.dataset.id);const corner=e.target.closest('[data-image-resize]')?.dataset.imageResize;
  (e.target.closest('button')||frame).focus({preventScroll:true});frame.setPointerCapture(e.pointerId);
  gesture={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,item:{...active()},corner,mm:dimensions(getState())[0]/$('canvas').getBoundingClientRect().width,moved:false};
 }
 function move(e){
  const g=gesture;if(!g||g.pointer!==e.pointerId)return;e.preventDefault();
  const dx=(e.clientX-g.startX)*g.mm,dy=(e.clientY-g.startY)*g.mm;if(!g.moved){if(Math.hypot(dx,dy)<.2)return;remember();g.moved=true;}
  const b=g.item,[w,h]=dimensions(getState());let next={...b};
  if(!g.corner){next.x+=dx;next.y+=dy;}
  else{
   const west=g.corner.includes('w'),north=g.corner.includes('n'),anchorX=west?b.x+b.width:b.x,anchorY=north?b.y+b.height:b.y;
   const scaleX=1+(west?-dx:dx)/b.width,scaleY=1+(north?-dy:dy)/b.height;
   const requested=Math.abs(scaleX-1)>Math.abs(scaleY-1)?scaleX:scaleY;
   const max=Math.min((west?anchorX:w-anchorX)/b.width,(north?anchorY:h-anchorY)/b.height);
   const scale=Math.max(Math.min(1,.5/Math.min(b.width,b.height)),Math.min(max,requested));
   next.width=b.width*scale;next.height=b.height*scale;next.x=west?anchorX-next.width:anchorX;next.y=north?anchorY-next.height:anchorY;
  }
  Object.assign(active(),imageBounds(getState(),next));changed();
 }
 return {sync};
}
