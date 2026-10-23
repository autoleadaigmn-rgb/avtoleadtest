import {build} from 'esbuild';
await build({entryPoints:['src/worker.js'],outfile:'build/worker.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',sourcemap:false});
console.log('Local Worker bundle built; no deployment performed.');
