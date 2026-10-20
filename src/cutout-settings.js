export function validCutout(v){return !!v&&['color','person'].includes(v.mode)&&/^#[0-9a-f]{6}$/i.test(v.color)&&['tolerance','strength'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k])&&v[k]>=0&&v[k]<=100)&&typeof v.feather==='number'&&Number.isFinite(v.feather)&&v.feather>=0&&v.feather<=10&&typeof v.connected==='boolean';}
// Count serialized image data, including originals, to keep saved projects bounded.
export function imageSourceBudget(items){return items.reduce((sum,item)=>sum+item.src.length+(item.originalSrc?.length||0),0);}
