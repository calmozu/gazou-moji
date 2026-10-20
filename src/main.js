import { colorPresets, presetCSS } from './presets.js';
import '@fontsource/yomogi/400.css';
import '@fontsource/yuji-syuku/400.css';
import '@fontsource/hachi-maru-pop/400.css';
import '@fontsource/dela-gothic-one/400.css';
import '@fontsource/kaisei-decol/400.css';
import '@fontsource/reggae-one/400.css';
import '@fontsource/kaisei-decol/700.css';
import { overlayPanel, createOverlayEditor } from './overlays.js';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-serif-jp/400.css';
import '@fontsource/noto-serif-jp/700.css';
import '@fontsource/zen-maru-gothic/400.css';
import '@fontsource/zen-maru-gothic/700.css';
import '@fontsource/klee-one/400.css';
import '@fontsource/klee-one/600.css';
import './style.css';
import { families, familyLabels, imageBounds, initialState, render, dimensions, textBounds, validateProject, pageFormats, pageFormat, pageScale, textLayers } from './render.js';
import { saveDraft, loadDraft } from './storage.js';
import { pngWithDpi } from './png.js';

const $ = id => document.getElementById(id);
document.querySelector('#app').innerHTML = `
<header>
  <div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><div><strong>かさね</strong><small>写真に、ことばを。</small></div></div>
  <nav class="actions" aria-label="原稿と書き出し">
    <button id="open-project" class="quiet">開く</button><button id="save-project" class="quiet">原稿<span class="long-label">を保存</span></button>
    <button id="preview-button">プレビュー</button><button id="export-button" class="primary">書き出す <span aria-hidden="true">↗</span></button>
  </nav>
</header>
<div class="workspace">
<aside aria-label="編集パネル">
 <div class="tabs" role="tablist" aria-label="編集するもの">
  <button id="tab-text" role="tab" aria-selected="true" aria-controls="panel-text" data-tab="text">文字</button>
  <button id="tab-overlay" role="tab" aria-selected="false" aria-controls="panel-overlay" data-tab="overlay" tabindex="-1">重ねる画像</button>
  <button id="tab-background" role="tab" aria-selected="false" aria-controls="panel-background" data-tab="background" tabindex="-1">背景</button>
  <button id="tab-page" role="tab" aria-selected="false" aria-controls="panel-page" data-tab="page" tabindex="-1">用紙</button>
 </div>
 <div id="panel-text" class="panel" role="tabpanel" aria-labelledby="tab-text">
  <div class="section"><p class="eyebrow">WORDS</p><h2>重ねたい、ことば。</h2>
   <div class="segmented box-selector" role="group" aria-label="編集する文字ボックス"><button id="select-box-1" class="active" aria-pressed="true">BOX1</button><button id="select-box-2" aria-pressed="false" hidden>BOX2</button></div>
   <div id="box-create-actions" class="row box-actions"><button id="add-text-box">空のBOX2を追加</button><button id="copy-text-box">BOX1をコピー</button></div>
   <button id="align-box-left" class="box-align" hidden>左端をBOX1にそろえる</button>
   <button id="delete-text-box" class="quiet box-delete" hidden>BOX2を削除</button>
   <label for="text" class="label" id="text-label">BOX1の本文</label><textarea id="text" maxlength="30000" placeholder="ここに文字を入力してください。&#10;&#10;写真にそっと、ことばを重ねて。" spellcheck="false"></textarea>
   <p id="selection-info">選択なし · 設定は文字全体に反映します</p>
   <label class="field"><span class="label">フォント</span><select id="family">${Object.entries(familyLabels).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>
   <label class="label" for="size">文字サイズ</label><div class="size-buttons"><button id="smaller">小さく −</button><button id="larger">大きく ＋</button></div>
   <div class="row"><div class="number-unit"><input id="size" type="number" min="6" max="200" step="1" aria-label="文字サイズ"><span id="font-size-unit">pt</span></div><button id="bold" aria-pressed="false"><b>B</b> 太字</button><input class="color-input" id="color" type="color" aria-label="文字の色"></div>
   <label class="field preset-field"><span class="label">文字色のプリセット</span><select id="fill-preset"><option value="solid">単色（色を選ぶ）</option>${Object.entries(colorPresets).map(([key,preset])=>`<option value="${key}">${preset.label}</option>`).join('')}</select></label>
   <div id="preset-preview" class="preset-preview" aria-hidden="true" hidden><span>あ Aa</span></div>
   <p class="hint">文字を選ぶと、その部分だけに適用します。色を選び直すと単色に戻ります。</p>
  </div>
  <div class="section"><h2>文字の並べ方</h2>
   <div class="segmented" role="group" aria-label="文字揃え"><button data-align="left" class="active">左揃え</button><button data-align="center">中央</button><button data-align="right">右揃え</button></div>
   <label class="check"><input type="checkbox" id="vertical">縦書きにする</label>
   <p class="hint" id="vertical-hint" hidden>右の列から左へ読み進めます。揃え方は上・中央・下に対応します。</p>
   <label class="range-label" for="letter-spacing"><span>文字間隔</span><output id="letter-spacing-value">0%</output></label><input id="letter-spacing" type="range" min="-0.5" max="0.5" step="0.01" value="0">
   <div class="row"><button id="tighten-spacing">間隔を狭く −</button><button id="reset-spacing">標準に戻す</button></div><p class="hint">マイナスにすると、文字と文字の間が詰まります。</p>
   <label class="range-label" for="line-height"><span>行間</span><output id="line-height-value">1.65</output></label><input id="line-height" type="range" min="1" max="3" step="0.05" value="1.65">
  </div>
  <div class="section"><h2>文字枠の位置と大きさ</h2>
   <p class="hint" id="text-box-help">用紙上の緑の枠をドラッグして移動。四隅の丸をつかむと大きさを変えられます。</p>
   <div class="margin-grid" style="margin-top:14px">
    ${[['x','左から'],['y','上から'],['width','幅'],['height','高さ']].map(([key,label])=>`<label class="field"><span class="label">${label}</span><div class="number-unit"><input id="box-${key}" data-box="${key}" type="number" min="${key==='width'||key==='height'?20:0}" step="1"><span data-layout-unit>mm</span></div></label>`).join('')}
   </div><div class="row" style="margin-top:14px"><button id="compact-text-box">小さな枠にする</button><button id="center-text-box">用紙の中央へ</button></div>
  </div>
  <div class="section"><h2>文字に、やわらかな光を。</h2>
   <label class="check"><input id="glow" type="checkbox">glow（光彩）をつける</label>
   <div class="row"><label class="label" for="glow-color">光の色</label><input id="glow-color" class="color-input" type="color" value="#ffffff" aria-label="glowの色"></div>
   <label class="range-label" for="glow-size"><span>光の広がり</span><output id="glow-size-value">1.5</output></label><input id="glow-size" type="range" min="0.2" max="6" step="0.1" value="1.5">
   <p class="hint">文字を選ぶと、その部分だけ変更できます。光彩もPNG・PDFにそのまま残ります。</p>
  </div>
 </div>
${overlayPanel}
 <div id="panel-background" class="panel" role="tabpanel" aria-labelledby="tab-background" hidden>
  <div class="section"><p class="eyebrow">BACKGROUND</p><h2>一枚の写真から。</h2>
   <img id="bg-thumb" class="bg-thumb" alt="選択した背景画像" hidden>
   <button class="upload" id="choose-image"><span aria-hidden="true">＋</span><span>ライブラリから画像を選ぶ</span></button>
   <p class="hint">写真はこのブラウザー内で処理します。<br>JPEG・PNG・WebPに対応しています。</p>
   <button id="remove-image" class="quiet" hidden>背景画像をはずす</button>
  </div>
  <div class="section"><h2>画像の収め方</h2>
   <label class="field"><span class="label">配置</span><select id="fit"><option value="cover">画面いっぱい（切り抜き）</option><option value="contain">余白をつけて全体を入れる</option><option value="height">縦に合わせる</option><option value="width">横に合わせる</option></select></label>
   <label class="range-label" for="opacity"><span>不透明度</span><output id="opacity-value">100%</output></label><input id="opacity" type="range" min="0" max="100" value="100">
   <label class="range-label" for="zoom"><span>拡大</span><output id="zoom-value">100%</output></label><input id="zoom" type="range" min="1" max="5" step="0.01" value="1">
   <label class="range-label" for="image-x"><span>左右の位置</span></label><input id="image-x" type="range" min="-300" max="300" step="1" value="0">
   <label class="range-label" for="image-y"><span>上下の位置</span></label><input id="image-y" type="range" min="-300" max="300" step="1" value="0">
   <button id="reset-image">位置と拡大をリセット</button>
  </div>
  <div class="text-mode-note">背景タブでは、用紙上をドラッグして画像を移動できます。2本指でピンチすると拡大できます。「画面いっぱい」での調整に便利です。</div>
 </div>
 <div id="panel-page" class="panel" role="tabpanel" aria-labelledby="tab-page" hidden>
  <div class="section"><p class="eyebrow">PAPER</p><h2>余白を、整える。<span class="badge" id="page-badge">A4</span></h2>
   <label class="field"><span class="label">サイズ</span><select id="page-size">${Object.entries(pageFormats).map(([key,format])=>`<option value="${key}">${format.label}${format.pixels?` · ${format.pixels.join(' × ')} px`:''}</option>`).join('')}</select></label>
   <div id="page-orientation" class="segmented" role="group" aria-label="用紙の向き"><button data-orientation="portrait" class="active">▯ 縦</button><button data-orientation="landscape">▭ 横</button></div>
   <div class="row" style="margin-top:16px"><label class="label" for="paper-color">用紙の色</label><input id="paper-color" class="color-input" type="color" value="#ffffff"></div>
  </div>
  <div class="section"><h2>文字範囲の余白 <span id="margin-unit-hint">mm / 20 mm = 2 cm</span></h2><div class="margin-grid">
   ${[['top','上'],['bottom','下'],['left','左'],['right','右']].map(([key,label])=>`<label class="field"><span class="label">${label}</span><div class="number-unit"><input id="margin-${key}" data-margin="${key}" type="number" min="0" max="70" value="20"><span data-layout-unit>mm</span></div></label>`).join('')}
   </div><label class="check" style="margin-top:12px"><input id="show-guides" type="checkbox" checked>余白ガイドを表示</label><p class="hint">余白を変えると、文字枠をその内側いっぱいに戻します。枠とガイドは書き出されません。</p>
  </div>
  <div class="section"><h2>原稿を残す</h2><p class="hint">編集中の原稿は、このブラウザーに自動保存します。別の端末でも編集するには、上の「原稿を保存」でファイルを保存してください。</p><button id="new-document" style="margin-top:14px">新しい原稿</button></div>
 </div>
</aside>
<main class="stage" aria-label="仕上がりプレビュー">
 <div class="stage-bar"><div><input id="title" class="document-name" maxlength="100" aria-label="原稿の名前"></div><div class="stage-meta"><span id="page-meta">A4 · 210 × 297 mm</span><div class="history"><button id="undo" aria-label="元に戻す" title="元に戻す">↶</button><button id="redo" aria-label="やり直す" title="やり直す">↷</button></div><button id="fullscreen" class="quiet" aria-label="画面いっぱいで編集" title="画面いっぱいで編集">⛶</button></div></div>
 <div class="canvas-scroll" id="canvas-scroll"><div class="paper-wrap" id="paper-wrap"><canvas id="canvas" aria-label="仕上がりのプレビュー"></canvas><div class="guides" id="guides"></div><div id="text-box" class="text-box" role="group" tabindex="0" aria-label="文字枠を移動" aria-describedby="text-box-help"><span class="text-box-caption" aria-hidden="true">文字枠 · ドラッグで移動</span>${[['nw','左上'],['ne','右上'],['sw','左下'],['se','右下']].map(([key,label])=>`<button type="button" class="box-handle ${key}" data-resize="${key}" aria-label="文字枠の${label}を調整" title="ドラッグで大きさを変更"></button>`).join('')}</div><div id="text-box-other" class="text-box inactive-box" role="button" tabindex="0" aria-label="もう一つの文字ボックスを編集" hidden><span class="text-box-caption" aria-hidden="true"></span></div><div class="empty-note" id="empty-note"><b>余白から、はじめよう。</b><small>左の文字欄に、ことばを添えて。</small></div></div></div>
 <div class="stage-footer"><span id="save-status" role="status"><i class="dot"></i>このブラウザーに自動保存</span><span id="overflow" class="warning" role="status" hidden>文字が枠に収まりません。枠を広げるか文字を小さくしてください。</span><span id="char-count">0 文字</span></div>
</main>
</div>
<input id="image-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
<input id="project-file" type="file" accept=".kasane,.json,application/json" hidden>
<dialog id="export-dialog" aria-labelledby="export-heading"><div class="dialog-top"><h2 id="export-heading">仕上がりを確認</h2><button id="close-export" class="quiet" aria-label="閉じる">✕</button></div><p class="hint" id="export-size-hint">A4・300 dpiで保存します。背景・文字・光彩を一枚に重ねます。</p><img id="export-preview" alt="書き出す画像のプレビュー"><p id="export-warning" class="warning" hidden>文字枠に収まらない文字があります。編集画面で調整してください。</p><div class="export-options"><select id="export-format" aria-label="書き出す形式"><option value="png">PNG 画像</option><option value="pdf">PDF</option></select><button id="confirm-export" class="primary">保存する ↗</button></div><p class="hint">iPadでは保存後、共有ボタンから「画像を保存」や「ファイルに保存」を選べます。</p></dialog>
<dialog id="new-dialog" aria-labelledby="new-heading"><div class="dialog-top"><h2 id="new-heading">新しい原稿にしますか？</h2></div><p class="hint">現在の原稿は置き換わります。必要なら先に「原稿を保存」してください。</p><div class="export-options"><button id="cancel-new">戻る</button><button id="confirm-new" class="primary">新しくする</button></div></dialog>
<div class="toast" id="toast" role="status" hidden></div>`;

let state=initialState(), image=null, tab='text', selection=[0,0], history=[], future=[], saveTimer, toastTimer, composing=false, overflow=false;
let activeTextBox=0,overlayImages=new Map();
const overlayEditor=createOverlayEditor({getState:()=>state,getImages:()=>overlayImages,getTab:()=>tab,remember,changed,toast,readDataURL,decodeImage,layoutFactor});
async function prepareOverlays(next){return new Map(await Promise.all((next.overlays||[]).map(async item=>[item.src,overlayImages.get(item.src)||await decodeImage(item.src)])));}
let fontReady=Promise.resolve(), fontKey='', drawing=0, hasBooted=false;
const canvas=$('canvas'), text=$('text');
function layer(){return activeTextBox===1 && state.secondTextBox ? state.secondTextBox : state;}
function editState(t=layer()){return {...state,...t};}
function chooseLayer(index){
  if(index===1&&!state.secondTextBox)return;
  activeTextBox=index;selection=[0,0];text.value=layer().text;text.setSelectionRange(0,0);syncControls();scheduleDraw();
}
$('select-box-1').onclick=()=>chooseLayer(0);$('select-box-2').onclick=()=>chooseLayer(1);
function createSecondBox(copyFirst=false){
  if(state.secondTextBox)return;
  remember();const t=state,b=textBounds(state),[w,h]=dimensions(state);
  const width=copyFirst?b.width:Math.min(b.width,w*2/3),height=copyFirst?b.height:Math.min(b.height,h/3),y=b.y+b.height+5;
  state.secondTextBox=structuredClone({text:copyFirst?t.text:'',styles:copyFirst?t.styles:[],style:t.style,vertical:t.vertical,align:t.align,lineHeight:t.lineHeight,letterSpacing:t.letterSpacing||0,textBox:{x:Math.max(0,Math.min(w-width,b.x)),y:y+height<=h?y:Math.max(0,Math.min(h-height,b.y+10)),width,height}});
  chooseLayer(1);changed();text.focus();
}
$('add-text-box').onclick=()=>createSecondBox();
$('copy-text-box').onclick=()=>createSecondBox(true);
$('align-box-left').onclick=()=>{
  if(!state.secondTextBox||activeTextBox!==1)return;
  const first=textBounds(state),second=textBounds(editState(state.secondTextBox)),[w]=dimensions(state);
  if(first.x+second.width>w){toast('この位置ではBOX2が用紙からはみ出します。BOX2の幅を小さくしてから整列してください。');return;}
  if(second.x===first.x)return;
  updateValue(()=>{state.secondTextBox.textBox={...second,x:first.x};});
};
$('delete-text-box').onclick=()=>{
  if(!state.secondTextBox)return;
  remember();state.secondTextBox=null;chooseLayer(0);changed();$('select-box-1').focus({preventScroll:true});toast('BOX2を削除しました。「元に戻す」で復元できます。');
};

function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,5000); }
function remember() { history.push(JSON.stringify(state)); if(history.length>40)history.shift(); future=[]; updateHistory(); }
function updateHistory(){ $('undo').disabled=!history.length; $('redo').disabled=!future.length; }
function changed({sync=true}={}) {
  if(sync) syncControls(); scheduleDraw(); clearTimeout(saveTimer);
  $('save-status').textContent='保存中…';
  saveTimer=setTimeout(async()=>{ try{await saveDraft(state); $('save-status').textContent='✓ このブラウザーに保存済み';}catch{$('save-status').textContent='自動保存できません。原稿を保存してください';} },450);
}
function fitPaper() {
  const [w,h]=dimensions(state), container=$('canvas-scroll');
  const styles=getComputedStyle(container), availableW=container.clientWidth-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight);
  const availableH=container.clientHeight-parseFloat(styles.paddingTop)-parseFloat(styles.paddingBottom);
  const width=Math.max(50,Math.min(availableW,availableH*w/h,850));
  $('paper-wrap').style.width=`${width}px`; $('paper-wrap').style.height=`${width*h/w}px`;
  const m=state.margins; Object.assign($('guides').style,{top:`${m.top/h*100}%`,bottom:`${m.bottom/h*100}%`,left:`${m.left/w*100}%`,right:`${m.right/w*100}%`});
  function positionFrame(id,t){const b=textBounds(editState(t));Object.assign($(id).style,{left:`${b.x/w*100}%`,top:`${b.y/h*100}%`,width:`${b.width/w*100}%`,height:`${b.height/h*100}%`});}
  positionFrame('text-box',layer());if(state.secondTextBox)positionFrame('text-box-other',activeTextBox===0?state.secondTextBox:state);
}
async function ensureFonts() {
  const layers=textLayers(state),styles=layers.flatMap(t=>[t.style,...t.styles.filter(Boolean)]),unique=new Map(),content=layers.map(t=>t.text).join('\n');
  for(const s of styles)unique.set(`${s.family}:${s.bold}`,s);
  const key=[...unique.keys()].sort().join('|')+'|'+content;
  if(key===fontKey)return fontReady;fontKey=key;
  fontReady=Promise.all([...unique.values()].map(s=>document.fonts.load(`${s.bold?(s.family==='textbook'?600:700):400} 24px ${families[s.family]}`,content || '写真にことばを。ABC')));
  return fontReady;
}
function scheduleDraw(){ cancelAnimationFrame(drawing); drawing=requestAnimationFrame(draw); }
async function draw(){
  try { await ensureFonts(); } catch { toast('フォントを読み込めませんでした。通信を確認してください。'); }
  const result=render(canvas,state,image,{dpi:pageFormat(state).pixels?300:120,overlayImages}); overflow=result.overflow;
  $('overflow').hidden=!overflow;$('overflow').textContent=`${result.overflowingBoxes.map(n=>'BOX'+n).join('・')}の文字が枠に収まりません。枠を広げるか文字を小さくしてください。`;$('empty-note').hidden=textLayers(state).some(t=>!!t.text)||!!image||!!state.overlays?.length;
  $('char-count').textContent=`${textLayers(state).reduce((sum,t)=>sum+[...t.text].length,0).toLocaleString()} 文字`;
  fitPaper();
}
function activeStyle(){ return {...layer().style,...(selection[0]!==selection[1]?layer().styles[selection[0]]:null)}; }
function selectionInfo(){ const [a,b]=selection; $('selection-info').textContent=a!==b?`${b-a} 文字を選択中 · 設定は選択範囲に反映します`:'選択なし · 設定は文字全体に反映します'; }
function syncControls(){
  if(activeTextBox===1&&!state.secondTextBox)activeTextBox=0;
  $('select-box-2').hidden=!(state.secondTextBox);$('add-text-box').hidden=!!state.secondTextBox;
  $('align-box-left').hidden=!state.secondTextBox||activeTextBox!==1;
  $('box-create-actions').hidden=!!state.secondTextBox;$('delete-text-box').hidden=!state.secondTextBox||activeTextBox!==1;
  for(const i of [0,1]){$('select-box-'+(i+1)).classList.toggle('active',activeTextBox===i);$('select-box-'+(i+1)).setAttribute('aria-pressed',activeTextBox===i);}
  $('text-label').textContent=`BOX${activeTextBox+1}の本文`;
  $('letter-spacing').value=layer().letterSpacing||0;$('letter-spacing-value').value=`${Math.round((layer().letterSpacing||0)*100)}%`;
  $('text-box').querySelector('.text-box-caption').textContent=`BOX${activeTextBox+1} · ドラッグで移動`;
  $('text-box-other').querySelector('.text-box-caption').textContent=`BOX${activeTextBox===0?2:1} · 選択して編集`;
  $('text-box-other').hidden=tab!=='text'||!state.secondTextBox;
  const s=activeStyle();
  for(const [id,v] of Object.entries({family:s.family,size:s.size,color:s.color,'glow-color':s.glowColor,'glow-size':s.glowSize,fit:state.background.fit,opacity:state.background.opacity,zoom:state.background.zoom,'image-x':state.background.x,'image-y':state.background.y,'line-height':layer().lineHeight,'paper-color':state.paper,title:state.title})) $(id).value=v;
  $('fill-preset').value=s.fillPreset||'solid';
  $('preset-preview').hidden=!Object.hasOwn(colorPresets,s.fillPreset||'');$('preset-preview').firstElementChild.style.backgroundImage=presetCSS(s.fillPreset);
  $('bold').setAttribute('aria-pressed',s.bold); $('bold').classList.toggle('active',s.bold); $('bold').style.background=s.bold?'#e4eddf':'';
  $('glow').checked=s.glow; $('vertical').checked=layer().vertical; $('vertical-hint').hidden=!layer().vertical;
  $('glow-size-value').value=s.glowSize; $('line-height-value').value=layer().lineHeight;
  $('opacity-value').value=`${state.background.opacity}%`; $('zoom-value').value=`${Math.round(state.background.zoom*100)}%`;
  for(const k in state.margins) $('margin-'+k).value=state.margins[k];
  document.querySelectorAll('[data-align]').forEach((b,i)=>{b.classList.toggle('active',b.dataset.align===layer().align); b.textContent=layer().vertical?['上揃え','中央','下揃え'][i]:['左揃え','中央','右揃え'][i];});
  document.querySelectorAll('[data-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.orientation===state.orientation));
  const format=pageFormat(state), video=!!format.pixels, factor=layoutFactor();
  $('page-size').value=state.pageSize || 'a4';$('page-badge').textContent=video?'VIDEO':'A4';$('page-orientation').hidden=video;
  $('page-meta').textContent=video?`${format.label} · ${format.pixels.join(' × ')} px`:`A4 · ${dimensions(state).join(' × ')} mm`;
  $('export-size-hint').textContent=video?`${format.label}：PNGは ${format.pixels.join(' × ')} px、PDFは同じ縦横比で保存します。`:'A4・300 dpiで保存します。背景・文字・光彩を一枚に重ねます。';
  $('export-format').querySelector('[value=pdf]').textContent=video?'PDF（同じ比率）':'PDF（A4）';
  $('margin-unit-hint').textContent=video?'px':'mm / 20 mm = 2 cm';
  document.querySelectorAll('[data-layout-unit]').forEach(el=>el.textContent=video?'px':'mm');
  const [dw,dh]=dimensions(state);
  for(const key in state.margins){
    const el=$('margin-'+key), other={left:'right',right:'left',top:'bottom',bottom:'top'}[key];
    el.value=Math.round(state.margins[key]*factor*10)/10;
    el.max=Math.floor(Math.max(0,Math.min(70,(key==='left'||key==='right'?dw:dh)-state.margins[other]-20))*factor);
  }
  $('bg-thumb').hidden=!image; $('remove-image').hidden=!image; if(image) $('bg-thumb').src=image.src;
  $('paper-wrap').classList.toggle('adjust',tab==='background');
  const fontFactor=fontSizeFactor();$('size').value=Math.round(s.size*fontFactor*10)/10;
  $('size').min=6*fontFactor;$('size').max=200*fontFactor;$('font-size-unit').textContent=video?'px':'pt';
  const box=textBounds(editState()), [pageWidth,pageHeight]=dimensions(state);
  for(const [key,value] of Object.entries(box)) {
    const el=$('box-'+key); el.value=Math.round(value*factor*10)/10;el.min=key==='width'||key==='height'?Math.ceil(20*factor):0;
    el.max=Math.floor((key==='x'?pageWidth-box.width:key==='y'?pageHeight-box.height:key==='width'?pageWidth-box.x:pageHeight-box.y)*factor);
  }
  $('text-box').hidden=tab!=='text'; fitPaper();
  overlayEditor.sync();selectionInfo(); updateHistory();
}
function applyStyle(patch) {
  remember(); const [a,b]=selection;
  if(a!==b) {for(let i=a;i<b;i++) layer().styles[i]={...layer().style,...layer().styles[i],...patch};}
  else {layer().style={...layer().style,...patch};layer().styles=layer().styles.map(s=>s?{...s,...patch}:s);}
  changed();
  // Keep the logical selection while controls own focus; never insert an accidental newline.
}
function captureSelection(){ const next=[text.selectionStart,text.selectionEnd];if(next[0]===selection[0]&&next[1]===selection[1])return;selection=next;syncControls(); }
text.addEventListener('select',captureSelection);
text.addEventListener('keyup',()=>{if(!composing)captureSelection();});
text.addEventListener('pointerup',()=>setTimeout(captureSelection,0));
text.addEventListener('compositionstart',()=>{remember();composing=true;});
text.addEventListener('compositionend',()=>{composing=false;captureSelection();});
text.addEventListener('beforeinput',()=>{if(!composing)remember();});
text.addEventListener('input',()=>{
  const old=layer().text, next=text.value; let start=0;
  while(start<old.length && start<next.length && old[start]===next[start])start++;
  let tail=0; while(tail<old.length-start && tail<next.length-start && old[old.length-1-tail]===next[next.length-1-tail])tail++;
  const inserted=next.length-start-tail, inherited={...layer().style,...layer().styles[Math.max(0,start-1)]};
  layer().styles=[...layer().styles.slice(0,start),...Array.from({length:inserted},()=>({...inherited})),...layer().styles.slice(old.length-tail)];
  layer().text=next;selection=[text.selectionStart,text.selectionEnd];changed({sync:false});selectionInfo();
});
for(const [id,key] of [['family','family'],['glow-color','glowColor']]) $(id).addEventListener('change',e=>applyStyle({[key]:e.target.value}));
$('color').onchange=e=>applyStyle({color:e.target.value,fillPreset:'solid'});
$('fill-preset').onchange=e=>applyStyle({fillPreset:e.target.value});
$('size').addEventListener('change',e=>{const v=Number(e.target.value)/fontSizeFactor();if(!Number.isFinite(v)||v<6||v>200){syncControls();return;}applyStyle({size:v});});
$('size').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();}});
for(const [id,delta] of [['smaller',-2],['larger',2]]) $(id).onclick=()=>{
  const [a,b]=selection;
  if(a===b) applyStyle({size:Math.max(6,Math.min(200,activeStyle().size+delta/fontSizeFactor()))});
  else {remember(); for(let i=a;i<b;i++){const s={...layer().style,...layer().styles[i]};layer().styles[i]={...s,size:Math.max(6,Math.min(200,s.size+delta/fontSizeFactor()))};}changed();}
};
$('bold').onclick=()=>applyStyle({bold:!activeStyle().bold});
$('glow').onchange=e=>applyStyle({glow:e.target.checked});
$('glow-size').addEventListener('pointerdown',()=>remember());
$('glow-size').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))remember();});
$('glow-size').oninput=e=>{ // Range edits are grouped into a single undo entry for pointer interaction.
  const patch={glowSize:Number(e.target.value)}, [a,b]=selection;
  if(a!==b)for(let i=a;i<b;i++)layer().styles[i]={...layer().style,...layer().styles[i],...patch};
  else{layer().style={...layer().style,...patch};layer().styles=layer().styles.map(s=>s?{...s,...patch}:s);}changed();
};
function updateValue(fn){remember();fn();changed();}
$('vertical').onchange=e=>updateValue(()=>layer().vertical=e.target.checked);
$('tighten-spacing').onclick=()=>updateValue(()=>layer().letterSpacing=Math.max(-.5,Math.round(((layer().letterSpacing||0)-.05)*100)/100));
$('reset-spacing').onclick=()=>updateValue(()=>layer().letterSpacing=0);
$('paper-color').onchange=e=>updateValue(()=>state.paper=e.target.value);
$('title').onchange=e=>updateValue(()=>state.title=e.target.value.trim()||'無題のかさね');
$('show-guides').onchange=e=>$('guides').hidden=!e.target.checked;
for(const id of ['line-height','letter-spacing','opacity','zoom','image-x','image-y']) {
  $(id).addEventListener('pointerdown',()=>remember());
  $(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))remember();});
  $(id).oninput=e=>{const n=Number(e.target.value);if(id==='line-height')layer().lineHeight=n;else if(id==='letter-spacing')layer().letterSpacing=n;else state.background[{'image-x':'x','image-y':'y'}[id]||id]=n;changed();};
}
$('fit').onchange=e=>updateValue(()=>{Object.assign(state.background,{fit:e.target.value,x:0,y:0,zoom:1});});
$('reset-image').onclick=()=>updateValue(()=>Object.assign(state.background,{x:0,y:0,zoom:1}));
function layoutFactor(){return pageFormat(state).pixels?300/25.4*pageScale(state):1;}
function fontSizeFactor(){return pageFormat(state).pixels?300/72*pageScale(state):1;}
function fitMargins(){
  const [w,h]=dimensions(state);
  for(const [first,second,size] of [['left','right',w],['top','bottom',h]]){
    const total=state.margins[first]+state.margins[second],available=Math.max(0,size-20);
    if(total>available){state.margins[first]*=available/total;state.margins[second]*=available/total;}
  }
}
document.querySelectorAll('[data-margin]').forEach(el=>el.onchange=()=>updateValue(()=>{for(const t of textLayers(state))if(t!==layer()&&!t.textBox)t.textBox=textBounds(editState(t));state.margins[el.dataset.margin]=Math.max(0,Math.min(Number(el.max)/layoutFactor(),Number(el.value)/layoutFactor()||0));layer().textBox=null;}));
$('page-size').onchange=e=>updateValue(()=>{
  const [oldW,oldH]=dimensions(state),layers=textLayers(state),boxes=layers.map(t=>textBounds(editState(t)));state.pageSize=e.target.value;
  const [w,h]=dimensions(state),rx=w/oldW,ry=h/oldH;
  layers.forEach((t,i)=>{const b=boxes[i];t.textBox=textBounds({...state,textBox:{x:b.x*rx,y:b.y*ry,width:b.width*rx,height:b.height*ry}});});
  for(const item of state.overlays||[])Object.assign(item,imageBounds(state,{...item,x:item.x*rx,y:item.y*ry,width:item.width*Math.min(rx,ry),height:item.height*Math.min(rx,ry)}));
  for(const key in state.margins)state.margins[key]=Math.min(70,state.margins[key]*(key==='left'||key==='right'?rx:ry));
  fitMargins();state.background.x=Math.max(-300,Math.min(300,state.background.x*rx));state.background.y=Math.max(-300,Math.min(300,state.background.y*ry));
});
document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>updateValue(()=>layer().align=b.dataset.align));
document.querySelectorAll('[data-orientation]').forEach(b=>b.onclick=()=>updateValue(()=>{state.orientation=b.dataset.orientation;for(const t of textLayers(state))t.textBox=textBounds(editState(t));for(const item of state.overlays||[])Object.assign(item,imageBounds(state,item));}));
document.querySelectorAll('[data-box]').forEach(el=>el.onchange=()=>{
  const value=Number(el.value)/layoutFactor();if(el.value===''||!Number.isFinite(value)){syncControls();return;}
  updateValue(()=>{const box=textBounds(editState());box[el.dataset.box]=value;layer().textBox=textBounds({...editState(),textBox:box});});
});
$('compact-text-box').onclick=()=>updateValue(()=>{const box=textBounds(editState()),[w,h]=dimensions(state),video=!!pageFormat(state).pixels;layer().textBox=textBounds({...editState(),textBox:{...box,width:video?w*2/3:140,height:video?h/3:100}});});
$('center-text-box').onclick=()=>updateValue(()=>{const [w,h]=dimensions(state),box=textBounds(editState());layer().textBox={...box,x:(w-box.width)/2,y:(h-box.height)/2};});
function setTab(name){tab=name;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===name;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;$('panel-'+b.dataset.tab).hidden=!active;});syncControls();}
document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>setTab(b.dataset.tab);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=['text','overlay','background','page'];let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;setTab(tabs[i]);$('tab-'+tabs[i]).focus();}};});
function readDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('ファイルを読み込めませんでした。'));reader.readAsDataURL(file);});}
function decodeImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('画像を読み込めません。JPEG・PNG・WebPをお試しください。'));img.src=src;});}
$('choose-image').onclick=()=>$('image-file').click();
$('image-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('JPEG・PNG・WebP形式の画像を選んでください。');return;}
  if(file.size>40000000){toast('画像が大きすぎます。40 MB以下の画像を選んでください。');return;}
  try{
    $('choose-image').disabled=true;
    let img=await decodeImage(await readDataURL(file));
    // Bound memory on tablets and keep portable project files a reasonable size.
    const ratio=Math.min(1,4096/Math.max(img.naturalWidth,img.naturalHeight));
    const temp=document.createElement('canvas'); temp.width=Math.round(img.naturalWidth*ratio);temp.height=Math.round(img.naturalHeight*ratio);temp.getContext('2d').drawImage(img,0,0,temp.width,temp.height);
    const src=temp.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',.94);
    if(src.length>25000000)throw new Error('画像が大きすぎます。少し小さな画像を選んでください。');
    img=await decodeImage(src);remember();image=img;Object.assign(state.background,{src,zoom:1,x:0,y:0});changed();
  }catch(error){toast(error.message);}finally{$('choose-image').disabled=false;}
};
$('remove-image').onclick=()=>updateValue(()=>{image=null;state.background.src='';});
async function restore(next){const nextOverlays=await prepareOverlays(next),nextImage=next.background.src?await decodeImage(next.background.src):null;const restoredSecond=!state.secondTextBox&&!!next.secondTextBox;state=next;overlayImages=nextOverlays;if(!state.secondTextBox)activeTextBox=0;else if(restoredSecond)activeTextBox=1;selection=[0,0];text.value=layer().text;image=nextImage;changed();}
async function undo(){if(!history.length)return;future.push(JSON.stringify(state));await restore(JSON.parse(history.pop()));}
async function redo(){if(!future.length)return;history.push(JSON.stringify(state));await restore(JSON.parse(future.pop()));}
$('undo').onclick=undo;$('redo').onclick=redo;
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && document.body.classList.contains('fullscreen')) toggleFullscreen();
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!composing){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();}
});
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function filename(){
  const title=state.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'かさね';
  const now=new Date(),pad=value=>String(value).padStart(2,'0');
  const date=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const time=`${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${title}_${date}_${time}`;
}
function saveProject(){download(new Blob([JSON.stringify(state)],{type:'application/json'}),filename()+'.kasane');toast('編集できる原稿ファイルを保存しました。');}
$('save-project').onclick=saveProject;
$('open-project').onclick=()=>$('project-file').click();
$('project-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(file.size>65000000){toast('原稿ファイルが大きすぎます。');return;}
  try{const next=validateProject(JSON.parse(await file.text()));const nextImage=next.background.src?await decodeImage(next.background.src):null;const nextOverlays=await prepareOverlays(next);remember();state=next;overlayImages=nextOverlays;activeTextBox=0;image=nextImage;text.value=layer().text;selection=[0,0];changed();toast('原稿を開きました。');}catch{toast('原稿を開けませんでした。「かさね」で保存した原稿ファイルを選んでください。');}
};
$('new-document').onclick=()=>$('new-dialog').showModal();$('cancel-new').onclick=()=>$('new-dialog').close();
$('confirm-new').onclick=()=>{remember();restore(initialState());$('new-dialog').close();};
function toggleFullscreen(){document.body.classList.toggle('fullscreen');$('fullscreen').setAttribute('aria-label',document.body.classList.contains('fullscreen')?'編集画面に戻る':'画面いっぱいで編集');requestAnimationFrame(fitPaper);}
$('fullscreen').onclick=toggleFullscreen;
let exportCanvas=null;
async function openExport(){
  try{await ensureFonts(); exportCanvas=document.createElement('canvas');const result=render(exportCanvas,state,image,{dpi:pageFormat(state).pixels?300:150,overlayImages});$('export-warning').hidden=!result.overflow;$('export-preview').src=exportCanvas.toDataURL('image/png');$('export-dialog').showModal();}catch{toast('プレビューを作れませんでした。画像のサイズを小さくしてお試しください。');}
}
$('export-button').onclick=openExport;$('preview-button').onclick=openExport;$('close-export').onclick=()=>$('export-dialog').close();
$('confirm-export').onclick=async()=>{
  document.body.classList.add('busy');$('confirm-export').disabled=true;
  try{
    await ensureFonts();const output=document.createElement('canvas');render(output,state,image,{dpi:300,overlayImages});
    if($('export-format').value==='pdf'){
      const {jsPDF}=await import('jspdf');const [w,h]=dimensions(state).map(n=>n*pageScale(state));const pdf=new jsPDF({orientation:w>h?'landscape':'portrait',unit:'mm',format:pageFormat(state).pixels?[w,h]:'a4',compress:true});
      pdf.addImage(output.toDataURL('image/png'),'PNG',0,0,w,h,undefined,'FAST');pdf.setProperties({title:state.title,creator:'かさね'});download(pdf.output('blob'),filename()+'.pdf');
    }else{
      const blob=await pngWithDpi(output,300);download(blob,filename()+'.png');
    }
    toast('書き出しました。ダウンロードしたファイルをご確認ください。');
  }catch(error){console.error(error);toast('書き出せませんでした。画像を小さくして、もう一度お試しください。');}
  finally{document.body.classList.remove('busy');$('confirm-export').disabled=false;}
};
// The overlay is editor-only; the shared canvas renderer uses the same millimetre bounds.
const textBoxElement=$('text-box'); let boxGesture=null;
function startBoxGesture(e){
  if(tab!=='text'||boxGesture||e.button!==0)return;
  e.preventDefault();const handle=e.target.closest('[data-resize]');
  (handle||textBoxElement).focus({preventScroll:true});textBoxElement.setPointerCapture(e.pointerId);
  boxGesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,box:textBounds(editState()),corner:handle?.dataset.resize,mm:dimensions(state)[0]/canvas.getBoundingClientRect().width,moved:false};
}
textBoxElement.addEventListener('pointerdown',startBoxGesture);
$('text-box-other').addEventListener('pointerdown',e=>{if(e.button!==0||boxGesture)return;chooseLayer(activeTextBox===0?1:0);startBoxGesture(e);});
$('text-box-other').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseLayer(activeTextBox===0?1:0);textBoxElement.focus();}});
textBoxElement.addEventListener('pointermove',e=>{
  const g=boxGesture;if(!g||g.id!==e.pointerId)return;e.preventDefault();
  const dx=(e.clientX-g.startX)*g.mm,dy=(e.clientY-g.startY)*g.mm;
  if(!g.moved){if(Math.hypot(dx,dy)<.2)return;remember();g.moved=true;}
  const [w,h]=dimensions(state),b=g.box,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  let left=b.x,top=b.y,right=b.x+b.width,bottom=b.y+b.height;
  if(!g.corner){left=clamp(b.x+dx,0,w-b.width);top=clamp(b.y+dy,0,h-b.height);right=left+b.width;bottom=top+b.height;}
  else{
    if(g.corner.includes('w'))left=clamp(b.x+dx,0,right-20);
    if(g.corner.includes('e'))right=clamp(b.x+b.width+dx,left+20,w);
    if(g.corner.includes('n'))top=clamp(b.y+dy,0,bottom-20);
    if(g.corner.includes('s'))bottom=clamp(b.y+b.height+dy,top+20,h);
  }
  layer().textBox={x:left,y:top,width:right-left,height:bottom-top};changed();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])textBoxElement.addEventListener(name,e=>{if(boxGesture?.id===e.pointerId)boxGesture=null;});
textBoxElement.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();const delta=(e.shiftKey?5:1)/layoutFactor(),box=textBounds(editState()),corner=e.target.closest('[data-resize]')?.dataset.resize;
  const dx=e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0,dy=e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0;
  updateValue(()=>{
    if(!corner){box.x+=dx;box.y+=dy;}
    else{
      if(corner.includes('w')){const shift=Math.max(-box.x,Math.min(box.width-20,dx));box.x+=shift;box.width-=shift;}
      else box.width+=dx;
      if(corner.includes('n')){const shift=Math.max(-box.y,Math.min(box.height-20,dy));box.y+=shift;box.height-=shift;}
      else box.height+=dy;
    }
    layer().textBox=textBounds({...editState(),textBox:box});
  });
});
// Gesture coordinates use physical page units, so sliders and touch gestures share the same state.
const pointers=new Map();let gesture=null;
function gestureState(){const p=[...pointers.values()],a=p[0],b=p[1];return {cx:b?(a.x+b.x)/2:a.x,cy:b?(a.y+b.y)/2:a.y,d:b?Math.hypot(a.x-b.x,a.y-b.y):0};}
function beginGesture(){gesture={...gestureState(),zoom:state.background.zoom,x:state.background.x,y:state.background.y};}
canvas.addEventListener('pointerdown',e=>{
  if(tab!=='background'||!image)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
  if(!pointers.size)remember();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});beginGesture();
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=gestureState(),[w]=dimensions(state),rect=canvas.getBoundingClientRect(),mm=w/rect.width;
  const zoom=gesture.d&&p.d?Math.max(1,Math.min(5,gesture.zoom*p.d/gesture.d)):gesture.zoom;
  const factor=zoom/gesture.zoom;
  // Keep the image point below the pinch centre anchored during scaling.
  const centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2;
  state.background.x=Math.max(-300,Math.min(300,gesture.x*factor+(p.cx-centerX-(gesture.cx-centerX)*factor)*mm));
  state.background.y=Math.max(-300,Math.min(300,gesture.y*factor+(p.cy-centerY-(gesture.cy-centerY)*factor)*mm));
  state.background.zoom=zoom;changed();
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pointers.size)beginGesture();else gesture=null;});
new ResizeObserver(()=>fitPaper()).observe($('canvas-scroll'));
window.addEventListener('pagehide',()=>{if(hasBooted)saveDraft(state).catch(()=>{});});
async function boot(){
  try{const saved=await loadDraft();if(saved){const next=validateProject(saved);const nextOverlays=await prepareOverlays(next);const nextImage=next.background.src?await decodeImage(next.background.src):null;state=next;overlayImages=nextOverlays;image=nextImage;text.value=layer().text;}}catch{toast('前回の原稿を復元できませんでした。保存した原稿ファイルから開けます。');}
  hasBooted=true;syncControls();await draw();document.documentElement.dataset.ready='true';
}
boot();
