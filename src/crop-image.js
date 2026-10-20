import {validBorder,paintImageBorder} from './image-border.js';
export const cropDefaults={shape:'rect',zoom:1,x:0,y:0};
export function validCrop(v){return !!v&&(v.border==null||validBorder(v.border))&&['rect','round','ellipse'].includes(v.shape)&&['zoom','x','y'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k])&&v[k]>=(k==='zoom'?1:-1)&&v[k]<=(k==='zoom'?5:1));}
export function cropImageRect(image,b,crop=cropDefaults){
 const scale=Math.max(b.width/image.width,b.height/image.height)*crop.zoom,width=image.width*scale,height=image.height*scale;
 return {x:b.x+(b.width-width)/2+crop.x*(width-b.width)/2,y:b.y+(b.height-height)/2+crop.y*(height-b.height)/2,width,height};
}
export function drawOverlayImage(ctx,image,b,crop){
 ctx.save();
 if(crop){ctx.beginPath();if(crop.shape==='ellipse')ctx.ellipse(b.x+b.width/2,b.y+b.height/2,b.width/2,b.height/2,0,0,Math.PI*2);else if(crop.shape==='round')ctx.roundRect(b.x,b.y,b.width,b.height,Math.min(b.width,b.height)*.12);else ctx.rect(b.x,b.y,b.width,b.height);ctx.clip();}
 const r=crop?cropImageRect(image,b,crop):b;ctx.drawImage(image,r.x,r.y,r.width,r.height);ctx.restore();
 if(crop)paintImageBorder(ctx,b,crop);
}
export function overlayPNGCanvas(image,item){
 const canvas=document.createElement('canvas');
 if(item.crop){const scale=Math.min(image.width/item.width,image.height/item.height);canvas.width=Math.max(1,Math.round(item.width*scale));canvas.height=Math.max(1,Math.round(item.height*scale));}else{canvas.width=image.width;canvas.height=image.height;}
 drawOverlayImage(canvas.getContext('2d'),image,{x:0,y:0,width:canvas.width,height:canvas.height},item.crop);return canvas;
}
