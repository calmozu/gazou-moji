import {cutoutPixels} from './cutout-pixels.js';
self.onmessage=({data})=>{try{const pixels=cutoutPixels(data);self.postMessage({id:data.id,pixels},[pixels.buffer]);}catch(error){self.postMessage({id:data.id,error:error.message});}};
