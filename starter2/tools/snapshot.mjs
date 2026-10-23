import './build.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createLab} from './lab.mjs';
import {exportState,exportLedger,restoreState} from './snapshots.mjs';
const [action,shop='bayline',file='snapshots/bayline.json',ledgerFile='snapshots/bayline-ledger.json']=process.argv.slice(2);
if(!['export','restore'].includes(action)||!['bayline','bayline-isolation'].includes(shop))throw Error('Usage: node tools/snapshot.mjs export|restore bayline snapshot.json latest-ledger.json');
// No remote flag exists. Stop the local dev server first to avoid concurrent snapshot activity.
const lab=await createLab({persist:resolve(action==='restore'?'.local/recovery':'.local/d1')});
try{
 if(action==='export'){await mkdir('snapshots',{recursive:true});await writeFile(file,JSON.stringify(await exportState(lab.dbs[shop],shop),null,2),{flag:'wx'});await writeFile(ledgerFile,JSON.stringify(await exportLedger(lab.dbs[shop],shop),null,2),{flag:'wx'});console.log('Local fictional snapshot and deletion ledger written. No secrets or remote data exported.');}
 else{const s=JSON.parse(await readFile(file,'utf8')),l=JSON.parse(await readFile(ledgerFile,'utf8'));console.log(await restoreState(lab.dbs[shop],s,l,shop));console.log('Restored into .local/recovery only; active lab data unchanged.');}
}finally{await lab.close();}
