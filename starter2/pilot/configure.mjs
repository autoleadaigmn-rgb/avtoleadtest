import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {shopConfig} from './config.js';
const file=process.argv[2];if(!file)throw Error('Usage: node pilot/configure.mjs pilot/profiles/bayline.example.json [existing-D1-UUID]');
const profile=JSON.parse(await readFile(resolve(file),'utf8')),c=shopConfig({SHOP_CONFIG:JSON.stringify(profile)});
const d1=process.argv[3]||'00000000-0000-0000-0000-000000000000';if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(d1))throw Error('Invalid D1 UUID');
const config={name:'autolead-pilot-'+c.id,main:'build/worker.mjs',compatibility_date:'2026-07-30',workers_dev:false,preview_urls:false,assets:{directory:'public',binding:'ASSETS',run_worker_first:true},vars:{MODE:'TEST_ONLY',MAIL_TRANSPORT:'SIMULATED',REAL_DATA_APPROVED:'false',PRIVACY_REVIEWED:'false',GOOGLE_CLIENT_ID:'NOT_CONNECTED',SHOP_CONFIG:JSON.stringify(c)},d1_databases:[{binding:'PILOT_DB',database_name:'autolead-pilot-'+c.id,database_id:d1,migrations_dir:'migrations',remote:true}],triggers:{crons:['*/15 * * * *']}};
const output=resolve('pilot','wrangler.local-'+c.id+'.jsonc');await writeFile(output,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
console.log('Validated fictional/public shop profile. Wrote ignored disabled config: '+output+'\nNo Cloudflare resource was created. Do not deploy this placeholder config. Set owner email, Google sub, sender address and API keys only as Worker secrets after approval.');
