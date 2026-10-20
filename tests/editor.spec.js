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
