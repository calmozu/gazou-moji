// Shared colour recipes keep the editor and exported image consistent.
export const colorPresets={
  gold:{label:'ゴールド',stops:[[0,'#8b5a14'],[.22,'#d4a43d'],[.43,'#fff0ac'],[.5,'#f7d774'],[.56,'#a66b18'],[.8,'#e9bf54'],[1,'#885416']]},
  champagne:{label:'シャンパンゴールド',stops:[[0,'#9b7945'],[.35,'#f5e2b3'],[.48,'#fff6d9'],[.56,'#c6a56a'],[1,'#eed4a0']]},
  rose:{label:'ローズゴールド',stops:[[0,'#8f4f49'],[.35,'#e9a99e'],[.48,'#ffe1d2'],[.56,'#af6b62'],[1,'#e5afa0']]},
  silver:{label:'シルバー',stops:[[0,'#535d6c'],[.35,'#c9d1db'],[.48,'#f7fbff'],[.56,'#788594'],[1,'#cbd4df']]},
  rainbow:{label:'レインボー',stops:[[0,'#d53759'],[.2,'#e78b24'],[.4,'#d5b530'],[.6,'#278568'],[.8,'#3869bd'],[1,'#8e4ba6']]},
};
export function presetGradient(ctx,key,x0,y0,x1,y1){
  const recipe=colorPresets[key];if(!recipe)return null;
  const gradient=ctx.createLinearGradient(x0,y0,x1,y1);for(const [offset,color] of recipe.stops)gradient.addColorStop(offset,color);return gradient;
}
export function presetCSS(key){const recipe=colorPresets[key];return recipe?'linear-gradient(180deg, '+recipe.stops.map(([offset,color])=>`${color} ${offset*100}%`).join(', ')+')':'';}
