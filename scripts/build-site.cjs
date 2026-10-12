const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
const files=['index.html','install.js','installation-stats.js','cloud-manager.js','firebase-config.js','manifest.webmanifest','sw.js','contacte.html','gracies.html','_routes.json','_headers'];
for(const name of files)fs.copyFileSync(path.join(root,name),path.join(out,name));
for(const name of ['icons','data','img'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
// La documentació, les regles de servidor i les metadades de Git no són fitxers públics del joc.
for(const name of files){const text=fs.readFileSync(path.join(out,name),'utf8');if(/xavikai|github\.com\/|github\.io/i.test(text))throw Error('Public file exposes GitHub: '+name)}
console.log('Static game ready in dist/; GitHub references excluded.');
