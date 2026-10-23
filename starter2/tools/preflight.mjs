import {readFile,readdir} from 'node:fs/promises';
import {TENANTS,validateConfig} from '../src/tenants.js';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
if(config.vars.MODE!=='TEST_ONLY'||config.vars.MAIL_TRANSPORT!=='SIMULATED'||config.workers_dev!==false||config.preview_urls!==false)throw Error('UNSAFE_DEPLOYMENT_CONFIG');
if(config.d1_databases.some(d=>d.remote!==false))throw Error('REMOTE_BINDING_NOT_ALLOWED');
for(const t of Object.values(TENANTS))validateConfig(t.public);
const tools=await readdir('tools');if(tools.includes('debug.mjs'))throw Error('REMOVE_DEBUG_TOOL');
if(process.argv.includes('--cloud')){
 if(config.d1_databases.some(d=>d.database_id.startsWith('00000000-')))throw Error('CLOUD_RESOURCES_NOT_CONNECTED');
 if(config.vars.GOOGLE_CLIENT_ID==='NOT_CONNECTED'||config.vars.OWNER_MEMBERSHIPS==='{}')throw Error('OWNER_AUTH_NOT_CONNECTED');
 throw Error('CLOUD_DEPLOYMENT_REQUIRES_SEPARATE_USER_APPROVAL; no automatic deploy command is provided');
}
console.log('PASS: local test-only configuration. Cloud deployment intentionally blocked; no paid resources or real intake.');
