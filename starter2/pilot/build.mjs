import {build} from 'esbuild';
await build({entryPoints:['pilot/worker.js'],outfile:'pilot/build/worker.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',sourcemap:false});
console.log('Pilot Worker built locally. No deployment or real-data intake enabled.');
