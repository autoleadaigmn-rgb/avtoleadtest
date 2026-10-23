import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {shopConfig} from './config.js';

const [shop,dbId]=process.argv.slice(2);
if(!['bayline','cedar'].includes(shop)||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(dbId||''))throw Error('Usage: node pilot/prepare-cloud-test.mjs bayline|cedar EXISTING_D1_UUID');
const c=JSON.parse(await readFile(resolve(`pilot/profiles/${shop}.example.json`),'utf8'));
c.siteOrigin='https://autolead-pilot-demo.autolead-ai-gmn.workers.dev';
c.privacyUrl=c.siteOrigin+'/privacy';
c.turnstileSiteKey='1x00000000000000000000AA';
shopConfig({SHOP_CONFIG:JSON.stringify(c)});
const name=`autolead-pilot-${shop}`;
const config={name,main:'build/worker.mjs',compatibility_date:'2026-07-30',workers_dev:true,preview_urls:false,assets:{directory:'public',binding:'ASSETS',run_worker_first:true},vars:{MODE:'TEST_ONLY',TEST_ONLY:'true',MAIL_TRANSPORT:'SIMULATED',REAL_DATA_APPROVED:'false',PRIVACY_REVIEWED:'false',GOOGLE_CLIENT_ID:'440600688751-f5vnrqqa69g1a8f0hh3coruh0noke767.apps.googleusercontent.com',SHOP_CONFIG:JSON.stringify(c)},d1_databases:[{binding:'PILOT_DB',database_name:name,database_id:dbId,migrations_dir:'migrations',remote:true}],triggers:{crons:['*/15 * * * *']}};
const file=resolve(`pilot/wrangler.local-${c.id}.jsonc`);
await writeFile(file,JSON.stringify(config,null,2)+'\n');
console.log(`Prepared ignored disabled test config for ${name}. Existing D1 ID bound. No secret or cloud resource created.`);
