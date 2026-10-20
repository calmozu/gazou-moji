export const backlightDefaults={backlight:false,backlightPattern:'halo-rays',backlightColor:'#ffd05a',backlightStrength:70,backlightSpread:1};
export const backlightPatterns={'halo-rays':'後光＋短い放射光',halo:'やわらかい後光',rays:'放射光'};
export const backlightPresets={
 gold:{label:'金色の後光＋放射光',style:{...backlightDefaults,backlight:true}},
 white:{label:'白い後光＋放射光',style:{...backlightDefaults,backlight:true,backlightColor:'#fff6df'}},
 pink:{label:'ピンクの後光＋放射光',style:{...backlightDefaults,backlight:true,backlightColor:'#ff91cf'}},
 blue:{label:'青い後光＋放射光',style:{...backlightDefaults,backlight:true,backlightColor:'#79cbff'}},
};
export const backlightInputs={'backlight':'backlight','backlight-pattern':'backlightPattern','backlight-color':'backlightColor','backlight-strength':'backlightStrength','backlight-spread':'backlightSpread'};
export const backlightPanel=`
<div class="section"><h2>後光・放射光</h2>
 <label class="field"><span class="label">光のプリセット</span><select id="backlight-preset"><option value="">プリセットを選ぶ</option>${Object.entries(backlightPresets).map(([key,preset])=>`<option value="${key}">${preset.label}</option>`).join('')}</select></label>
 <p class="hint">文字の後ろから光が広がります。文字の色・フォント・フチと組み合わせられます。文字を選ぶと、その部分だけに適用します。</p>
 <details id="backlight-details"><summary>光を細かく調整</summary>
  <label class="check"><input id="backlight" type="checkbox">後光・放射光をつける</label>
  <label class="field"><span class="label">光のパターン</span><select id="backlight-pattern">${Object.entries(backlightPatterns).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>
  <div class="row"><label for="backlight-color" class="label">光の色</label><input id="backlight-color" type="color" class="color-input" aria-label="後光・放射光の色"></div>
  <label class="range-label" for="backlight-strength"><span>光の強さ</span><output id="backlight-strength-value"></output></label><input id="backlight-strength" type="range" min="0" max="100" step="1">
  <label class="range-label" for="backlight-spread"><span>光の広がり</span><output id="backlight-spread-value"></output></label><input id="backlight-spread" type="range" min="0.3" max="3" step="0.1">
 </details>
 <button id="remove-backlight" class="quiet">後光・放射光をはずす</button>
</div>`;

function tint(color,alpha,white=0){const values=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).map(v=>Math.round(v+(255-v)*white));return `rgba(${values.join(',')},${alpha})`;}
const variation=i=>{const value=Math.sin(i*12.9898+7.31)*43758.5453;return value-Math.floor(value);};

export function drawBacklights(ctx,placements,{withGlyph,scale}){
 const groups=[];let current=null;
 for(const glyph of placements){
  const style={...backlightDefaults,...glyph.style};for(const key of Object.keys(backlightDefaults))if(style[key]==null)style[key]=backlightDefaults[key];
  if(!style.backlight||!style.backlightStrength){current=null;continue;}
  if(!glyph.char.trim())continue;
  const key=JSON.stringify([glyph.line,style.backlightPattern,style.backlightColor,style.backlightStrength,style.backlightSpread]);
  if(!current||current.key!==key){current={key,style,glyphs:[],left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity,size:0};groups.push(current);}
  current.glyphs.push(glyph);current.size=Math.max(current.size,glyph.size);
  withGlyph(glyph,s=>{
   const metrics=ctx.measureText(glyph.char),transform=ctx.getTransform(),margin=s.outline?s.outlineWidth+(s.doubleOutline?s.outerOutlineWidth:0):0;
   for(const [x,y] of [[-metrics.actualBoundingBoxLeft,-metrics.actualBoundingBoxAscent],[metrics.actualBoundingBoxRight,-metrics.actualBoundingBoxAscent],[-metrics.actualBoundingBoxLeft,metrics.actualBoundingBoxDescent],[metrics.actualBoundingBoxRight,metrics.actualBoundingBoxDescent]]){
    const point=transform.transformPoint({x,y});current.left=Math.min(current.left,point.x/scale-margin);current.right=Math.max(current.right,point.x/scale+margin);current.top=Math.min(current.top,point.y/scale-margin);current.bottom=Math.max(current.bottom,point.y/scale+margin);
   }
  });
 }
 for(const group of groups){
  const s=group.style,strength=s.backlightStrength/100,cx=(group.left+group.right)/2,cy=(group.top+group.bottom)/2;
  const width=Math.max(group.size*.25,group.right-group.left),height=Math.max(group.size*.25,group.bottom-group.top),reach=group.size*.5*s.backlightSpread;
  ctx.save();
  if(s.backlightPattern!=='rays'){
   ctx.save();ctx.translate(cx,cy);ctx.scale(width/2+reach,height/2+reach);
   const wash=ctx.createRadialGradient(0,0,0,0,0,1);wash.addColorStop(0,tint(s.backlightColor,strength*.18,.5));wash.addColorStop(.55,tint(s.backlightColor,strength*.25));wash.addColorStop(1,tint(s.backlightColor,0));ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  if(s.backlightPattern!=='halo'){
   ctx.shadowColor=tint(s.backlightColor,strength*.65);ctx.shadowBlur=group.size*.06*scale;
   const count=Math.min(80,Math.max(24,Math.round(width/group.size*8))),rx=width/2,ry=height/2;
   for(let i=0;i<count;i++){
    const angle=(i+.12+variation(i)*.35)/count*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle);
    const nx=cos/Math.max(rx,.1),ny=sin/Math.max(ry,.1),length=Math.hypot(nx,ny),dx=nx/length,dy=ny/length;
    const x=cx+cos*rx,y=cy+sin*ry,extent=reach*(.45+variation(i+100)*.65),half=group.size*(.025+variation(i+200)*.045),startX=x-dx*extent*.3,startY=y-dy*extent*.3,endX=x+dx*extent,endY=y+dy*extent;
    const ray=ctx.createLinearGradient(startX,startY,endX,endY);ray.addColorStop(0,tint(s.backlightColor,strength*.9,.85));ray.addColorStop(.25,tint(s.backlightColor,strength*.8,.1));ray.addColorStop(.65,tint(s.backlightColor,strength*.45));ray.addColorStop(1,tint(s.backlightColor,0));
    ctx.fillStyle=ray;ctx.beginPath();ctx.moveTo(startX-dy*half,startY+dx*half);ctx.lineTo(endX,endY);ctx.lineTo(startX+dy*half,startY-dx*half);ctx.closePath();ctx.fill();
   }
  }
  ctx.restore();
  if(s.backlightPattern!=='rays')for(const glyph of group.glyphs)withGlyph(glyph,style=>{
   ctx.globalAlpha=strength*.8;ctx.fillStyle=tint(s.backlightColor,.85,.65);ctx.shadowColor=s.backlightColor;ctx.shadowBlur=glyph.size*.38*s.backlightSpread*scale;
   ctx.fillText(glyph.char,0,0);ctx.fillText(glyph.char,0,0);ctx.fillText(glyph.char,0,0);
  });
 }
}

export function validBacklight(style){
 return (style.backlight==null||typeof style.backlight==='boolean')&&(style.backlightPattern==null||typeof style.backlightPattern==='string'&&Object.hasOwn(backlightPatterns,style.backlightPattern))&&(style.backlightColor==null||typeof style.backlightColor==='string'&&/^#[0-9a-f]{6}$/i.test(style.backlightColor))&&(style.backlightStrength==null||typeof style.backlightStrength==='number'&&Number.isFinite(style.backlightStrength)&&style.backlightStrength>=0&&style.backlightStrength<=100)&&(style.backlightSpread==null||typeof style.backlightSpread==='number'&&Number.isFinite(style.backlightSpread)&&style.backlightSpread>=.3&&style.backlightSpread<=3);
}
