// Work from the original RGBA pixels on every adjustment, preserving source alpha.
export function cutoutPixels({width,height,pixels,settings,person}){
 const count=width*height,mask=new Float32Array(count),rgb=settings.color.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16));
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 if(settings.mode==='person'){
  const threshold=.15+settings.strength*.007;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const px=x*(person.width-1)/Math.max(1,width-1),py=y*(person.height-1)/Math.max(1,height-1),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(x0+1,person.width-1),y1=Math.min(y0+1,person.height-1),fx=px-x0,fy=py-y0;
   const p=((person.data[y0*person.width+x0]*(1-fx)+person.data[y0*person.width+x1]*fx)*(1-fy)+(person.data[y1*person.width+x0]*(1-fx)+person.data[y1*person.width+x1]*fx)*fy)/255;
   mask[y*width+x]=smooth(threshold-.08,threshold+.08,p);
  }
 }else{
  const threshold=settings.tolerance*4.41673,transition=Math.max(2,threshold*.2);
  for(let i=0;i<count;i++){const j=i*4,distance=Math.hypot(pixels[j]-rgb[0],pixels[j+1]-rgb[1],pixels[j+2]-rgb[2]);mask[i]=smooth(threshold,threshold+transition,distance);}
  if(settings.connected){
   const seen=new Uint8Array(count),queue=new Int32Array(count);let start=0,end=0;
   const add=i=>{if(!seen[i]&&(mask[i]<1||pixels[i*4+3]===0)){seen[i]=1;queue[end++]=i;}};
   for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
   while(start<end){const i=queue[start++],x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<count-width)add(i+width);}
   for(let i=0;i<count;i++)if(!seen[i])mask[i]=1;
  }
 }
 const radius=Math.round(settings.feather);
 if(radius>0){
  const horizontal=new Float32Array(count),blurred=new Float32Array(count),size=radius*2+1;
  for(let y=0;y<height;y++){let sum=0;for(let x=-radius;x<=radius;x++)sum+=mask[y*width+Math.max(0,Math.min(width-1,x))];for(let x=0;x<width;x++){horizontal[y*width+x]=sum/size;sum+=mask[y*width+Math.min(width-1,x+radius+1)]-mask[y*width+Math.max(0,x-radius)];}}
  for(let x=0;x<width;x++){let sum=0;for(let y=-radius;y<=radius;y++)sum+=horizontal[Math.max(0,Math.min(height-1,y))*width+x];for(let y=0;y<height;y++){blurred[y*width+x]=sum/size;sum+=horizontal[Math.min(height-1,y+radius+1)*width+x]-horizontal[Math.max(0,y-radius)*width+x];}}
  for(let i=0;i<count;i++)mask[i]=Math.min(mask[i],blurred[i]);
 }
 for(let i=0;i<count;i++){
  const j=i*4,a=mask[i];
  if(settings.mode==='color'&&a>0&&a<1)for(let c=0;c<3;c++)pixels[j+c]=Math.max(0,Math.min(255,(pixels[j+c]-rgb[c]*(1-a))/a));
  pixels[j+3]=Math.round(pixels[j+3]*a);
 }
 return pixels;
}
