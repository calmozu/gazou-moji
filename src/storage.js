let database;
async function db() {
  if (database) return database;
  database = await new Promise((resolve,reject)=>{
    const request = indexedDB.open('kasane',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('draft');
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
  return database;
}
export async function saveDraft(state) {
  const database=await db();
  return new Promise((resolve,reject)=>{const tx=database.transaction('draft','readwrite'); tx.objectStore('draft').put(state,'current'); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);});
}
export async function loadDraft() {
  const database=await db();
  return new Promise((resolve,reject)=>{const req=database.transaction('draft').objectStore('draft').get('current'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);});
}
