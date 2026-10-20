export const effectDefaults={outline:false,outlineColor:'#000000',outlineWidth:.6,doubleOutline:false,outerOutlineColor:'#ffffff',outerOutlineWidth:.5,shadow:false,shadowColor:'#000000',shadowX:.8,shadowY:.8,shadowBlur:.5};
const recipe=patch=>({...effectDefaults,glow:false,fillPreset:'solid',bold:true,...patch});
export const textEffectPresets={
 white:{label:'白文字＋黒フチ・影',style:recipe({color:'#ffffff',outline:true,shadow:true})},
 yellow:{label:'黄色＋黒フチ・影',style:recipe({color:'#fff000',outline:true,outlineWidth:.8,shadow:true})},
 blue:{label:'青＋白黒の二重フチ',style:recipe({color:'#183db8',outline:true,outlineColor:'#ffffff',outlineWidth:.8,doubleOutline:true,outerOutlineColor:'#141414',outerOutlineWidth:.4,shadow:true})},
 pink:{label:'ピンク＋黒白の二重フチ',style:recipe({color:'#f25c9b',outline:true,outlineWidth:.5,doubleOutline:true,outerOutlineColor:'#ffffff',outerOutlineWidth:.7,shadow:true})},
 red:{label:'赤＋白フチ・光彩',style:recipe({color:'#d71920',outline:true,outlineColor:'#ffffff',outlineWidth:.5,glow:true,glowColor:'#ffffff',glowSize:1.5})},
 rainbow:{label:'レインボー全体＋白黒の二重フチ',style:recipe({color:'#ff261d',fillPreset:'rainbow-wide',gradientDirection:'auto',outline:true,outlineColor:'#ffffff',outlineWidth:.35,doubleOutline:true,outerOutlineColor:'#141414',outerOutlineWidth:.5,shadow:true})},
 gold:{label:'ゴールド＋黒フチ・影',style:recipe({color:'#ba8b20',fillPreset:'gold',outline:true,outlineWidth:.5,shadow:true})},
};
export const effectPanel=`
<div class="section"><h2>サムネイルの文字装飾</h2>
 <label class="field"><span class="label">装飾プリセット</span><select id="text-effect-preset"><option value="">プリセットを選ぶ</option>${Object.entries(textEffectPresets).map(([key,item])=>`<option value="${key}">${item.label}</option>`).join('')}</select></label>
 <p class="hint">色・太字・フチ・影をまとめて設定します。フォントとサイズはそのままです。文字を選ぶと、その部分だけに適用します。</p>
 <details id="text-effect-details"><summary>フチ・影を細かく調整</summary>
 <label class="check"><input id="outline" type="checkbox">くっきりした縁取り</label>
 <div class="row"><label for="outline-color" class="label">フチの色</label><input id="outline-color" class="color-input" type="color" aria-label="縁取りの色"></div>
 <label class="range-label" for="outline-width"><span>フチの太さ</span><output id="outline-width-value"></output></label><input id="outline-width" type="range" min="0.1" max="4" step="0.1">
 <label class="check"><input id="double-outline" type="checkbox">さらに外側を縁取る（二重フチ）</label>
 <div class="row"><label for="outer-outline-color" class="label">外側の色</label><input id="outer-outline-color" class="color-input" type="color" aria-label="外側の縁取りの色"></div>
 <label class="range-label" for="outer-outline-width"><span>外側の太さ</span><output id="outer-outline-width-value"></output></label><input id="outer-outline-width" type="range" min="0.1" max="4" step="0.1">
 <label class="check"><input id="text-shadow" type="checkbox">文字に影をつける</label>
 <div class="row"><label for="text-shadow-color" class="label">影の色</label><input id="text-shadow-color" class="color-input" type="color" aria-label="文字の影の色"></div>
 ${[['shadow-x','影の左右位置',-5,5,.1],['shadow-y','影の上下位置',-5,5,.1],['shadow-blur','影のぼかし',0,5,.1]].map(([id,label,min,max,step])=>`<label class="range-label" for="${id}"><span>${label}</span><output id="${id}-value"></output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}">`).join('')}
 <button id="clear-text-effects">フチ・影・光彩をはずす</button>
 </details>
</div>`;
export const effectInputs={'outline':'outline','double-outline':'doubleOutline','text-shadow':'shadow','outline-color':'outlineColor','outer-outline-color':'outerOutlineColor','text-shadow-color':'shadowColor','outline-width':'outlineWidth','outer-outline-width':'outerOutlineWidth','shadow-x':'shadowX','shadow-y':'shadowY','shadow-blur':'shadowBlur'};
