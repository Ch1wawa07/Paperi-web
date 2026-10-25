import {copyFileSync,mkdirSync,cpSync} from 'node:fs';
mkdirSync('public',{recursive:true});
copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','public/pdf.worker.min.mjs');

for(const folder of ['cmaps','standard_fonts'])cpSync('node_modules/pdfjs-dist/'+folder,'public/pdfjs/'+folder,{recursive:true});
