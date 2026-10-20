import { colorPresets } from './presets.js';
export const paperFillDefaults={mode:'solid',preset:'sky',pattern:'vertical',reverse:false};
export const paperPalettes={
 sky:{label:'空色',stops:[[0,'#b8dfff'],[1,'#f5faff']]},
 ocean:{label:'海',stops:[[0,'#063c73'],[.5,'#168dba'],[1,'#bcece5']]},
 sunset:{label:'夕焼け',stops:[[0,'#6551a3'],[.45,'#e8829b'],[1,'#ffcb8a']]},
 sakura:{label:'さくら',stops:[[0,'#ed9bc5'],[.5,'#f9d9ea'],[1,'#fff5f8']]},
 mint:{label:'ミント',stops:[[0,'#9fd7c2'],[.5,'#d0e9d4'],[1,'#f7f6d9']]},
 midnight:{label:'夜空',stops:[[0,'#111a38'],[.55,'#38336b'],[1,'#7775b8']]},
 gold:{label:'ゴールド',stops:colorPresets.gold.stops},
 silver:{label:'シルバー',stops:colorPresets.silver.stops},
};
export const paperPatterns={vertical:'縦（上から下）',horizontal:'横（左から右）',diagonal:'斜め（左上から右下）',rising:'斜め（左下から右上）',radial:'中心から広がる',mirror:'中央で折り返す',bands:'繰り返す帯'};
export const paperPanel=`
<div class="section"><p class="eyebrow">COLOURS</p><h2>色から、背景をつくる。</h2>
 <div class="segmented" role="group" aria-label="背景の色の種類"><button data-paper-mode="solid">単色</button><button data-paper-mode="gradient">グラデーション</button></div>
 <div id="paper-solid-controls"><div class="row" style="margin-top:14px"><label for="background-color" class="label">背景の色</label><input id="background-color" type="color" class="color-input" aria-label="単色の背景色"></div>
  <div class="paper-swatches" role="group" aria-label="単色の背景色の候補">${[['#ffffff','白'],['#141414','黒'],['#263348','紺'],['#f5ead3','クリーム'],['#f4c8df','ピンク'],['#b8dfff','水色'],['#b8ddc8','ミント'],['#dad4ee','ラベンダー']].map(([color,name])=>`<button data-paper-color="${color}" style="background:${color}" aria-label="背景を${name}にする" title="${name}"></button>`).join('')}</div>
 </div>
 <div id="paper-gradient-controls" hidden>
  <label class="field"><span class="label">色のプリセット</span><select id="paper-palette">${Object.entries(paperPalettes).map(([key,item])=>`<option value="${key}">${item.label}</option>`).join('')}</select></label>
  <label class="field"><span class="label">グラデーションのパターン</span><select id="paper-pattern">${Object.entries(paperPatterns).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>
  <label class="check"><input id="paper-reverse" type="checkbox">色の順番を反転</label>
 </div>
 <img id="paper-fill-preview" class="paper-fill-preview" alt="背景の色とパターンの見本">
 <p class="hint">画像がなくても、この背景に文字やロゴを重ねられます。背景画像がある場合は、その下地になります。</p>
</div>`;
export function paintPaper(ctx,state,w,h){
 const fill={...paperFillDefaults,...state.paperFill};
 ctx.save();
 if(fill.mode!=='gradient'){ctx.fillStyle=state.paper;ctx.fillRect(0,0,w,h);ctx.restore();return;}
 // Normalised coordinates keep each pattern stable across page sizes and export resolutions.
 ctx.scale(w,h);let gradient;
 if(fill.pattern==='radial')gradient=ctx.createRadialGradient(.5,.5,0,.5,.5,Math.SQRT1_2);
 else{const coords={vertical:[0,0,0,1],horizontal:[0,0,1,0],diagonal:[0,0,1,1],rising:[0,1,1,0],mirror:[0,0,1,0],bands:[0,0,1,1]}[fill.pattern];gradient=ctx.createLinearGradient(...coords);}
 const stops=paperPalettes[fill.preset].stops.map(([offset,color])=>[fill.reverse?1-offset:offset,color]).sort((a,b)=>a[0]-b[0]);
 if(fill.pattern==='mirror'){for(const [offset,color] of stops){gradient.addColorStop(offset/2,color);gradient.addColorStop(1-offset/2,color);}}
 else if(fill.pattern==='bands'){for(let band=0;band<4;band++)for(const [offset,color] of stops)gradient.addColorStop((band+(band%2?1-offset:offset))/4,color);}
 else for(const [offset,color] of stops)gradient.addColorStop(offset,color);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,1,1);ctx.restore();
}
export function validPaperFill(value){return value&&typeof value==='object'&&['solid','gradient'].includes(value.mode)&&Object.hasOwn(paperPalettes,value.preset)&&Object.hasOwn(paperPatterns,value.pattern)&&typeof value.reverse==='boolean';}
