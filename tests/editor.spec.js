import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

async function ready(page){await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-ready','true');}
async function project(page){const event=page.waitForEvent('download');await page.locator('#save-project').click();const file=await event;expect(file.suggestedFilename()).toMatch(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.kasane$/);return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
async function background(page){
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=200;const ctx=c.getContext('2d');ctx.fillStyle='#e6bc7b';ctx.fillRect(0,0,200,200);ctx.fillStyle='#315e48';ctx.fillRect(200,0,200,200);return c.toDataURL().split(',')[1];});
  await page.locator('#image-file').setInputFiles({name:'background.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#bg-thumb')).toHaveAttribute('src',/^data:image/);
}
async function range(page,id,value){await page.locator(id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);}

test('blank A4, Japanese fonts, responsive layout, no application errors',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await expect(page.locator('#margin-top')).toHaveValue('20');
  const result=await page.evaluate(()=>{const c=document.querySelector('canvas'),ctx=c.getContext('2d');return {size:[c.width,c.height],pixel:[...ctx.getImageData(10,10,1,1).data],font:document.fonts.check('400 24px "Noto Sans JP"','写真')};});
  expect(result.size).toEqual([992,1403]);expect(result.pixel).toEqual([255,255,255,255]);expect(result.font).toBe(true);
  await page.screenshot({path:info.outputPath('desktop.png')});expect(errors).toEqual([]);
});

test('selection survives controls, size buttons apply immediately, undo and redo restore styles',async({page})=>{
  await ready(page);await page.locator('#text').fill('春の便り\nまた会いましょう。');
  await page.locator('#text').evaluate(el=>{el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new Event('select'));});
  await page.locator('#larger').click();await expect(page.locator('#size')).toHaveValue('26');
  await page.locator('#size').fill('36');await page.locator('#size').press('Enter');
  await page.locator('#bold').click();await page.locator('#glow').check();
  let s=await project(page);expect(s.styles[0]).toMatchObject({size:36,bold:true,glow:true});expect(s.styles[1].size).toBe(36);expect(s.styles[2].size).toBe(24);
  await page.locator('#undo').click();s=await project(page);expect(s.styles[0].glow).toBe(false);
  await page.locator('#redo').click();s=await project(page);expect(s.styles[0].glow).toBe(true);
  await expect(page.locator('#text')).toHaveValue('春の便り\nまた会いましょう。');
});

test('background fitting, opacity, drag and auto-save survive reload',async({page})=>{
  await ready(page);await background(page);await page.locator('#tab-background').click();await page.locator('#fit').selectOption('contain');
  await range(page,'#opacity',55);await range(page,'#zoom',1.5);
  const box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20);await page.mouse.up();
  const s=await project(page);expect(s.background).toMatchObject({fit:'contain',opacity:55,zoom:1.5});expect(s.background.x).toBeGreaterThan(0);
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');
  const restored=await project(page);expect(restored).toEqual(s);
});

test('glow is rasterized in preview, 300 dpi PNG and A4 PDF',async({page},info)=>{
  await page.clock.setFixedTime(new Date('2026-10-20T05:30:45Z'));
  await ready(page);await page.locator('#title').fill('春:手紙/案');await page.locator('#title').press('Tab');await page.locator('#text').fill('光を重ねる。\nKasane');await page.locator('#glow').check();
  await page.locator('#glow-color').evaluate(el=>{el.value='#ff0000';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const redPixels=()=>page.locator('#canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>d[i+1]+25&&d[i]>d[i+2]+25)n++;return n;});
  await expect.poll(redPixels).toBeGreaterThan(100);
  await page.locator('#export-button').click();await expect(page.locator('#export-dialog')).toBeVisible();
  let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let download=await event;expect(download.suggestedFilename()).toBe('春_手紙_案_2026-10-20_14-30-45.png');await download.saveAs(info.outputPath('glow.png'));
  await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();download=await event;expect(download.suggestedFilename()).toBe('春_手紙_案_2026-10-20_14-30-45.pdf');await download.saveAs(info.outputPath('glow.pdf'));
  const bytes=await fs.readFile(info.outputPath('glow.png'));expect(bytes.readUInt32BE(16)).toBe(2480);expect(bytes.readUInt32BE(20)).toBe(3508);
  const phys=bytes.indexOf(Buffer.from('pHYs'));expect(phys).toBeGreaterThan(0);expect(bytes.readUInt32BE(phys+4)).toBe(11811);expect(bytes.readUInt32BE(phys+8)).toBe(11811);
  const pdf=(await fs.readFile(info.outputPath('glow.pdf'))).toString('latin1');expect(pdf).toMatch(/^%PDF-/);expect(pdf).toContain('/Subtype /Image');const box=pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);expect(Number(box[1])).toBeCloseTo(595.28,2);expect(Number(box[2])).toBeCloseTo(841.89,2);
});

test('vertical landscape exports and overflow warning reflect actual page',async({page},info)=>{
  await ready(page);await page.locator('#text').fill('「春の便り」\nまた、会いましょう。\nHELLO 2026');await page.locator('#vertical').check();await page.locator('#family').selectOption('serif');await page.locator('#tab-page').click();await page.locator('[data-orientation=landscape]').click();
  await expect(page.locator('#page-meta')).toContainText('297 × 210');await expect(page.locator('#overflow')).toBeHidden();
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('vertical.png'));
  const bytes=await fs.readFile(info.outputPath('vertical.png'));expect(bytes.readUInt32BE(16)).toBe(3508);expect(bytes.readUInt32BE(20)).toBe(2480);
  await page.locator('#close-export').click();await page.locator('#tab-text').click();await page.locator('#text').fill('あいうえお'.repeat(1500));await expect(page.locator('#overflow')).toBeVisible();
});

test('project roundtrip restores Japanese text and image; malformed files preserve current work',async({page})=>{
  await ready(page);await page.locator('#text').fill('大切なことば');await background(page);const s=await project(page);
  await page.locator('#text').fill('変更しました');await page.locator('#project-file').setInputFiles({name:'saved.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await expect(page.locator('#text')).toHaveValue('大切なことば');
  await page.locator('#project-file').setInputFiles({name:'invalid.kasane',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});await expect(page.locator('#toast')).toContainText('原稿を開けません');await expect(page.locator('#text')).toHaveValue('大切なことば');
});

test('mobile layout and iPad touch pinch synchronize image zoom',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();await ready(page);await background(page);await page.locator('#tab-background').click();
  const box=await page.locator('#canvas').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2,cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-40,y:cy,id:0},{x:cx+40,y:cy,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-70,y:cy,id:0},{x:cx+70,y:cy,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>page.locator('#zoom').inputValue()).not.toBe('1');
  await page.locator('#fullscreen').click();await expect(page.locator('body')).toHaveClass('fullscreen');await page.screenshot({path:info.outputPath('ipad-fullscreen.png')});await page.locator('#fullscreen').click();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('mobile.png'),fullPage:true});await context.close();
});

test('shared renderer fits all background modes and paints glow for both writing directions',async({page})=>{
  await ready(page);
  const result=await page.evaluate(async()=>{
    const {initialState,render,backgroundRect}=await import('/src/render.js');const s=initialState(),image={width:400,height:200};const rects={};
    for(const fit of ['cover','contain','width','height']){s.background.fit=fit;rects[fit]=backgroundRect(s,image);}
    const c=document.createElement('canvas');s.text='春の便り';s.style.glowColor='#ff0000';s.style.glow=true;
    const red=()=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>d[i+1]+25)n++;return n;};
    render(c,s,null);const horizontal=red();s.vertical=true;render(c,s,null);const vertical=red();s.style.glow=false;render(c,s,null);return {rects,horizontal,vertical,plain:red()};
  });
  expect(result.rects.contain).toMatchObject({w:210,h:105});expect(result.rects.cover.h).toBe(297);expect(result.rects.width.w).toBe(210);expect(result.rects.height.h).toBe(297);expect(result.horizontal).toBeGreaterThan(100);expect(result.vertical).toBeGreaterThan(100);expect(result.plain).toBe(0);
});

async function changeBox(page,values){
  for(const [key,value] of Object.entries(values)){await page.locator('#box-'+key).fill(String(value));await page.locator('#box-'+key).press('Tab');}
}
async function drag(page,selector,dx,dy){
  const b=await page.locator(selector).boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:5});await page.mouse.up();
}

test('text frame moves and resizes without changing text; undo, redo and persistence preserve it',async({page},info)=>{
  await ready(page);await page.locator('#text').fill('小さな枠で、自由に。');
  let saved=await project(page);expect(saved.textBox).toEqual({x:35,y:40,width:140,height:100});
  await drag(page,'#text-box',35,45);let moved=await project(page);
  expect(moved.textBox.x).toBeGreaterThan(saved.textBox.x);expect(moved.textBox.y).toBeGreaterThan(saved.textBox.y);expect(moved.text).toBe(saved.text);
  await drag(page,'[data-resize=se]',-45,-50);let resized=await project(page);
  expect(resized.textBox.width).toBeLessThan(moved.textBox.width);expect(resized.textBox.height).toBeLessThan(moved.textBox.height);expect(resized.textBox.x).toBe(moved.textBox.x);
  await page.locator('#undo').click();expect((await project(page)).textBox).toEqual(moved.textBox);
  await page.locator('#redo').click();expect((await project(page)).textBox).toEqual(resized.textBox);
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');
  expect((await project(page)).textBox).toEqual(resized.textBox);
  await page.screenshot({path:info.outputPath('movable-text-frame.png')});
});

test('frame keeps page bounds; keyboard, corner handles, orientation and touch work',async({browser})=>{
  const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();await ready(page);
  await page.locator('#text').fill('触って移動');const frame=await page.locator('#text-box').boundingBox(),cdp=await context.newCDPSession(page),cx=frame.x+frame.width/2,cy=frame.y+frame.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+30,y:cy+40,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  let s=await project(page);expect(s.textBox.x).toBeGreaterThan(35);expect(s.textBox.y).toBeGreaterThan(40);
  await page.locator('#text-box').focus();await page.keyboard.press('ArrowRight');let keyboard=await project(page);expect(keyboard.textBox.x).toBeCloseTo(s.textBox.x+1,4);
  await drag(page,'[data-resize=nw]',20,20);s=await project(page);expect(s.textBox.width).toBeLessThan(140);expect(s.textBox.height).toBeLessThan(100);
  await drag(page,'#text-box',-1000,-1000);s=await project(page);expect(s.textBox.x).toBe(0);expect(s.textBox.y).toBe(0);
  await page.locator('#tab-page').click();await page.locator('[data-orientation=landscape]').click();await page.locator('#tab-text').click();await changeBox(page,{width:270,height:160,x:27,y:50});
  await page.locator('#tab-page').click();await page.locator('[data-orientation=portrait]').click();s=await project(page);expect(s.textBox.x+s.textBox.width).toBeLessThanOrEqual(210);expect(s.textBox.y+s.textBox.height).toBeLessThanOrEqual(297);
  await context.close();
});

test('old projects keep original placement; box controls and project roundtrip work',async({page})=>{
  await ready(page);let old=await project(page);delete old.textBox;old.text='以前の原稿';old.styles=[];old.margins={top:25,left:30,bottom:25,right:30};
  await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
  await expect(page.locator('#box-x')).toHaveValue('30');await expect(page.locator('#box-y')).toHaveValue('25');await expect(page.locator('#box-width')).toHaveValue('150');await expect(page.locator('#box-height')).toHaveValue('247');
  await page.locator('#compact-text-box').click();await expect(page.locator('#box-width')).toHaveValue('140');await expect(page.locator('#box-height')).toHaveValue('100');
  await page.locator('#center-text-box').click();let s=await project(page);expect(s.textBox).toEqual({x:35,y:98.5,width:140,height:100});
  await changeBox(page,{width:80,height:60,x:70,y:110});s=await project(page);
  await page.locator('#project-file').setInputFiles({name:'new.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});expect((await project(page)).textBox).toEqual({x:70,y:110,width:80,height:60});
  await page.locator('#tab-page').click();await page.locator('#margin-left').fill('25');await page.locator('#margin-left').press('Tab');await page.locator('#tab-text').click();await expect(page.locator('#box-x')).toHaveValue('25');
  const invalid=structuredClone(s);invalid.textBox.x=200;
  await page.locator('#project-file').setInputFiles({name:'invalid.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await expect(page.locator('#toast')).toContainText('原稿を開けません');
});

test('moved text is at its new coordinates in real PNG export; editor frame is not exported',async({page},info)=>{
  await ready(page);await page.locator('#text').fill('春夏');await changeBox(page,{width:80,height:60,x:70,y:110});
  await page.locator('#export-button').click();const event=page.waitForEvent('download');await page.locator('#confirm-export').click();const file=await event;await file.saveAs(info.outputPath('moved.png'));
  const data=(await fs.readFile(await file.path())).toString('base64');
  const bounds=await page.evaluate(async base64=>{
    const im=await createImageBitmap(await (await fetch('data:image/png;base64,'+base64)).blob());const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let left=c.width,top=c.height,right=0,bottom=0,count=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]<200||d[i+1]<200||d[i+2]<200){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;}}
    return {left:left*25.4/300,top:top*25.4/300,right:right*25.4/300,bottom:bottom*25.4/300,count};
  },data);
  expect(bounds.count).toBeGreaterThan(100);expect(bounds.left).toBeGreaterThanOrEqual(70);expect(bounds.left).toBeLessThan(73);expect(bounds.top).toBeGreaterThanOrEqual(110);expect(bounds.top).toBeLessThan(114);expect(bounds.right).toBeLessThan(90);expect(bounds.bottom).toBeLessThan(125);
  await page.locator('#export-format').selectOption('pdf');const pdfEvent=page.waitForEvent('download');await page.locator('#confirm-export').click();await (await pdfEvent).saveAs(info.outputPath('moved.pdf'));
});

for(const [preset,width,height] of [['youtube',1920,1080],['short',1080,1920],['short-mini',640,360]]){
  test(`${preset} produces exact PNG size and matching PDF aspect; selection persists`,async({page},info)=>{
    await ready(page);await page.locator('#text').fill('春の便り');await background(page);await page.locator('#tab-page').click();await page.locator('#page-size').selectOption(preset);
    await expect(page.locator('#page-meta')).toContainText(`${width} × ${height} px`);await expect(page.locator('#page-orientation')).toBeHidden();
    await expect.poll(()=>page.locator('#canvas').evaluate(c=>[c.width,c.height])).toEqual([width,height]);
    await page.locator('#tab-text').click();await page.locator('#compact-text-box').click();
    await expect(page.locator('#box-width').locator('..').locator('[data-layout-unit]')).toHaveText('px');
    await expect(page.locator('#font-size-unit')).toHaveText('px');const fontPx=Number(await page.locator('#size').inputValue());await page.locator('#larger').click();expect(Number(await page.locator('#size').inputValue())).toBeCloseTo(fontPx+2,0);
    const s=await project(page);expect(s.pageSize).toBe(preset);
    const baseX=Number(await page.locator('#box-x').inputValue());await page.locator('#text-box').focus();await page.keyboard.press('ArrowLeft');expect(Number(await page.locator('#box-x').inputValue())).toBeCloseTo(Math.max(0,baseX-1),0);
    await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath(preset+'.png'));
    const png=await fs.readFile(await file.path());expect(png.readUInt32BE(16)).toBe(width);expect(png.readUInt32BE(20)).toBe(height);
    await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath(preset+'.pdf'));
    const pdf=(await fs.readFile(await file.path())).toString('latin1');const box=pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);expect(Number(box[1])/Number(box[2])).toBeCloseTo(width/height,5);expect(Number(box[1])).toBeCloseTo(width*72/300,4);expect(Number(box[2])).toBeCloseTo(height*72/300,4);expect(pdf).toContain('/Subtype /Image');
    await page.locator('#close-export').click();await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('#tab-page').click();await expect(page.locator('#page-size')).toHaveValue(preset);
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#page-size').selectOption('a4');await expect(page.locator('#page-orientation')).toBeVisible();await expect(page.locator('#page-meta')).toContainText('210 × 297 mm');
  });
}

test('short mini keeps the landscape composition and reduces both dimensions by three',async({page})=>{
  await ready(page);await page.locator('#text').fill('春夏');await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('youtube');
  const before=await project(page);await page.locator('#page-size').selectOption('short-mini');const after=await project(page);
  expect(after.textBox).toEqual(before.textBox);expect(after.styles).toEqual(before.styles);expect(after.background).toEqual(before.background);
  const result=await page.evaluate(async()=>{
    const {render,initialState}=await import('/src/render.js');const s=initialState();s.text='春夏';s.pageSize='youtube';s.textBox={x:25,y:40,width:40,height:40};
    const canvas=document.createElement('canvas');
    function inkBounds(){const {width:w,height:h}=canvas,d=canvas.getContext('2d').getImageData(0,0,w,h).data;let left=w,top=h,right=0,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(d[i]<180){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}return {w,h,left,top,right,bottom};}
    const fullLayout=render(canvas,s,null,{dpi:300}),full=inkBounds();s.pageSize='short-mini';const miniLayout=render(canvas,s,null,{dpi:300}),mini=inkBounds();return {full,mini,fullLayout,miniLayout};
  });
  expect(result.fullLayout).toEqual(result.miniLayout);expect(result.full.w).toBe(result.mini.w*3);expect(result.full.h).toBe(result.mini.h*3);
  for(const key of ['left','top','right','bottom'])expect(Math.abs(result.full[key]/3-result.mini[key])).toBeLessThan(2);
});

test('legacy A4 files and invalid page presets are handled without losing work',async({page})=>{
  await ready(page);const old=await project(page);delete old.pageSize;old.text='前の原稿';old.styles=[];
  await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await page.locator('#tab-page').click();await expect(page.locator('#page-size')).toHaveValue('a4');await expect(page.locator('#page-meta')).toContainText('210 × 297 mm');
  old.pageSize='unknown';await page.locator('#project-file').setInputFiles({name:'bad.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await expect(page.locator('#toast')).toContainText('原稿を開けません');await expect(page.locator('#text')).toHaveValue('前の原稿');
});

test('old portrait mini drafts migrate to landscape without losing text or resetting on reopen',async({page})=>{
  await ready(page);const old=await project(page);delete old.pageLayoutVersion;
  old.pageSize='short-mini';old.text='前のミニの原稿';old.styles=[];old.textBox={x:20,y:90,width:50,height:50};
  await page.locator('#project-file').setInputFiles({name:'portrait-mini.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
  await expect(page.locator('#text')).toHaveValue(old.text);await expect(page.locator('#page-meta')).toContainText('640 × 360 px');
  const migrated=await project(page);expect(migrated.pageLayoutVersion).toBe(2);expect(migrated.textBox.x).toBeCloseTo(20*1920/1080,4);expect(migrated.textBox.y).toBeCloseTo(90*1080/1920,4);expect(migrated.textBox.width).toBeCloseTo(50*1920/1080,4);expect(migrated.textBox.height).toBeCloseTo(50*1080/1920,4);
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).textBox).toEqual(migrated.textBox);
  await page.locator('#project-file').setInputFiles({name:'landscape-mini.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(migrated))});expect((await project(page)).textBox).toEqual(migrated.textBox);
});

test('negative character spacing narrows horizontal and vertical text and preserves alignment',async({page})=>{
  await ready(page);
  const r=await page.evaluate(async()=>{
    const {initialState,render}=await import('/src/render.js');await document.fonts.load('400 24px "Noto Sans JP"','あいうえおか');
    const s=initialState();s.text='あいうえおか';s.textBox={x:30,y:40,width:100,height:100};const c=document.createElement('canvas');
    function capture(){const layout=render(c,s,null);const {width:w,height:h}=c,d=c.getContext('2d').getImageData(0,0,w,h).data;let left=w,top=h,right=0,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4]<180){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}return {left,top,right,bottom,width:right-left,height:bottom-top,layout};}
    const normal=capture();s.letterSpacing=-.3;const tight=capture();s.letterSpacing=0;s.align='center';const centered=capture();s.letterSpacing=-.3;const centeredTight=capture();s.align='right';s.letterSpacing=0;const right=capture();s.letterSpacing=-.3;const rightTight=capture();
    s.align='left';s.vertical=true;s.letterSpacing=0;const vertical=capture();s.letterSpacing=-.3;const verticalTight=capture();s.vertical=false;s.textBox.width=40;s.letterSpacing=0;const wrapped=capture();s.letterSpacing=-.3;const fitted=capture();
    return {normal,tight,centered,centeredTight,right,rightTight,vertical,verticalTight,wrapped,fitted};
  });
  expect(r.tight.width).toBeLessThan(r.normal.width*.85);expect(r.verticalTight.height).toBeLessThan(r.vertical.height*.85);
  expect(Math.abs((r.centered.left+r.centered.right)-(r.centeredTight.left+r.centeredTight.right))).toBeLessThan(3);expect(Math.abs(r.right.right-r.rightTight.right)).toBeLessThan(2);expect(r.wrapped.layout.lines).toBeGreaterThan(r.fitted.layout.lines);
});

test('two boxes have independent text, styles, spacing and movement, with undo and persistence',async({page})=>{
  await ready(page);await page.locator('#text').fill('BOX1の見出し');await page.locator('#tighten-spacing').click();await page.locator('#tighten-spacing').click();
  await page.locator('#add-text-box').click();await expect(page.locator('#select-box-2')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#text')).toHaveValue('');await page.locator('#text').fill('BOX2の本文');
  await page.locator('#family').selectOption('serif');await page.locator('#color').evaluate(el=>{el.value='#0044cc';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#vertical').check();await page.locator('#tighten-spacing').click();
  await page.locator('#text').evaluate(el=>{el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new Event('select'));});await page.locator('#bold').click();
  const before=await project(page);expect(before.text).toBe('BOX1の見出し');expect(before.secondTextBox.text).toBe('BOX2の本文');expect(before.letterSpacing).toBe(-.1);expect(before.secondTextBox.letterSpacing).toBe(-.15);expect(before.style.family).toBe('sans');expect(before.secondTextBox.style.family).toBe('serif');expect(before.vertical).toBe(false);expect(before.secondTextBox.vertical).toBe(true);expect(before.secondTextBox.styles[0].bold).toBe(true);expect(before.styles[0].bold).toBe(false);
  await drag(page,'#text-box',25,25);const moved=await project(page);expect(moved.textBox).toEqual(before.textBox);expect(moved.secondTextBox.textBox.x).toBeGreaterThan(before.secondTextBox.textBox.x);
  await page.locator('#undo').click();expect((await project(page)).secondTextBox.textBox).toEqual(before.secondTextBox.textBox);await page.locator('#redo').click();expect((await project(page)).secondTextBox.textBox).toEqual(moved.secondTextBox.textBox);
  // Clicking and dragging an inactive frame selects that box in the same gesture.
  await drag(page,'#text-box-other',20,10);await expect(page.locator('#select-box-1')).toHaveAttribute('aria-pressed','true');const bothMoved=await project(page);expect(bothMoved.textBox.x).toBeGreaterThan(moved.textBox.x);expect(bothMoved.secondTextBox.textBox).toEqual(moved.secondTextBox.textBox);await expect(page.locator('#text')).toHaveValue('BOX1の見出し');await expect(page.locator('#letter-spacing')).toHaveValue('-0.1');
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await project(page)).toEqual(bothMoved);await page.locator('#select-box-2').click();await expect(page.locator('#text')).toHaveValue('BOX2の本文');await expect(page.locator('#letter-spacing')).toHaveValue('-0.15');
  await page.locator('#project-file').setInputFiles({name:'two-boxes.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bothMoved))});expect(await project(page)).toEqual(bothMoved);
  await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');const mini=await project(page);for(const t of [mini,mini.secondTextBox]){expect(t.textBox.x+t.textBox.width).toBeLessThanOrEqual(1920*25.4/300+.001);expect(t.textBox.y+t.textBox.height).toBeLessThanOrEqual(1080*25.4/300+.001);}expect(mini.secondTextBox.text).toBe('BOX2の本文');
});

test('real PNG and PDF contain both independently styled and spaced boxes',async({page},info)=>{
  await ready(page);await page.locator('#text').fill('赤のBOX');await changeBox(page,{width:80,height:50,x:20,y:25});await page.locator('#color').evaluate(el=>{el.value='#cc0000';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#tighten-spacing').click();
  await page.locator('#add-text-box').click();await page.locator('#text').fill('青のBOX');await changeBox(page,{width:80,height:50,x:100,y:150});await page.locator('#color').evaluate(el=>{el.value='#0044cc';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#family').selectOption('serif');
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('two-boxes.png'));
  const data=(await fs.readFile(await file.path())).toString('base64');const counts=await page.evaluate(async base64=>{const im=await createImageBitmap(await(await fetch('data:image/png;base64,'+base64)).blob()),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let red=0,blue=0,redMinY=c.height,blueMinY=c.height;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]>d[i+1]+60&&d[i]>d[i+2]+60){red++;redMinY=Math.min(redMinY,y);}if(d[i+2]>d[i]+60&&d[i+2]>d[i+1]+60){blue++;blueMinY=Math.min(blueMinY,y);}}return {red,blue,redMinY,blueMinY};},data);
  expect(counts.red).toBeGreaterThan(100);expect(counts.blue).toBeGreaterThan(100);expect(counts.redMinY*25.4/300).toBeGreaterThanOrEqual(25);expect(counts.blueMinY*25.4/300).toBeGreaterThanOrEqual(150);
  await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath('two-boxes.pdf'));expect((await fs.readFile(await file.path())).toString('latin1')).toContain('/Subtype /Image');
});

test('legacy one-box files retain standard spacing and invalid second boxes preserve current work',async({page})=>{
  await ready(page);const old=await project(page);delete old.letterSpacing;delete old.secondTextBox;old.text='以前の原稿';old.styles=[];
  await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await expect(page.locator('#text')).toHaveValue('以前の原稿');await expect(page.locator('#letter-spacing')).toHaveValue('0');await expect(page.locator('#add-text-box')).toBeVisible();
  await page.locator('#add-text-box').click();await page.locator('#text').fill('二つ目');const saved=await project(page);saved.secondTextBox.letterSpacing=-2;
  await page.locator('#project-file').setInputFiles({name:'bad.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await expect(page.locator('#toast')).toContainText('原稿を開けません');await expect(page.locator('#text')).toHaveValue('二つ目');
});

test('BOX1 copy duplicates rich content and size independently, then BOX2 delete supports undo and redo',async({page})=>{
  await ready(page);await page.locator('#text').fill('コピーする本文');await page.locator('#family').selectOption('serif');await page.locator('#tighten-spacing').click();await page.locator('#vertical').check();await page.locator('[data-align=center]').click();await changeBox(page,{width:80,height:60,x:40,y:30});
  await page.locator('#text').evaluate(el=>{el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new Event('select'));});await page.locator('#bold').click();
  const original=await project(page);await page.locator('#copy-text-box').click();await expect(page.locator('#text')).toHaveValue(original.text);await expect(page.locator('#select-box-2')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#box-create-actions')).toBeHidden();await expect(page.locator('#delete-text-box')).toBeVisible();
  const copied=await project(page);for(const key of ['text','styles','style','vertical','align','lineHeight','letterSpacing'])expect(copied.secondTextBox[key]).toEqual(original[key]);expect(copied.secondTextBox.textBox.width).toBe(original.textBox.width);expect(copied.secondTextBox.textBox.height).toBe(original.textBox.height);expect(copied.secondTextBox.textBox.y).not.toBe(original.textBox.y);
  await page.locator('#text').fill('編集したコピー');await page.locator('#family').selectOption('round');const edited=await project(page);expect(edited.text).toBe(original.text);expect(edited.styles).toEqual(original.styles);expect(edited.style).toEqual(original.style);expect(edited.textBox).toEqual(original.textBox);
  await page.locator('#select-box-1').click();await expect(page.locator('#delete-text-box')).toBeHidden();await page.locator('#select-box-2').click();await page.locator('#delete-text-box').click();await expect(page.locator('#select-box-2')).toBeHidden();await expect(page.locator('#text-box-other')).toBeHidden();await expect(page.locator('#text')).toHaveValue(original.text);await expect(page.locator('#copy-text-box')).toBeVisible();expect((await project(page)).secondTextBox).toBeNull();
  await page.locator('#undo').click();await expect(page.locator('#select-box-2')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#text')).toHaveValue('編集したコピー');expect((await project(page)).secondTextBox).toEqual(edited.secondTextBox);
  await page.locator('#redo').click();expect((await project(page)).secondTextBox).toBeNull();await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await expect(page.locator('#select-box-2')).toBeHidden();
  await page.locator('#copy-text-box').click();await expect(page.locator('#text')).toHaveValue(original.text);await page.locator('#undo').click();await expect(page.locator('#select-box-2')).toBeHidden();await page.locator('#redo').click();await expect(page.locator('#text')).toHaveValue(original.text);
});

test('deleted BOX2 leaves no pixels in saved PNG and BOX1 remains intact',async({page},info)=>{
  await ready(page);await page.locator('#text').fill('赤いBOX1');await page.locator('#color').evaluate(el=>{el.value='#cc0000';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#copy-text-box').click();await page.locator('#text').fill('青いBOX2');await page.locator('#color').evaluate(el=>{el.value='#0044cc';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#delete-text-box').click();await page.locator('#export-button').click();const event=page.waitForEvent('download');await page.locator('#confirm-export').click();const file=await event;await file.saveAs(info.outputPath('deleted-box.png'));
  const data=(await fs.readFile(await file.path())).toString('base64');const counts=await page.evaluate(async base64=>{const im=await createImageBitmap(await(await fetch('data:image/png;base64,'+base64)).blob()),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let red=0,blue=0;for(let i=0;i<d.length;i+=4){if(d[i]>d[i+1]+60&&d[i]>d[i+2]+60)red++;if(d[i+2]>d[i]+60&&d[i+2]>d[i+1]+60)blue++;}return {red,blue};},data);
  expect(counts.red).toBeGreaterThan(100);expect(counts.blue).toBe(0);
});

for(const format of ['a4','short-mini'])test(`BOX2 left edge aligns to BOX1 with undo and persistence (${format})`,async({page})=>{
  await ready(page);await expect(page.locator('#align-box-left')).toBeHidden();
  if(format!=='a4'){await page.locator('#tab-page').click();await page.locator('#page-size').selectOption(format);await page.locator('#tab-text').click();}
  await page.locator('#text').fill('見出し');await changeBox(page,{x:40,y:30,width:100,height:50});
  await page.locator('#copy-text-box').click();await page.locator('#text').fill('本文');await changeBox(page,{x:70,y:100,width:80,height:60});
  const before=await project(page);await page.locator('#align-box-left').click();const after=await project(page);
  expect(after.textBox).toEqual(before.textBox);expect(after.text).toBe(before.text);
  expect(after.secondTextBox).toEqual({...before.secondTextBox,textBox:{...before.secondTextBox.textBox,x:before.textBox.x}});
  await page.locator('#undo').click();expect((await project(page)).secondTextBox).toEqual(before.secondTextBox);
  await page.locator('#redo').click();expect((await project(page)).secondTextBox).toEqual(after.secondTextBox);
  await page.locator('#select-box-1').click();await expect(page.locator('#align-box-left')).toBeHidden();await page.locator('#select-box-2').click();await expect(page.locator('#align-box-left')).toBeVisible();
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).secondTextBox).toEqual(after.secondTextBox);
});

test('alignment keeps a wide BOX2 intact and explains when it would leave the page',async({page})=>{
  await ready(page);await changeBox(page,{width:50,x:140});await page.locator('#add-text-box').click();await changeBox(page,{x:0,width:100});
  const before=await project(page);await page.locator('#align-box-left').click();await expect(page.locator('#toast')).toContainText('BOX2の幅を小さく');expect((await project(page)).secondTextBox).toEqual(before.secondTextBox);
});

async function overlayUpload(page,color='#e02030',name='透過ロゴ.png'){
  const data=await page.evaluate(color=>{const c=document.createElement('canvas');c.width=200;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(50,25,100,50);return c.toDataURL().split(',')[1];},color);
  await page.locator('#overlay-file').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#overlay-select')).toContainText(name);
}
async function overlayValue(page,key,value){await page.locator('#overlay-'+key).fill(String(value));await page.locator('#overlay-'+key).press('Tab');}

test('six additional Japanese fonts load, render distinctly and survive selected-text editing and reload',async({page})=>{
  await ready(page);await page.locator('#text').fill('春の便り、また会いましょう。');expect(await page.locator('#family option').count()).toBe(10);
  const hashes=[];
  for(const family of ['handwriting','brush','pop','heavy','decorative','reggae']){
    await page.locator('#family').selectOption(family);
    const result=await page.evaluate(async family=>{const {families}=await import('/src/render.js');const faces=await document.fonts.load('400 24px '+families[family],'春の便り、また会いましょう。');return {loaded:faces.length,ready:faces.every(face=>face.status==='loaded')};},family);
    expect(result.loaded).toBeGreaterThan(0);expect(result.ready).toBe(true);
    await expect.poll(()=>page.locator('#canvas').evaluate(c=>c.toDataURL())).not.toBe(hashes.at(-1)||'');
    await page.waitForTimeout(60);hashes.push(await page.locator('#canvas').evaluate(c=>c.toDataURL()));
  }
  expect(new Set(hashes).size).toBe(6);
  await page.locator('#text').evaluate(el=>{el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new Event('select'));});await page.locator('#family').selectOption('handwriting');await page.locator('#bold').click();
  const before=await project(page);expect(before.styles[0].family).toBe('handwriting');expect(before.styles[0].bold).toBe(true);expect(before.style.family).toBe('reggae');
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).styles).toEqual(before.styles);
});

test('transparent images move, resize with fixed proportions, undo, delete and persist independently of text',async({page})=>{
  await ready(page);await page.locator('#text').fill('文字はそのまま');await page.locator('#tab-overlay').click();await overlayUpload(page);
  let s=await project(page);expect(s.overlays).toHaveLength(1);const frame='.overlay-frame.selected',first=s.overlays[0];expect(first.width/first.height).toBe(2);
  await drag(page,frame,-30,20);let moved=await project(page);expect(moved.text).toBe(s.text);expect(moved.overlays[0].x).toBeLessThan(first.x);expect(moved.overlays[0].y).toBeGreaterThan(first.y);
  await drag(page,frame+' [data-image-resize=se]',-30,-15);let resized=await project(page);expect(resized.overlays[0].width).toBeLessThan(moved.overlays[0].width);expect(resized.overlays[0].width/resized.overlays[0].height).toBeCloseTo(2,8);
  await page.locator('#undo').click();expect((await project(page)).overlays).toEqual(moved.overlays);await page.locator('#redo').click();expect((await project(page)).overlays).toEqual(resized.overlays);
  await overlayValue(page,'width',60);await overlayValue(page,'x',20);await overlayValue(page,'y',30);s=await project(page);expect(s.overlays[0]).toMatchObject({x:20,y:30,width:60,height:30});
  await page.locator(frame).focus();await page.keyboard.press('ArrowRight');expect((await project(page)).overlays[0].x).toBe(21);
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).overlays[0].x).toBe(21);
  await page.locator('#tab-overlay').click();await page.locator('#delete-overlay').click();expect((await project(page)).overlays).toEqual([]);await expect(page.locator('#overlay-controls')).toBeHidden();await page.locator('#undo').click();expect((await project(page)).overlays[0].src).toBe(first.src);
  const portable=await project(page);await page.locator('#project-file').setInputFiles({name:'images.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(portable))});expect((await project(page)).overlays).toEqual(portable.overlays);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('image transparency, opacity and stacking match real PNG and PDF export',async({page},info)=>{
  await ready(page);await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');await page.locator('#paper-color').evaluate(el=>{el.value='#203050';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#tab-overlay').click();await overlayUpload(page);await overlayValue(page,'width',240);await overlayValue(page,'x',100);await overlayValue(page,'y',80);
  const sample=()=>page.locator('#canvas').evaluate(c=>{const ctx=c.getContext('2d');return {outside:[...ctx.getImageData(110,90,1,1).data],inside:[...ctx.getImageData(220,140,1,1).data]};});
  await expect.poll(async()=> (await sample()).inside).toEqual([224,32,48,255]);expect((await sample()).outside).toEqual([32,48,80,255]);
  await overlayUpload(page,'#0044cc','青いマーク.png');await overlayValue(page,'width',240);await overlayValue(page,'x',100);await overlayValue(page,'y',80);await expect.poll(async()=> (await sample()).inside).toEqual([0,68,204,255]);
  await page.locator('#overlay-backward').click();await expect.poll(async()=> (await sample()).inside).toEqual([224,32,48,255]);await page.locator('#overlay-forward').click();
  await page.locator('#overlay-opacity').focus();await page.locator('#overlay-opacity').press('Home');await expect.poll(async()=> (await sample()).inside).toEqual([224,32,48,255]);await page.locator('#undo').click();await expect.poll(async()=> (await sample()).inside).toEqual([0,68,204,255]);
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('overlay.png'));
  const png=await fs.readFile(await file.path());const pixels=await page.evaluate(async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {size:[c.width,c.height],outside:[...ctx.getImageData(110,90,1,1).data],inside:[...ctx.getImageData(220,140,1,1).data]};},png.toString('base64'));
  expect(pixels).toEqual({size:[640,360],outside:[32,48,80,255],inside:[0,68,204,255]});
  await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath('overlay.pdf'));
  const pdf=(await fs.readFile(await file.path())).toString('latin1');expect(pdf).toContain('/Subtype /Image');
});

test('image layers preserve aspect on page changes and reject invalid projects without losing work',async({page})=>{
  await ready(page);await page.locator('#tab-overlay').click();await overlayUpload(page);const original=await project(page);
  await page.locator('#tab-page').click();await page.locator('[data-orientation=landscape]').click();await page.locator('#page-size').selectOption('short-mini');const mini=await project(page);expect(mini.overlays[0].width/mini.overlays[0].height).toBeCloseTo(2,8);
  await page.locator('#project-file').setInputFiles({name:'mini.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(mini))});expect((await project(page)).overlays).toEqual(mini.overlays);
  const invalid=structuredClone(mini);invalid.overlays[0].src='https://example.com/test.png';await page.locator('#project-file').setInputFiles({name:'bad.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await expect(page.locator('#toast')).toContainText('原稿を開けませんでした');expect((await project(page)).overlays).toEqual(mini.overlays);
  delete original.overlays;await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});expect((await project(page)).overlays).toEqual([]);
});

test('image placement switches between front and back of text, including transparent areas',async({page})=>{
  await ready(page);await page.locator('#text').fill('春夏');
  const result=await page.evaluate(async()=>{
    const {initialState,render}=await import('/src/render.js');
    const state=initialState();state.text='春夏';state.style.size=70;state.textBox={x:35,y:40,width:140,height:100};
    const source=document.createElement('canvas');source.width=100;source.height=100;source.getContext('2d').fillStyle='#0044cc';source.getContext('2d').fillRect(0,0,100,100);
    const src=source.toDataURL(),img=new Image();img.src=src;await img.decode();const images=new Map([[src,img]]);
    state.overlays=[{id:'a',name:'blue',src,x:30,y:30,width:100,height:100,opacity:100,placement:'back'}];
    const canvas=document.createElement('canvas'),dark=()=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]<60&&data[i+1]<60&&data[i+2]<60)count++;return count;};
    render(canvas,state,null,{overlayImages:images});const back=dark();state.overlays[0].placement='front';render(canvas,state,null,{overlayImages:images});return {back,front:dark()};
  });
  expect(result.back).toBeGreaterThan(100);expect(result.front).toBe(0);
  await page.locator('#tab-overlay').click();await overlayUpload(page);await page.locator('#overlay-placement').selectOption('back');expect((await project(page)).overlays[0].placement).toBe('back');await page.locator('#undo').click();expect((await project(page)).overlays[0].placement).toBe('front');
});

test('image frames support iPad touch dragging and corner resizing',async({browser})=>{
  const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();await ready(page);await page.locator('#tab-overlay').click();await overlayUpload(page);
  const before=await project(page),frame=await page.locator('.overlay-frame.selected').boundingBox(),cdp=await context.newCDPSession(page),cx=frame.x+frame.width/2,cy=frame.y+frame.height/2;
  const touch=async(x,y,dx,dy)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  await touch(cx,cy,20,25);const moved=await project(page);expect(moved.overlays[0].x).toBeGreaterThan(before.overlays[0].x);expect(moved.overlays[0].y).toBeGreaterThan(before.overlays[0].y);
  const corner=await page.locator('.overlay-frame.selected [data-image-resize=se]').boundingBox();await touch(corner.x+corner.width/2,corner.y+corner.height/2,-25,-12);const resized=await project(page);expect(resized.overlays[0].width).toBeLessThan(moved.overlays[0].width);expect(resized.overlays[0].width/resized.overlays[0].height).toBeCloseTo(2,8);await context.close();
});

test('opening a draft without images clears every editor frame and undo restores all images',async({page})=>{
  await ready(page);const empty=await project(page);await page.locator('#tab-overlay').click();await overlayUpload(page);await overlayUpload(page,'#0044cc','マーク2.png');await expect(page.locator('.overlay-frame')).toHaveCount(2);
  await page.locator('#project-file').setInputFiles({name:'empty.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(empty))});await expect(page.locator('.overlay-frame')).toHaveCount(0);await page.locator('#undo').click();await expect(page.locator('.overlay-frame')).toHaveCount(2);expect((await project(page)).overlays).toHaveLength(2);
});

test('text colour presets preserve selection, independent boxes, undo and saved drafts',async({page})=>{
  await ready(page);await page.locator('#text').fill('黄金の見出し');
  await page.locator('#text').evaluate(el=>{el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new Event('select'));});await page.locator('#fill-preset').selectOption('gold');
  let s=await project(page);expect(s.styles[0].fillPreset).toBe('gold');expect(s.styles[1].fillPreset).toBe('gold');expect(s.styles[2].fillPreset).toBe('solid');await expect(page.locator('#preset-preview')).toBeVisible();
  await page.locator('#undo').click();expect((await project(page)).styles[0].fillPreset).toBe('solid');await page.locator('#redo').click();expect((await project(page)).styles[0].fillPreset).toBe('gold');
  await page.locator('#copy-text-box').click();await page.locator('#fill-preset').selectOption('silver');s=await project(page);expect(s.secondTextBox.style.fillPreset).toBe('silver');expect(s.secondTextBox.styles.every(style=>style.fillPreset==='silver')).toBe(true);expect(s.styles[0].fillPreset).toBe('gold');
  await page.locator('#color').evaluate(el=>{el.value='#cc2244';el.dispatchEvent(new Event('change',{bubbles:true}));});s=await project(page);expect(s.secondTextBox.style.fillPreset).toBe('solid');expect(s.secondTextBox.style.color).toBe('#cc2244');await expect(page.locator('#fill-preset')).toHaveValue('solid');await expect(page.locator('#preset-preview')).toBeHidden();
  await page.locator('#undo').click();await expect(page.locator('#fill-preset')).toHaveValue('silver');await expect(page.locator('#save-status')).toContainText('保存済み');const before=await project(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).styles).toEqual(before.styles);expect((await project(page)).secondTextBox.style.fillPreset).toBe('silver');
  await page.locator('#project-file').setInputFiles({name:'gold.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});expect((await project(page)).secondTextBox.style.fillPreset).toBe('silver');
});

test('metallic gradients paint multiple gold tones in both writing directions, with glow and mixed colours',async({page})=>{
  await ready(page);await page.locator('#text').fill('黄金■');
  const result=await page.evaluate(async()=>{
    const {initialState,render,families}=await import('/src/render.js');await document.fonts.load('700 60px '+families.sans,'黄金■');const s=initialState();s.text='黄金■';s.style.size=60;s.style.bold=true;s.style.fillPreset='gold';s.textBox={x:30,y:30,width:140,height:180};const canvas=document.createElement('canvas');
    function capture(){render(canvas,s,null);const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let dark=0,light=0,red=0;for(let i=0;i<data.length;i+=4){const [r,g,b]=data.slice(i,i+3);if(r>g+10&&g>b+25){if(r<190)dark++;if(r>225)light++;}if(r>180&&g<70&&b<70)red++;}return {dark,light,red};}
    const horizontal=capture();s.vertical=true;s.style.glow=true;s.style.glowColor='#88aadd';const vertical=capture();s.vertical=false;s.styles=[{...s.style,fillPreset:'solid',color:'#ff0000'}];const mixed=capture();return {horizontal,vertical,mixed};
  });
  for(const mode of ['horizontal','vertical','mixed']){expect(result[mode].dark).toBeGreaterThan(100);expect(result[mode].light).toBeGreaterThan(100);}expect(result.mixed.red).toBeGreaterThan(100);
});

test('every gradient preset appears in saved PNG and gold is embedded in PDF',async({page},info)=>{
  await ready(page);await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');await page.locator('#tab-text').click();await page.locator('#text').fill('黄金の文字');await page.locator('#family').selectOption('heavy');await page.locator('#size').fill('64');await page.locator('#size').press('Enter');
  for(const key of ['champagne','rose','silver','rainbow','gold']){
    await page.locator('#fill-preset').selectOption(key);await expect(page.locator('#preset-preview')).toBeVisible();await page.locator('#export-button').click();const event=page.waitForEvent('download');await page.locator('#confirm-export').click();const file=await event;await file.saveAs(info.outputPath('preset-'+key+'.png'));
    const data=await fs.readFile(await file.path());const tones=await page.evaluate(async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data,colors=new Set();let colored=0;for(let i=0;i<d.length;i+=4)if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])>20){colored++;colors.add(d.slice(i,i+3).join(','));}return {colored,colors:colors.size};},data.toString('base64'));expect(tones.colored).toBeGreaterThan(100);expect(tones.colors).toBeGreaterThan(30);
    if(key==='gold'){await page.locator('#export-format').selectOption('pdf');const pdf=page.waitForEvent('download');await page.locator('#confirm-export').click();await (await pdf).saveAs(info.outputPath('preset-gold.pdf'));}await page.locator('#close-export').click();
  }
});

test('old solid-colour drafts keep their appearance and invalid preset names do not overwrite work',async({page})=>{
  await ready(page);await page.locator('#text').fill('以前の原稿');const old=await project(page);delete old.style.fillPreset;for(const style of old.styles)delete style.fillPreset;
  await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await expect(page.locator('#fill-preset')).toHaveValue('solid');await page.locator('#fill-preset').selectOption('gold');const current=await project(page),bad=structuredClone(current);bad.styles[0].fillPreset='unknown';
  await page.locator('#project-file').setInputFiles({name:'bad.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await expect(page.locator('#toast')).toContainText('原稿を開けませんでした');expect((await project(page)).styles).toEqual(current.styles);
});

test('thumbnail presets and custom effects preserve selection, independent boxes and undo',async({page})=>{
  await ready(page);await page.locator('#text').fill('注目の見出し');await page.locator('#text').evaluate(el=>{el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new Event('select'));});await page.locator('#text-effect-preset').selectOption('blue');
  let s=await project(page);expect(s.styles[0]).toMatchObject({color:'#183db8',outline:true,doubleOutline:true,outlineColor:'#ffffff',outerOutlineColor:'#141414',shadow:true});expect(s.styles[2].outline).toBe(false);expect(s.style.family).toBe('sans');expect(s.styles[0].size).toBe(24);
  await page.locator('#undo').click();expect((await project(page)).styles[0].outline).toBe(false);await page.locator('#redo').click();expect((await project(page)).styles[0].doubleOutline).toBe(true);
  await page.locator('#copy-text-box').click();await page.locator('#text-effect-preset').selectOption('pink');await page.locator('#text-effect-details summary').click();await page.locator('#outline-color').evaluate(el=>{el.value='#336699';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#outline-width').focus();await page.locator('#outline-width').press('ArrowRight');
  s=await project(page);expect(s.secondTextBox.style.outlineWidth).toBe(.6);expect(s.secondTextBox.style.outlineColor).toBe('#336699');expect(s.styles[0].outlineColor).toBe('#ffffff');
  await page.locator('#undo').click();expect((await project(page)).secondTextBox.style.outlineWidth).toBe(.5);await page.locator('#redo').click();
  await page.locator('#clear-text-effects').click();s=await project(page);expect(s.secondTextBox.style).toMatchObject({outline:false,doubleOutline:false,shadow:false,glow:false,color:'#f25c9b'});await page.locator('#undo').click();
  const saved=await project(page);await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).secondTextBox).toEqual(saved.secondTextBox);
  await page.locator('#project-file').setInputFiles({name:'effects.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});expect((await project(page)).styles).toEqual(saved.styles);
});

test('double outlines and drop shadows paint distinct pixels without covering neighbouring text fills',async({page})=>{
  await ready(page);await page.locator('#text').fill('春夏■');
  const result=await page.evaluate(async()=>{
    const {initialState,render,families}=await import('/src/render.js');await document.fonts.load('700 80px '+families.sans,'春夏■');const s=initialState();s.text='春夏■';s.letterSpacing=-.3;s.style={...s.style,size:70,bold:true,color:'#ffff00'};s.textBox={x:30,y:30,width:150,height:200};const canvas=document.createElement('canvas');
    function capture(){render(canvas,s,null);const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let yellow=0,blue=0,red=0,green=0;for(let i=0;i<data.length;i+=4){const [r,g,b]=data.slice(i,i+3);if(r>230&&g>230&&b<30)yellow++;if(b>150&&r<50&&g<120)blue++;if(r>150&&g<60&&b<60)red++;if(g>110&&g>r+50&&g>b+30)green++;}return {yellow,blue,red,green};}
    const plain=capture();Object.assign(s.style,{outline:true,outlineColor:'#0044cc',outlineWidth:.7,doubleOutline:true,outerOutlineColor:'#dd2222',outerOutlineWidth:.7,shadow:true,shadowColor:'#22aa55',shadowX:2,shadowY:2,shadowBlur:0});const horizontal=capture();s.vertical=true;const vertical=capture();return {plain,horizontal,vertical};
  });
  for(const mode of ['horizontal','vertical'])for(const color of ['yellow','blue','red','green'])expect(result[mode][color]).toBeGreaterThan(100);
  expect(result.horizontal.yellow).toBeGreaterThan(result.plain.yellow*.98);
});

test('thumbnail decoration presets export as real PNG and PDF, and legacy styles remain editable',async({page},info)=>{
  await ready(page);await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');await page.locator('#tab-text').click();await page.locator('#text').fill('サムネイル');await page.locator('#family').selectOption('heavy');await page.locator('#size').fill('64');await page.locator('#size').press('Enter');
  for(const preset of ['white','yellow','blue','pink','red','gold']){await page.locator('#text-effect-preset').selectOption(preset);const s=await project(page);expect(s.style.outline).toBe(true);expect(s.style.family).toBe('heavy');}
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('effects.png'));const png=await fs.readFile(await file.path());expect(png.readUInt32BE(16)).toBe(640);
  await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath('effects.pdf'));await page.locator('#close-export').click();
  const old=await project(page);for(const style of [old.style,...old.styles])for(const key of ['outline','outlineColor','outlineWidth','doubleOutline','outerOutlineColor','outerOutlineWidth','shadow','shadowColor','shadowX','shadowY','shadowBlur'])delete style[key];
  await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await expect(page.locator('#outline')).not.toBeChecked();await expect(page.locator('#text-shadow')).not.toBeChecked();
  const bad=structuredClone(old);bad.style.outlineWidth=100;await page.locator('#project-file').setInputFiles({name:'bad.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await expect(page.locator('#toast')).toContainText('原稿を開けませんでした');expect((await project(page)).style).toEqual(old.style);
});

const svgLogo='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><linearGradient id="gold"><stop stop-color="#d4a43d"/><stop offset="1" stop-color="#fff0ac"/></linearGradient></defs><rect x="50" y="25" width="100" height="50" fill="#0044cc"/></svg>';
async function uploadSVG(page,source=svgLogo,name='透過ロゴ.svg'){await page.locator('#overlay-file').setInputFiles({name,mimeType:'image/svg+xml',buffer:Buffer.from(source)});}

test('SVG viewBox imports as one transparent PNG layer and survives export and project reload',async({page},info)=>{
  await ready(page);await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');await page.locator('#tab-overlay').click();await uploadSVG(page);await expect(page.locator('#overlay-select')).toContainText('透過ロゴ.svg');
  let s=await project(page);expect(s.overlays).toHaveLength(1);expect(s.overlays[0].src).toMatch(/^data:image\/png;base64,/);expect(s.overlays[0].width/s.overlays[0].height).toBeCloseTo(2,8);expect(await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return [image.naturalWidth,image.naturalHeight];},s.overlays[0].src)).toEqual([2048,1024]);await overlayValue(page,'width',240);await overlayValue(page,'x',100);await overlayValue(page,'y',80);
  const sample=()=>page.locator('#canvas').evaluate(c=>{const ctx=c.getContext('2d');return {outside:[...ctx.getImageData(110,90,1,1).data],inside:[...ctx.getImageData(220,140,1,1).data]};});await expect.poll(sample).toEqual({outside:[255,255,255,255],inside:[0,68,204,255]});
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('svg.png'));await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath('svg.pdf'));await page.locator('#close-export').click();
  s=await project(page);await page.locator('#delete-overlay').click();await page.locator('#undo').click();expect((await project(page)).overlays).toEqual(s.overlays);await page.locator('#project-file').setInputFiles({name:'svg.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});expect((await project(page)).overlays).toEqual(s.overlays);
});

test('SVG gradients, large dimensions, local symbols and invalid files are handled without loading external content',async({page})=>{
  await ready(page);await page.locator('#tab-overlay').click();const external=[];page.on('request',request=>{if(request.url().startsWith('https://example.com/'))external.push(request.url());});
  const source='<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" width="4000" height="2000"><script>window.svgExecuted=true</script><defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><rect id="r" width="4000" height="2000" fill="url(#g)"/></defs><use href="#r"/><image href="https://example.com/test.png" width="100" height="100"/></svg>';
  await uploadSVG(page,source,'大きな.svg');await expect(page.locator('#overlay-select')).toContainText('大きな.svg');const s=await project(page);const colors=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {size:[img.width,img.height],left:[...ctx.getImageData(20,500,1,1).data],right:[...ctx.getImageData(2000,500,1,1).data],executed:!!window.svgExecuted};},s.overlays[0].src);expect(colors.size).toEqual([2048,1024]);expect(colors.left[0]).toBeGreaterThan(200);expect(colors.right[2]).toBeGreaterThan(200);expect(colors.executed).toBe(false);expect(external).toEqual([]);
  await uploadSVG(page,'<svg>broken','bad.svg');await expect(page.locator('#toast')).toContainText('SVGファイルを読み込めません');expect((await project(page)).overlays).toEqual(s.overlays);
  await uploadSVG(page,'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><foreignObject/></svg>','html.svg');await expect(page.locator('#toast')).toContainText('HTMLを含むSVG');expect((await project(page)).overlays).toEqual(s.overlays);
});

async function writeClipboardImage(page){
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=200;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='#0044cc';ctx.fillRect(50,25,100,50);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);});
}

test.describe('clipboard images',()=>{
 test.describe.configure({mode:'serial'});
test('native Ctrl+V pastes a transparent clipboard image from text editing, with undo and persistence',async({page})=>{
  await ready(page);await page.locator('#text').fill('文字は残す');await writeClipboardImage(page);await page.locator('#text').focus();await page.keyboard.press('Control+v');await expect(page.locator('#overlay-select')).toContainText('貼り付け画像_');await expect(page.locator('#tab-overlay')).toHaveAttribute('aria-selected','true');
  const pasted=await project(page);expect(pasted.text).toBe('文字は残す');expect(pasted.overlays).toHaveLength(1);expect(pasted.overlays[0].name).toMatch(/^貼り付け画像_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_1\.png$/);
  const pixels=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {size:[c.width,c.height],outside:[...ctx.getImageData(5,5,1,1).data],inside:[...ctx.getImageData(100,50,1,1).data]};},pasted.overlays[0].src);expect(pixels).toEqual({size:[200,100],outside:[0,0,0,0],inside:[0,68,204,255]});
  await page.locator('#undo').click();expect((await project(page)).overlays).toHaveLength(0);await page.locator('#redo').click();expect((await project(page)).overlays).toEqual(pasted.overlays);
  await overlayValue(page,'width',80);const resized=await project(page);await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await project(page)).overlays).toEqual(resized.overlays);
});

test('clipboard paste button imports real clipboard pixels into PNG and PDF export',async({page},info)=>{
  await ready(page);await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');await writeClipboardImage(page);await page.locator('#tab-overlay').click();await page.locator('#paste-overlay').click();await expect(page.locator('#overlay-select')).toContainText('貼り付け画像_');await overlayValue(page,'width',240);await overlayValue(page,'x',100);await overlayValue(page,'y',80);
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('clipboard.png'));const data=await fs.readFile(await file.path());const pixels=await page.evaluate(async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {size:[c.width,c.height],outside:[...ctx.getImageData(110,90,1,1).data],inside:[...ctx.getImageData(220,140,1,1).data]};},data.toString('base64'));expect(pixels).toEqual({size:[640,360],outside:[255,255,255,255],inside:[0,68,204,255]});
  await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath('clipboard.pdf'));
});

test('normal text paste is unchanged and mixed clipboard contents prefer text inside text fields',async({page})=>{
  await ready(page);await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.evaluate(()=>navigator.clipboard.writeText('貼り付けた文字'));await page.locator('#text').focus();await page.keyboard.press('Control+v');await expect(page.locator('#text')).toHaveValue('貼り付けた文字');expect((await project(page)).overlays).toHaveLength(0);
  const cancelled=await page.locator('#text').evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','文字と画像');data.items.add(new File(['not decoded because text wins'],'image.png',{type:'image/png'}));return !el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});expect(cancelled).toBe(false);expect((await project(page)).overlays).toHaveLength(0);
});

test('clipboard empty, denied and full-layer cases give a recovery path without losing work',async({page})=>{
  await ready(page);await page.locator('#text').fill('残す原稿');await page.locator('#tab-overlay').click();await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.evaluate(()=>navigator.clipboard.writeText('画像ではない'));await page.locator('#paste-overlay').click();await expect(page.locator('#toast')).toContainText('クリップボードに画像がありません');
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'read',{configurable:true,value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}));await page.locator('#paste-overlay').click();await expect(page.locator('#toast')).toContainText('Ctrl＋V');await expect(page.locator('#paste-overlay')).toBeEnabled();expect((await project(page)).text).toBe('残す原稿');
  await overlayUpload(page);const full=await project(page),item=full.overlays[0];full.overlays=Array.from({length:12},(_,i)=>({...item,id:'limit-'+i}));await page.locator('#project-file').setInputFiles({name:'full.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(full))});await expect(page.locator('#paste-overlay')).toBeDisabled();await writeClipboardImage(page);await page.locator('#tab-overlay').click();await page.keyboard.press('Control+v');await expect(page.locator('#toast')).toContainText('最大12枚');expect((await project(page)).overlays).toHaveLength(12);
});

});

test('solid background controls work without a photo and stay linked to the page colour with undo',async({page})=>{
  await ready(page);await page.locator('#tab-background').click();await page.locator('[data-paper-color="#b8ddc8"]').click();await expect(page.locator('#background-color')).toHaveValue('#b8ddc8');await expect(page.locator('#paper-color')).toHaveValue('#b8ddc8');await expect(page.locator('#empty-note')).toBeHidden();
  const pixel=()=>page.locator('#canvas').evaluate(c=>[...c.getContext('2d').getImageData(10,10,1,1).data]);await expect.poll(pixel).toEqual([184,221,200,255]);expect((await project(page)).background.src).toBe('');
  await page.locator('#background-color').evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('change',{bubbles:true}));});await expect.poll(pixel).toEqual([18,52,86,255]);await page.locator('#undo').click();await expect.poll(pixel).toEqual([184,221,200,255]);await page.locator('#redo').click();await expect.poll(pixel).toEqual([18,52,86,255]);
  await page.locator('[data-paper-mode=gradient]').click();await page.locator('#tab-page').click();await page.locator('#paper-color').evaluate(el=>{el.value='#ffccaa';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#tab-background').click();await expect(page.locator('[data-paper-mode=solid]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#background-color')).toHaveValue('#ffccaa');
});

test('all background patterns have distinct geometry and retain it at export resolution',async({page})=>{
  await ready(page);const result=await page.evaluate(async()=>{
    const {initialState,render}=await import('/src/render.js');const {paperPatterns}=await import('/src/paper-fill.js');const state=initialState();state.pageSize='short-mini';state.paperFill={mode:'gradient',preset:'sky',pattern:'vertical',reverse:false};const canvas=document.createElement('canvas'),outputs={};
    for(const pattern of Object.keys(paperPatterns)){state.paperFill.pattern=pattern;render(canvas,state,null,{dpi:300});const ctx=canvas.getContext('2d'),at=(x,y)=>[...ctx.getImageData(x,y,1,1).data];outputs[pattern]={hash:canvas.toDataURL(),a:at(20,40),b:at(600,40),c:at(20,300),center:at(320,180),left:at(20,180),right:at(619,180)};}
    state.paperFill.pattern='vertical';render(canvas,state,null,{dpi:300});const original=[...canvas.getContext('2d').getImageData(320,20,1,1).data];state.paperFill.reverse=true;render(canvas,state,null,{dpi:300});const reversed=[...canvas.getContext('2d').getImageData(320,20,1,1).data];return {outputs,original,reversed};
  });
  const r=result.outputs;expect(Object.keys(r)).toHaveLength(7);expect(new Set(Object.values(r).map(v=>v.hash)).size).toBe(7);expect(Math.max(...r.vertical.a.map((v,i)=>Math.abs(v-r.vertical.b[i])))).toBeLessThanOrEqual(1);expect(r.vertical.a).not.toEqual(r.vertical.c);expect(Math.max(...r.horizontal.a.map((v,i)=>Math.abs(v-r.horizontal.c[i])))).toBeLessThanOrEqual(1);expect(r.horizontal.a).not.toEqual(r.horizontal.b);expect(r.radial.center[0]).toBeLessThan(r.radial.a[0]);expect(Math.max(...r.mirror.left.map((v,i)=>Math.abs(v-r.mirror.right[i])))).toBeLessThanOrEqual(1);expect(result.original).not.toEqual(result.reversed);
});

test('background palettes and patterns persist, remain beneath photos and survive photo removal',async({page})=>{
  await ready(page);await page.locator('#tab-background').click();await page.locator('[data-paper-mode=gradient]').click();expect(await page.locator('#paper-palette option').count()).toBe(8);expect(await page.locator('#paper-pattern option').count()).toBe(7);
  const previews=new Set();for(const preset of ['sky','ocean','sunset','sakura','mint','midnight','gold','silver']){await page.locator('#paper-palette').selectOption(preset);previews.add(await page.locator('#paper-fill-preview').getAttribute('src'));}expect(previews.size).toBe(8);
  await page.locator('#paper-palette').selectOption('sunset');await page.locator('#paper-pattern').selectOption('radial');await page.locator('#paper-reverse').check();const selected=await project(page);
  await background(page);await range(page,'#opacity',0);await page.locator('#remove-image').click();expect((await project(page)).paperFill).toEqual(selected.paperFill);await page.locator('#undo').click();expect((await project(page)).background.src).not.toBe('');await page.locator('#redo').click();
  await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('#tab-background').click();await expect(page.locator('#paper-palette')).toHaveValue('sunset');await expect(page.locator('#paper-pattern')).toHaveValue('radial');await expect(page.locator('#paper-reverse')).toBeChecked();
  await page.locator('#project-file').setInputFiles({name:'background.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(selected))});expect((await project(page)).paperFill).toEqual(selected.paperFill);
});

test('gradient background pixels export into PNG and PDF; old drafts and invalid presets preserve work',async({page},info)=>{
  await ready(page);const old=await project(page);delete old.paperFill;old.paper='#123456';await page.locator('#project-file').setInputFiles({name:'old.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await page.locator('#tab-background').click();await expect(page.locator('[data-paper-mode=solid]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#background-color')).toHaveValue('#123456');
  await page.locator('#tab-page').click();await page.locator('#page-size').selectOption('short-mini');await page.locator('#tab-background').click();await page.locator('[data-paper-mode=gradient]').click();await page.locator('#paper-palette').selectOption('ocean');await page.locator('#paper-pattern').selectOption('bands');const saved=await project(page);
  const invalid=structuredClone(saved);invalid.paperFill.pattern='unknown';await page.locator('#project-file').setInputFiles({name:'bad.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await expect(page.locator('#toast')).toContainText('原稿を開けませんでした');expect((await project(page)).paperFill).toEqual(saved.paperFill);
  await page.locator('#export-button').click();let event=page.waitForEvent('download');await page.locator('#confirm-export').click();let file=await event;await file.saveAs(info.outputPath('background.png'));const png=await fs.readFile(await file.path());expect(png.readUInt32BE(16)).toBe(640);const samples=await page.evaluate(async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [[20,20],[180,90],[320,180],[600,330]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);},png.toString('base64'));expect(new Set(samples.map(v=>v.join(','))).size).toBeGreaterThan(2);expect(samples.every(v=>v[3]===255)).toBe(true);
  await page.locator('#export-format').selectOption('pdf');event=page.waitForEvent('download');await page.locator('#confirm-export').click();file=await event;await file.saveAs(info.outputPath('background.pdf'));
});
