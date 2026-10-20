import { effectDefaults } from './text-effects.js';
import { colorPresets, presetGradient } from './presets.js';
export const families = {
  sans: '"Noto Sans JP", sans-serif',
  serif: '"Noto Serif JP", serif',
  round: '"Zen Maru Gothic", sans-serif',
  textbook: '"Klee One", serif',
  handwriting: '"Yomogi", cursive',
  brush: '"Yuji Syuku", serif',
  pop: '"Hachi Maru Pop", cursive',
  heavy: '"Dela Gothic One", sans-serif',
  decorative: '"Kaisei Decol", serif',
  reggae: '"Reggae One", sans-serif',
};
export const familyLabels={sans:'角ゴシック',serif:'明朝',round:'丸ゴシック',textbook:'教科書風',handwriting:'手書き（よもぎ）',brush:'筆文字（佑字）',pop:'ポップ（はちまる）',heavy:'極太ゴシック',decorative:'飾り明朝',reggae:'個性派（レゲエ）'};
export const baseStyle = { ...effectDefaults, family: 'sans', size: 24, bold: false, color: '#252923', fillPreset:'solid', glow: false, glowColor: '#ffffff', glowSize: 1.5 };
export const pageFormats={
  a4: {label:'A4'},
  youtube: {label:'YouTube 横動画',pixels:[1920,1080]},
  short: {label:'ショート動画',pixels:[1080,1920]},
  'short-mini': {label:'ショート動画ミニ',pixels:[640,360],referencePixels:[1920,1080]},
};
export function pageFormat(state) { return pageFormats[state.pageSize || 'a4']; }
export function pageScale(state) { const f=pageFormat(state); return f.referencePixels ? f.pixels[0]/f.referencePixels[0] : 1; }
export function dimensions(state) {
  const f=pageFormat(state),pixels=f.referencePixels || f.pixels;
  return pixels ? pixels.map(n=>n*25.4/300) : state.orientation === 'portrait' ? [210,297] : [297,210];
}
export function textLayers(state) { return state.secondTextBox ? [state,state.secondTextBox] : [state]; }
export function textBounds(state) {
  const [w,h]=dimensions(state), m=state.margins;
  const b=state.textBox || {x:m.left,y:m.top,width:w-m.left-m.right,height:h-m.top-m.bottom};
  const width=Math.max(20,Math.min(w,b.width)), height=Math.max(20,Math.min(h,b.height));
  return {x:Math.max(0,Math.min(w-width,b.x)),y:Math.max(0,Math.min(h-height,b.y)),width,height};
}
// Keep image proportions while fitting the entire layer inside the page.
export function imageBounds(state, item) {
  const [w,h]=dimensions(state),ratio=item.width/item.height;
  const maxWidth=Math.min(w,h*ratio),width=Math.min(maxWidth,Math.max(.1,.1*ratio,Math.min(item.width,maxWidth))),height=width/ratio;
  return {x:Math.max(0,Math.min(w-width,item.x)),y:Math.max(0,Math.min(h-height,item.y)),width,height};
}
export function initialState() {
  return { version: 1, title: '無題のかさね', text: '', styles: [], style: { ...baseStyle }, pageSize:'a4', pageLayoutVersion:2, orientation: 'portrait', vertical: false, align: 'left', lineHeight: 1.65, letterSpacing:0, secondTextBox:null, overlays:[],
    margins: { top: 20, right: 20, bottom: 20, left: 20 }, textBox: {x:35,y:40,width:140,height:100}, paper: '#ffffff',
    background: { src: '', fit: 'cover', opacity: 100, zoom: 1, x: 0, y: 0 } };
}
export function backgroundRect(state, image) {
  const [w,h] = dimensions(state), b = state.background;
  let scale = b.fit === 'contain' ? Math.min(w/image.width,h/image.height) : b.fit === 'width' ? w/image.width : b.fit === 'height' ? h/image.height : Math.max(w/image.width,h/image.height);
  scale *= b.zoom;
  const iw = image.width*scale, ih = image.height*scale;
  return { x: (w-iw)/2+b.x, y: (h-ih)/2+b.y, w: iw, h: ih };
}
function font(ctx, style) {
  const size = style.size*25.4/72;
  ctx.font = `${style.bold ? (style.family === 'textbook' ? 600 : 700) : 400} ${size}px ${families[style.family]}`;
  return size;
}
const noStart = /^[、。，．？！：；）」』】〕〉》ーぁぃぅぇぉっゃゅょァィゥェォッャュョ]$/u;
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
export function render(canvas, state, image, { dpi = 120, overlayImages = new Map() } = {}) {
  const [w,h] = dimensions(state), scale = dpi/25.4*pageScale(state);
  canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale);
  const ctx = canvas.getContext('2d'); ctx.scale(scale,scale);
  ctx.fillStyle = state.paper; ctx.fillRect(0,0,w,h);
  if (image) {
    const r = backgroundRect(state,image);
    ctx.save(); ctx.globalAlpha = state.background.opacity/100; ctx.drawImage(image,r.x,r.y,r.w,r.h); ctx.restore();
  }
  function drawImages(placement){
    for(const item of state.overlays || []){
      if(item.placement!==placement)continue;
      const img=overlayImages.get(item.src);if(!img)continue;
      const b=imageBounds(state,item);ctx.save();ctx.globalAlpha=item.opacity/100;
      ctx.drawImage(img,b.x,b.y,b.width,b.height);ctx.restore();
    }
  }
  drawImages('back');
  const results=textLayers(state).map(layer=>drawText(ctx,{...state,...layer},scale));
  drawImages('front');
  return {overflow:results.some(r=>r.overflow),lines:results.reduce((sum,r)=>sum+r.lines,0),glyphs:results.reduce((sum,r)=>sum+r.glyphs,0),overflowingBoxes:results.flatMap((r,i)=>r.overflow?[i+1]:[])};
}
function drawText(ctx,state,scale) {
  const box=textBounds(state), maxLength=state.vertical ? box.height : box.width;
  const lines = []; let line = [], length = 0, largest = 0, cursor = 0;
  function finish() { lines.push({ glyphs: line, length, size: largest || state.style.size*25.4/72 }); line=[]; length=0; largest=0; cursor=0; }
  for (const {segment: char,index} of segmenter.segment(state.text)) {
    if (char === '\n') { finish(); continue; }
    const style = { ...state.style, ...state.styles[index] };
    const size = font(ctx,style), advance = state.vertical ? size : ctx.measureText(char).width;
    if (line.length && Math.max(length,cursor+advance)>maxLength && !noStart.test(char)) finish();
    line.push({ char, style, size, offset:cursor }); length=Math.max(length,cursor+advance); cursor+=Math.max(size*.05,advance+size*(state.letterSpacing||0)); largest=Math.max(largest,size);
  }
  if (line.length || state.text.endsWith('\n')) finish();
  let cross = state.vertical ? box.x+box.width : box.y, overflow = false;
  const placements = [];
  for (const l of lines) {
    const extent = l.size*state.lineHeight;
    if (state.vertical ? cross-l.size < box.x-.0001 : cross+l.size > box.y+box.height+.0001) { overflow = true; break; }
    let along = (state.vertical ? box.y : box.x) + (state.align === 'center' ? (maxLength-l.length)/2 : state.align === 'right' ? maxLength-l.length : 0);
    if (l.length>maxLength+.0001) overflow=true;
    for (const g of l.glyphs) {
      const x = state.vertical ? cross-l.size/2 : along+g.offset, y = state.vertical ? along+g.offset+g.size/2 : cross+l.size*.88;
      placements.push({ ...g,x,y });
    }
    cross += state.vertical ? -extent : extent;
  }
  // Paint each whole layer in passes so neighbouring outlines never cover a fill.
  const withGlyph=(g,paint)=>{
    const style={...effectDefaults,...g.style};ctx.save();font(ctx,style);ctx.translate(g.x,g.y);
    if(state.vertical){ctx.textAlign='center';ctx.textBaseline='middle';if(/^[\u0020-\u007eー〜…―—（）［］「」『』【】]$/u.test(g.char))ctx.rotate(Math.PI/2);else if(/^[、。，．]$/u.test(g.char))ctx.translate(g.size*.28,-g.size*.28);}
    else{ctx.textAlign='left';ctx.textBaseline='alphabetic';}
    ctx.lineJoin='round';paint(style);ctx.restore();
  };
  const width=s=>s.outline?s.outlineWidth+(s.doubleOutline?s.outerOutlineWidth:0):0;
  for(const g of placements)withGlyph(g,s=>{
    if(!s.shadow)return;
    ctx.fillStyle=s.shadowColor;ctx.strokeStyle=s.shadowColor;ctx.lineWidth=width(s)*2;
    ctx.shadowColor=s.shadowColor;ctx.shadowBlur=s.shadowBlur*scale;ctx.shadowOffsetX=s.shadowX*scale;ctx.shadowOffsetY=s.shadowY*scale;
    if(width(s))ctx.strokeText(g.char,0,0);ctx.fillText(g.char,0,0);
  });
  for(const g of placements)withGlyph(g,s=>{
    if(!s.glow)return;
    ctx.fillStyle=s.color;ctx.shadowColor=s.glowColor;ctx.shadowBlur=s.glowSize*scale;
    ctx.fillText(g.char,0,0);ctx.fillText(g.char,0,0);ctx.shadowBlur=0;
    ctx.strokeStyle=s.glowColor;ctx.lineWidth=s.glowSize*.28;ctx.strokeText(g.char,0,0);
  });
  for(const outer of [true,false])for(const g of placements)withGlyph(g,s=>{
    if(!s.outline||(outer&&!s.doubleOutline))return;
    ctx.strokeStyle=outer?s.outerOutlineColor:s.outlineColor;ctx.lineWidth=2*(outer?width(s):s.outlineWidth);ctx.strokeText(g.char,0,0);
  });
  for(const g of placements)withGlyph(g,s=>{
    const metrics=ctx.measureText(g.char),top=state.vertical?-g.size/2:-metrics.actualBoundingBoxAscent,bottom=state.vertical?g.size/2:metrics.actualBoundingBoxDescent;
    ctx.fillStyle=presetGradient(ctx,s.fillPreset,0,top,0,Math.max(top+.001,bottom))||s.color;ctx.fillText(g.char,0,0);
  });
  return { overflow, lines: lines.length, glyphs: placements.length };
}

export function validateProject(value) {
  const s = value;
  const num=(v,a,b)=>typeof v==='number' && Number.isFinite(v) && v>=a && v<=b;
  const color=v=>typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
  const validEffects=v=>['outline','doubleOutline','shadow'].every(k=>v[k]==null||typeof v[k]==='boolean')&&['outlineColor','outerOutlineColor','shadowColor'].every(k=>v[k]==null||color(v[k]))&&['outlineWidth','outerOutlineWidth'].every(k=>v[k]==null||num(v[k],.1,4))&&['shadowX','shadowY'].every(k=>v[k]==null||num(v[k],-5,5))&&(v.shadowBlur==null||num(v.shadowBlur,0,5));
  const validStyle=v=>v && validEffects(v) && (v.fillPreset==null||v.fillPreset==='solid'||Object.hasOwn(colorPresets,v.fillPreset)) && Object.hasOwn(families,v.family) && num(v.size,6,200) && typeof v.bold==='boolean' && color(v.color) && typeof v.glow==='boolean' && color(v.glowColor) && num(v.glowSize,0.2,6);
  if (!s || s.version!==1 || typeof s.title!=='string' || s.title.length>100 || typeof s.text!=='string' || s.text.length>30000 || !['portrait','landscape'].includes(s.orientation) || typeof s.vertical!=='boolean' || !['left','center','right'].includes(s.align) || !num(s.lineHeight,1,3) || !color(s.paper) || !validStyle(s.style) || !Array.isArray(s.styles) || s.styles.length>s.text.length || !s.styles.every(v=>v===null || validStyle(v)) || !s.margins || !['top','right','bottom','left'].every(k=>num(s.margins[k],0,70))) throw new Error('対応していない原稿ファイルです。');
  if (s.letterSpacing!=null && !num(s.letterSpacing,-.5,.5)) throw new Error('文字間隔を読み込めません。');
  if (s.pageSize!=null && !Object.hasOwn(pageFormats,s.pageSize)) throw new Error('対応していない用紙サイズです。');
  if (s.pageLayoutVersion!=null && s.pageLayoutVersion!==2) throw new Error('対応していない用紙の設定です。');
  const legacyMini=s.pageSize==='short-mini' && s.pageLayoutVersion==null;
  if (s.textBox!=null) {
    const t=s.textBox,[w,h]=legacyMini?dimensions({...s,pageSize:'short'}):dimensions(s);
    if (!num(t.x,0,w)||!num(t.y,0,h)||!num(t.width,20,w)||!num(t.height,20,h)||t.x+t.width>w+.0001||t.y+t.height>h+.0001) throw new Error('文字枠の位置や大きさを読み込めません。');
  }
  if (s.secondTextBox!=null) {
    const t=s.secondTextBox;
    if (typeof t!=='object'||typeof t.text!=='string'||t.text.length>30000||!validStyle(t.style)||!Array.isArray(t.styles)||t.styles.length>t.text.length||!t.styles.every(v=>v===null||validStyle(v))||typeof t.vertical!=='boolean'||!['left','center','right'].includes(t.align)||!num(t.lineHeight,1,3)||(t.letterSpacing!=null&&!num(t.letterSpacing,-.5,.5))||!t.textBox||t.secondTextBox!=null) throw new Error('2つ目の文字ボックスを読み込めません。');
    const r=t.textBox,[w,h]=legacyMini?dimensions({...s,pageSize:'short'}):dimensions(s);
    if (!num(r.x,0,w)||!num(r.y,0,h)||!num(r.width,20,w)||!num(r.height,20,h)||r.x+r.width>w+.0001||r.y+r.height>h+.0001) throw new Error('2つ目の文字枠の位置や大きさを読み込めません。');
  }
  if(s.overlays!=null){
    if(!Array.isArray(s.overlays)||s.overlays.length>12)throw new Error('重ねる画像を読み込めません。');
    const ids=new Set(),[w,h]=dimensions(s);let total=0;
    for(const item of s.overlays){
      if(!item||typeof item.id!=='string'||item.id.length>80||ids.has(item.id)||typeof item.name!=='string'||item.name.length>150||typeof item.src!=='string'||item.src.length>12000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.src)||!num(item.opacity,0,100)||!['front','back'].includes(item.placement)||!num(item.x,0,w)||!num(item.y,0,h)||!num(item.width,.1,w)||!num(item.height,.1,h)||item.x+item.width>w+.0001||item.y+item.height>h+.0001)throw new Error('重ねる画像の設定を読み込めません。');
      ids.add(item.id);total+=item.src.length;
    }
    if(total>30000000)throw new Error('重ねる画像の合計サイズが大きすぎます。');
  }
  const b=s.background;
  if (!b || typeof b.src!=='string' || b.src.length>25000000 || (b.src && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.src)) || !['cover','contain','width','height'].includes(b.fit) || !num(b.opacity,0,100) || !num(b.zoom,1,5) || !num(b.x,-1000,1000) || !num(b.y,-1000,1000)) throw new Error('背景画像の設定を読み込めません。');
  const copy=structuredClone(s);
  if (legacyMini) {
    // Older mini drafts used portrait bounds. Keep their contents and move the
    // text frame proportionally into the new landscape page before validating again.
    const rx=1920/1080,ry=1080/1920;
    for(const layer of textLayers(copy)){
      const box=textBounds({...s,...layer,pageSize:'short'});
      layer.textBox=textBounds({...copy,textBox:{x:box.x*rx,y:box.y*ry,width:box.width*rx,height:box.height*ry}});
    }
    for(const key in copy.margins)copy.margins[key]=Math.min(70,copy.margins[key]*(key==='left'||key==='right'?rx:ry));
    const [w,h]=dimensions(copy);
    for(const [first,second,size] of [['left','right',w],['top','bottom',h]]){
      const total=copy.margins[first]+copy.margins[second],available=size-20;
      if(total>available){copy.margins[first]*=available/total;copy.margins[second]*=available/total;}
    }
    copy.background.x=Math.max(-300,Math.min(300,copy.background.x*rx));
    copy.background.y=Math.max(-300,Math.min(300,copy.background.y*ry));
  }
  copy.overlays ||= [];
  copy.pageLayoutVersion=2;
  return copy;
}
