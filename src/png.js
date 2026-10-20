// Canvas PNGs have no reliable print resolution. Add a standard pHYs chunk
// without altering the encoded pixels, so 300 dpi corresponds to A4 on import.
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export async function pngWithDpi(canvas,dpi=300){
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNGを生成できませんでした。')),'image/png'));
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),parts=[bytes.slice(0,8)];
  const chunk=new Uint8Array(21),cv=new DataView(chunk.buffer);cv.setUint32(0,9);chunk.set([112,72,89,115],4);cv.setUint32(8,Math.round(dpi/0.0254));cv.setUint32(12,Math.round(dpi/0.0254));chunk[16]=1;cv.setUint32(17,crc32(chunk.subarray(4,17)));
  let inserted=false;
  for(let offset=8;offset<bytes.length;){
    const length=view.getUint32(offset),type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(type==='IDAT'&&!inserted){parts.push(chunk);inserted=true;}
    if(type!=='pHYs')parts.push(bytes.slice(offset,offset+length+12));
    offset+=length+12;
  }
  return new Blob(parts,{type:'image/png'});
}
