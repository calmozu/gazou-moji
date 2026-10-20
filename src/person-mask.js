let libraryPromise,modelPromise,queue=Promise.resolve();
const assetRoot=()=>new URL(`${import.meta.env.BASE_URL}vendor/selfie-segmentation/`,document.baseURI);
function loadLibrary(){
 if(globalThis.SelfieSegmentation)return Promise.resolve();
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('selfie_segmentation.js',assetRoot()).href;script.onload=()=>globalThis.SelfieSegmentation?resolve():reject(new Error('人物判別用データを読み込めませんでした。'));script.onerror=()=>{script.remove();libraryPromise=null;reject(new Error('人物判別用データを読み込めませんでした。通信を確認してください。'));};document.head.append(script);});
 return libraryPromise;
}
async function model(){
 if(!modelPromise)modelPromise=(async()=>{await loadLibrary();const instance=new globalThis.SelfieSegmentation({locateFile:file=>new URL(file,assetRoot()).href});instance.setOptions({modelSelection:0,selfieMode:false});await instance.initialize();return instance;})().catch(error=>{modelPromise=null;throw error;});
 return modelPromise;
}
export function personMask(image){
 const run=async()=>{
  const instance=await model(),ratio=Math.min(1,1024/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((image.naturalWidth||image.width)*ratio));canvas.height=Math.max(1,Math.round((image.naturalHeight||image.height)*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  let result;
  instance.onResults(results=>{
   const mask=document.createElement('canvas');mask.width=canvas.width;mask.height=canvas.height;mask.getContext('2d').drawImage(results.segmentationMask,0,0,mask.width,mask.height);const rgba=mask.getContext('2d').getImageData(0,0,mask.width,mask.height).data;
   let minAlpha=255,minRed=255,maxRed=0;for(let i=0;i<rgba.length;i+=4){minAlpha=Math.min(minAlpha,rgba[i+3]);minRed=Math.min(minRed,rgba[i]);maxRed=Math.max(maxRed,rgba[i]);}
   const channel=minAlpha===255&&maxRed>minRed?0:3,data=new Uint8ClampedArray(mask.width*mask.height);for(let i=0;i<data.length;i++)data[i]=rgba[i*4+channel];result={width:mask.width,height:mask.height,data};
  });
  await instance.send({image:canvas});if(!result)throw new Error('人物を判別できませんでした。別の画像でお試しください。');
  let kept=0;for(const alpha of result.data)if(alpha>127)kept++;if(kept<result.data.length*.005)throw new Error('人物が見つかりませんでした。顔や体が大きく写った画像を選んでください。');return result;
 };
 const result=queue.then(run,run);queue=result.catch(()=>{});return result;
}
