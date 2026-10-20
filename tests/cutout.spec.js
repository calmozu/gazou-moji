import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
async function ready(page){await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('#tab-overlay').click();}
async function upload(page){const src=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=120;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,160,120);x.fillStyle='#dd2233';x.fillRect(40,20,80,80);x.fillStyle='#ffffff';x.fillRect(60,40,40,40);x.clearRect(0,0,5,5);return c.toDataURL().split(',')[1];});await page.locator('#overlay-file').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:Buffer.from(src,'base64')});await expect(page.locator('#cutout-overlay')).toBeVisible();}
async function range(page,id,value){await page.locator('#cutout-'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);await expect(page.locator('#cutout-apply')).toBeEnabled();}
async function pixel(page,x,y){return page.locator('#cutout-preview').evaluate((c,[x,y])=>[...c.getContext('2d').getImageData(x,y,1,1).data],[x,y]);}
async function project(page){const event=page.waitForEvent('download');await page.locator('#save-project').click();return JSON.parse(await fs.readFile(await (await event).path(),'utf8'));}
async function open(page){await page.locator('#cutout-overlay').click();await expect(page.locator('#cutout-apply')).toBeEnabled();}
async function layerPixels(page,src,points){return page.evaluate(async({src,points})=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return points.map(([a,b])=>[...x.getImageData(a,b,1,1).data]);},{src,points});}

test('color cutout previews closed holes, connected background, original comparison, and cancel',async({page})=>{
 await ready(page);await upload(page);await open(page);expect((await pixel(page,10,10))[3]).toBe(0);expect((await pixel(page,80,60))[3]).toBe(0);expect((await pixel(page,50,30))[3]).toBe(255);
 await page.locator('#cutout-connected').check();await expect(page.locator('#cutout-apply')).toBeEnabled();expect((await pixel(page,80,60))[3]).toBe(255);expect((await pixel(page,10,10))[3]).toBe(0);
 await page.locator('#cutout-original').check();expect(await pixel(page,10,10)).toEqual([255,255,255,255]);await page.locator('#cutout-original').uncheck();expect((await pixel(page,10,10))[3]).toBe(0);
 await page.locator('#cutout-pick').click();await page.locator('#cutout-preview').click({position:{x:50,y:30}});await expect(page.locator('#cutout-color')).toHaveValue('#dd2233');await expect(page.locator('#cutout-apply')).toBeEnabled();
 await page.locator('#cutout-cancel').click();const s=await project(page);expect(s.overlays[0].originalSrc).toBeUndefined();expect((await layerPixels(page,s.overlays[0].src,[[10,10]]))[0][3]).toBe(255);
});

test('applied cutout preserves alpha in PNG, roundtrips original, restores and supports undo',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await upload(page);await open(page);await range(page,'feather',0);await page.locator('#cutout-apply').click();await expect(page.locator('#cutout-dialog')).not.toBeVisible();await expect(page.locator('#restore-overlay')).toBeVisible();
 const s=await project(page),item=s.overlays[0];expect(item.originalSrc).toBeTruthy();expect(item.cutoutSettings).toMatchObject({mode:'color',feather:0});expect((await layerPixels(page,item.src,[[10,10],[80,60],[50,30],[2,2]])).map(p=>p[3])).toEqual([0,0,255,0]);
 const event=page.waitForEvent('download');await page.locator('#save-overlay-png').click();const file=await event;expect(file.suggestedFilename()).toMatch(/_切り抜き\.png$/);const bytes=await fs.readFile(await file.path());const decoded=await layerPixels(page,'data:image/png;base64,'+bytes.toString('base64'),[[10,10],[50,30]]);expect(decoded[0][3]).toBe(0);expect(decoded[1]).toEqual([221,34,51,255]);
 await expect(page.locator('#save-status')).toContainText('保存済み');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('#tab-overlay').click();expect((await project(page)).overlays).toEqual(s.overlays);
 await open(page);await page.locator('#cutout-cancel').click();await page.locator('#restore-overlay').click();await expect(page.locator('#restore-overlay')).toBeHidden();expect((await project(page)).overlays[0].src).toBe(item.originalSrc);
 await page.locator('#undo').click();await expect(page.locator('#restore-overlay')).toBeVisible();expect((await project(page)).overlays[0].src).toBe(item.src);expect(errors).toEqual([]);
});

test('real person photo is segmented locally and survives repeated strength adjustments',async({page})=>{
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5173')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await ready(page);await page.locator('#overlay-file').setInputFiles('tests/fixtures/astronaut.png');await open(page);await page.locator('#cutout-person-mode').click();await expect(page.locator('#cutout-apply')).toBeEnabled({timeout:30000});expect((await pixel(page,220,120))[3]).toBeGreaterThan(240);expect((await pixel(page,20,20))[3]).toBe(0);
 await range(page,'strength',70);await range(page,'strength',50);await page.locator('#cutout-apply').click();await expect(page.locator('#cutout-dialog')).not.toBeVisible();const s=await project(page);expect(s.overlays[0].cutoutSettings.mode).toBe('person');const pixels=await layerPixels(page,s.overlays[0].src,[[220,120],[20,20]]);expect(pixels[0][3]).toBeGreaterThan(240);expect(pixels[1][3]).toBe(0);expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('cutout pixels preserve original transparency, soften edges, and reject malformed settings',async({page})=>{
 await ready(page);const result=await page.evaluate(async()=>{const {cutoutPixels}=await import('/src/cutout-pixels.js');const settings={mode:'color',color:'#ffffff',tolerance:15,feather:0,connected:false,strength:50};const run=(pixels,feather=0)=>[...cutoutPixels({width:3,height:1,pixels:new Uint8ClampedArray(pixels),settings:{...settings,feather}})];return {hard:run([255,255,255,255,221,34,51,128,255,255,255,0]),soft:run([255,255,255,255,221,34,51,255,255,255,255,255],1)};});expect(result.hard.filter((_,i)=>i%4===3)).toEqual([0,128,0]);expect(result.soft[7]).toBeGreaterThan(0);expect(result.soft[7]).toBeLessThan(255);
 await upload(page);const s=await project(page);s.overlays[0].originalSrc=s.overlays[0].src;s.overlays[0].cutoutSettings={mode:'person',color:'#ffffff',tolerance:10,feather:99,connected:false,strength:50};await page.locator('#project-file').setInputFiles({name:'invalid.kasane',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await expect(page.locator('#toast')).toContainText('原稿を開けませんでした');expect((await project(page)).overlays[0].originalSrc).toBeUndefined();
});
