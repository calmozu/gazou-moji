export const families = {
  sans: '"Noto Sans JP", sans-serif',
  serif: '"Noto Serif JP", serif',
  round: '"Zen Maru Gothic", sans-serif',
  textbook: '"Klee One", serif',
};
export const baseStyle = { family: 'sans', size: 24, bold: false, color: '#252923', glow: false, glowColor: '#ffffff', glowSize: 1.5 };
export function dimensions(state) { return state.orientation === 'portrait' ? [210, 297] : [297, 210]; }
export function textBounds(state) {
  const [w,h]=dimensions(state), m=state.margins;
  const b=state.textBox || {x:m.left,y:m.top,width:w-m.left-m.right,height:h-m.top-m.bottom};
  const width=Math.max(20,Math.min(w,b.width)), height=Math.max(20,Math.min(h,b.height));
  return {x:Math.max(0,Math.min(w-width,b.x)),y:Math.max(0,Math.min(h-height,b.y)),width,height};
}
export function initialState() {
  return { version: 1, title: '無題のかさね', text: '', styles: [], style: { ...baseStyle }, orientation: 'portrait', vertical: false, align: 'left', lineHeight: 1.65,
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
export function render(canvas, state, image, { dpi = 120 } = {}) {
  const [w,h] = dimensions(state), scale = dpi/25.4;
  canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale);
  const ctx = canvas.getContext('2d'); ctx.scale(scale,scale);
  ctx.fillStyle = state.paper; ctx.fillRect(0,0,w,h);
  if (image) {
    const r = backgroundRect(state,image);
    ctx.save(); ctx.globalAlpha = state.background.opacity/100; ctx.drawImage(image,r.x,r.y,r.w,r.h); ctx.restore();
  }
  const box=textBounds(state), maxLength=state.vertical ? box.height : box.width;
  const lines = []; let line = [], length = 0, largest = 0;
  function finish() { lines.push({ glyphs: line, length, size: largest || state.style.size*25.4/72 }); line=[]; length=0; largest=0; }
  for (const {segment: char,index} of segmenter.segment(state.text)) {
    if (char === '\n') { finish(); continue; }
    const style = { ...state.style, ...state.styles[index] };
    const size = font(ctx,style), advance = state.vertical ? size : ctx.measureText(char).width;
    if (line.length && length+advance>maxLength && !noStart.test(char)) finish();
    line.push({ char, style, size, advance }); length+=advance; largest=Math.max(largest,size);
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
      const x = state.vertical ? cross-l.size/2 : along, y = state.vertical ? along+g.size/2 : cross+l.size*.88;
      placements.push({ ...g,x,y }); along+=g.advance;
    }
    cross += state.vertical ? -extent : extent;
  }
  // Clip to the page, not the text box: soft glow may extend into the margins.
  for (const g of placements) {
    ctx.save(); font(ctx,g.style); ctx.fillStyle=g.style.color;
    ctx.translate(g.x,g.y);
    if (state.vertical) {
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if (/^[\u0020-\u007eー〜…―—（）［］「」『』【】]$/u.test(g.char)) ctx.rotate(Math.PI/2);
      else if (/^[、。，．]$/u.test(g.char)) ctx.translate(g.size*.28,-g.size*.28);
    } else { ctx.textAlign='left'; ctx.textBaseline='alphabetic'; }
    if (g.style.glow) {
      ctx.shadowColor=g.style.glowColor; ctx.shadowBlur=g.style.glowSize*scale;
      ctx.fillText(g.char,0,0); ctx.fillText(g.char,0,0);
      ctx.shadowBlur=0;
      ctx.strokeStyle=g.style.glowColor; ctx.lineJoin='round'; ctx.lineWidth=g.style.glowSize*.28;
      ctx.strokeText(g.char,0,0);
    }
    ctx.fillText(g.char,0,0); ctx.restore();
  }
  return { overflow, lines: lines.length, glyphs: placements.length };
}
export function validateProject(value) {
  const s = value;
  const num=(v,a,b)=>typeof v==='number' && Number.isFinite(v) && v>=a && v<=b;
  const color=v=>typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
  const validStyle=v=>v && Object.hasOwn(families,v.family) && num(v.size,6,200) && typeof v.bold==='boolean' && color(v.color) && typeof v.glow==='boolean' && color(v.glowColor) && num(v.glowSize,0.2,6);
  if (!s || s.version!==1 || typeof s.title!=='string' || s.title.length>100 || typeof s.text!=='string' || s.text.length>30000 || !['portrait','landscape'].includes(s.orientation) || typeof s.vertical!=='boolean' || !['left','center','right'].includes(s.align) || !num(s.lineHeight,1,3) || !color(s.paper) || !validStyle(s.style) || !Array.isArray(s.styles) || s.styles.length>s.text.length || !s.styles.every(v=>v===null || validStyle(v)) || !s.margins || !['top','right','bottom','left'].every(k=>num(s.margins[k],0,70))) throw new Error('対応していない原稿ファイルです。');
  if (s.textBox!=null) {
    const t=s.textBox,[w,h]=dimensions(s);
    if (!num(t.x,0,w)||!num(t.y,0,h)||!num(t.width,20,w)||!num(t.height,20,h)||t.x+t.width>w+.0001||t.y+t.height>h+.0001) throw new Error('文字枠の位置や大きさを読み込めません。');
  }
  const b=s.background;
  if (!b || typeof b.src!=='string' || b.src.length>25000000 || (b.src && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.src)) || !['cover','contain','width','height'].includes(b.fit) || !num(b.opacity,0,100) || !num(b.zoom,1,5) || !num(b.x,-1000,1000) || !num(b.y,-1000,1000)) throw new Error('背景画像の設定を読み込めません。');
  return structuredClone(s);
}
