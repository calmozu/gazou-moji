export const borderPatterns={none:'なし',solid:'単色',dots:'水玉',stripes:'ストライプ',check:'チェック'};
export const borderDefaults={pattern:'none',color:'#ffffff',background:'#a18ae6',width:4,size:12};
export const borderPalettes={lavender:{label:'ラベンダー',color:'#ffffff',background:'#a18ae6'},pink:{label:'ピンク',color:'#ffffff',background:'#ed88b3'},mint:{label:'ミント',color:'#ffffff',background:'#6cc8b2'},gold:{label:'ゴールド',color:'#fff5bf',background:'#c68a21'},navy:{label:'ネイビー',color:'#ffffff',background:'#31456b'},mono:{label:'モノクロ',color:'#ffffff',background:'#30343b'}};
export function validBorder(v){return !!v&&Object.hasOwn(borderPatterns,v.pattern)&&['color','background'].every(k=>typeof v[k]==='string'&&/^#[0-9a-f]{6}$/i.test(v[k]))&&['width','size'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k])&&v[k]>=(k==='width'?0:2)&&v[k]<=(k==='width'?20:40));}
export function framePath(path,b,shape,inset=0){
 const x=b.x+inset,y=b.y+inset,w=b.width-2*inset,h=b.height-2*inset;
 if(shape==='ellipse'){path.moveTo(x+w,y+h/2);path.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);path.closePath();}
 else if(shape==='round')path.roundRect(x,y,w,h,Math.max(0,Math.min(b.width,b.height)*.12-inset));
 else path.rect(x,y,w,h);
}
const tiles=new Map();
function tileFor(border){
 const key=[border.pattern,border.color,border.background].join('|');if(tiles.has(key))return tiles.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=128;const ctx=tile.getContext('2d');ctx.fillStyle=border.background;ctx.fillRect(0,0,128,128);ctx.fillStyle=border.color;
 if(border.pattern==='dots'){for(const [x,y] of [[32,32],[96,96]]){ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.fill();}}
 else if(border.pattern==='check'){ctx.fillRect(0,0,64,64);ctx.fillRect(64,64,64,64);}
 else if(border.pattern==='stripes'){for(let x=-128;x<=128;x+=128){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+64,0);ctx.lineTo(x+192,128);ctx.lineTo(x+128,128);ctx.closePath();ctx.fill();}}
 tiles.set(key,tile);if(tiles.size>24)tiles.delete(tiles.keys().next().value);return tile;
}
export function paintImageBorder(ctx,b,crop){
 const border=crop?.border;if(!border||border.pattern==='none'||border.width===0)return;
 const short=Math.min(b.width,b.height),thickness=short*border.width/100,ring=new Path2D();framePath(ring,b,crop.shape);framePath(ring,b,crop.shape,thickness);
 ctx.save();ctx.clip(ring,'evenodd');
 if(border.pattern==='solid')ctx.fillStyle=border.color;
 else{const pattern=ctx.createPattern(tileFor(border),'repeat'),scale=short*border.size/100/128;pattern.setTransform(new DOMMatrix().translate(b.x,b.y).scale(scale));ctx.fillStyle=pattern;}
 ctx.fillRect(b.x,b.y,b.width,b.height);ctx.restore();
}
