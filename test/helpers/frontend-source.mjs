import {readFileSync} from 'node:fs';
const moved=JSON.parse(readFileSync(new URL('../../docs/frontend-file-map.json',import.meta.url),'utf8'));
// Existing source-level regression checks address historical filenames.
export function frontendSourceUrl(name){
 const old='src/'+name;
 return new URL('../../'+(moved[old]||old),import.meta.url);
}
