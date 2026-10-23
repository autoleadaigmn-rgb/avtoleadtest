import {readFile,writeFile} from 'node:fs/promises';
const [baylineId,cedarId]=process.argv.slice(2);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!uuid.test(baylineId||'')||!uuid.test(cedarId||'')||baylineId===cedarId)throw Error('Two distinct D1 UUIDs required');
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
if(config.vars.MODE!=='TEST_ONLY'||config.vars.MAIL_TRANSPORT!=='SIMULATED'||config.vars.GOOGLE_CLIENT_ID!=='NOT_CONNECTED'||config.vars.OWNER_MEMBERSHIPS!=='{}')throw Error('Unexpected test safety settings');
config.workers_dev=true;
config.preview_urls=false;
config.triggers={crons:['*/15 * * * *']};
for(const db of config.d1_databases){db.database_id=db.binding==='BAYLINE_DB'?baylineId:cedarId;db.database_name=db.binding==='BAYLINE_DB'?'starter2-bayline-test':'starter2-cedar-ridge-test';db.remote=true;}
await writeFile('wrangler.test-cloud.jsonc',JSON.stringify(config,null,2)+'\n',{flag:'wx'});
console.log('Created ignored wrangler.test-cloud.jsonc with only D1 IDs and TEST_ONLY/SIMULATED. No secret included.');
