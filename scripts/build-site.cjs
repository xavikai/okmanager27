const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
if(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('src="cloud-manager.js"'))throw Error('Cloud save script missing from game page');
const files=['index.html','arcade.html','arcade.js','install.js','installation-stats.js','cloud-manager.js','cloud-download.js','presence.js','exit-save.js','manual-save.js','app-updates.js','app-exit.js','travel-costs.js','firebase-config.js','manifest.webmanifest','sw.js','contacte.html','privacitat.html','gracies.html','_routes.json','_headers'];
for(const name of files)fs.copyFileSync(path.join(root,name),path.join(out,name));
for(const name of ['icons','data','img','audio','models'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
// La documentació, les regles de servidor i les metadades de Git no són fitxers públics del joc.
for(const name of files){const text=fs.readFileSync(path.join(out,name),'utf8');if(/xavikai|github\.com\/|github\.io/i.test(text))throw Error('Public file exposes GitHub: '+name)}
console.log('Static game ready in dist/; GitHub references excluded.');
