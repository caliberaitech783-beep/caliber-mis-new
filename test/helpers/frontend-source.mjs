import {readFileSync} from 'node:fs';
const moved=JSON.parse(readFileSync(new URL('./source-file-map.json',import.meta.url),'utf8'));
// Existing source-level regression checks address historical filenames.
export function frontendSourceUrl(name){
 const old='src/'+name;
 return new URL('../../'+(moved[old]||old),import.meta.url);
}

export function repositorySourceUrl(name){
 return new URL('../../'+(moved[name]||name),import.meta.url);
}
