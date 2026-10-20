import {mkdir,readdir,copyFile} from 'node:fs/promises';

const source=new URL('../node_modules/@mediapipe/selfie_segmentation/',import.meta.url),target=new URL('../public/vendor/selfie-segmentation/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of await readdir(source))if(/\.(js|wasm|data|tflite|binarypb)$/.test(file))await copyFile(new URL(file,source),new URL(file,target));
console.log('Person cutout assets ready');
