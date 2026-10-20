// Shared colour recipes keep the editor and exported image consistent.
export const colorPresets={
  gold:{label:'ゴールド',stops:[[0,'#8b5a14'],[.22,'#d4a43d'],[.43,'#fff0ac'],[.5,'#f7d774'],[.56,'#a66b18'],[.8,'#e9bf54'],[1,'#885416']]},
  champagne:{label:'シャンパンゴールド',stops:[[0,'#9b7945'],[.35,'#f5e2b3'],[.48,'#fff6d9'],[.56,'#c6a56a'],[1,'#eed4a0']]},
  rose:{label:'ローズゴールド',stops:[[0,'#8f4f49'],[.35,'#e9a99e'],[.48,'#ffe1d2'],[.56,'#af6b62'],[1,'#e5afa0']]},
  silver:{label:'シルバー',stops:[[0,'#535d6c'],[.35,'#c9d1db'],[.48,'#f7fbff'],[.56,'#788594'],[1,'#cbd4df']]},
  'rainbow-wide':{label:'レインボー（文字全体）',scope:'text',stops:[[0,'#ff261d'],[.18,'#ffb000'],[.33,'#f3ed00'],[.5,'#00be5b'],[.68,'#00a5f3'],[.84,'#5947e9'],[1,'#cd20b5']]},
  rainbow:{label:'レインボー（1文字ずつ）',stops:[[0,'#d53759'],[.2,'#e78b24'],[.4,'#d5b530'],[.6,'#278568'],[.8,'#3869bd'],[1,'#8e4ba6']]},
};
export function presetGradient(ctx,key,x0,y0,x1,y1){
  const recipe=colorPresets[key];if(!recipe)return null;
  const gradient=ctx.createLinearGradient(x0,y0,x1,y1);for(const [offset,color] of recipe.stops)gradient.addColorStop(offset,color);return gradient;
}
export const gradientDirections={vertical:'縦（上から下）',horizontal:'横（左から右）',diagonal:'斜め（左上から右下）',rising:'斜め（左下から右上）'};
export function resolvedGradientDirection(style,vertical=false){return Object.hasOwn(gradientDirections,style.gradientDirection)?style.gradientDirection:colorPresets[style.fillPreset]?.scope==='text'?(vertical?'vertical':'horizontal'):'vertical';}
export function gradientPoints({left,top,right,bottom},direction){
 const x=(left+right)/2,y=(top+bottom)/2;
 return {vertical:[x,top,x,bottom],horizontal:[left,y,right,y],diagonal:[left,top,right,bottom],rising:[left,bottom,right,top]}[direction];
}
export function presetCSS(key,direction){const recipe=colorPresets[key],angle={vertical:180,horizontal:90,diagonal:135,rising:45}[direction]??(recipe?.scope==='text'?90:180);return recipe?`linear-gradient(${angle}deg, `+recipe.stops.map(([offset,color])=>`${color} ${offset*100}%`).join(', ')+')':'';}
