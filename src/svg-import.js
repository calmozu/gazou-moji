// SVGs are decoded in an image context, never inserted into the application's DOM.
// Scripts and external resources are not loaded by SVG-as-image; the editor stores PNG pixels.
export async function svgImageSource(file){
 let source=await file.text();
 if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source))throw new Error('このSVGには対応していない定義があります。PNGに変換してから選んでください。');
 // Illustrator and older SVG exporters often include an external SVG 1.1 DOCTYPE.
 // Drop that declaration; retain all drawing data without fetching its DTD.
 source=source.replace(/<!DOCTYPE[^>]*>/gi,'');
 const doc=new DOMParser().parseFromString(source,'image/svg+xml'),root=doc.documentElement;
 if(doc.querySelector('parsererror')||root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg')throw new Error('SVGファイルを読み込めませんでした。');
 if(root.querySelector('foreignObject'))throw new Error('HTMLを含むSVGは読み込めません。PNGに変換してから選んでください。');
 // A viewBox-only SVG has no fixed pixel dimensions. Resolve them explicitly
 // so browsers agree on its aspect ratio before rasterising it.
 const viewBox=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
 const units={px:1,pt:96/72,pc:16,mm:96/25.4,cm:96/2.54,in:96};
 const length=value=>{const match=(value||'').trim().match(/^([\d.]+)(px|pt|pc|mm|cm|in)?$/);return match?Number(match[1])*(units[match[2]||'px']):null;};
 let width=length(root.getAttribute('width')),height=length(root.getAttribute('height'));
 const hasBox=viewBox.length===4&&viewBox.every(Number.isFinite)&&viewBox[2]>0&&viewBox[3]>0;
 if(hasBox){if(!width&&!height){width=viewBox[2];height=viewBox[3];}else if(!width)width=height*viewBox[2]/viewBox[3];else if(!height)height=width*viewBox[3]/viewBox[2];}
 if(!width||!height||!Number.isFinite(width)||!Number.isFinite(height))throw new Error('大きさが指定されていないSVGです。viewBoxまたは幅と高さを設定してください。');
 if(!hasBox)root.setAttribute('viewBox',`0 0 ${width} ${height}`);
 // Rasterise vectors at the layer resolution, even when their source viewBox is small.
 const scale=2048/Math.max(width,height);root.setAttribute('width',String(Math.max(1,Math.round(width*scale))));root.setAttribute('height',String(Math.max(1,Math.round(height*scale))));
 // Remove active/foreign elements and external references as well as relying on
 // the browser's restricted SVG image context. Embedded PNG/JPEG/WebP and local symbols stay usable.
 root.querySelectorAll('script,iframe,object,embed').forEach(el=>el.remove());
 for(const el of [root,...root.querySelectorAll('*')])for(const attr of [...el.attributes]){
  if(/^on/i.test(attr.localName)){el.removeAttributeNode(attr);continue;}
  if(attr.localName==='href'&&!/^#|^data:image\/(png|jpeg|webp);base64,/i.test(attr.value))el.removeAttributeNode(attr);
 }
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(root));
}
