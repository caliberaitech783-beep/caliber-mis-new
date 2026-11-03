import {requireOperationalDate} from './operational-start.mjs';
import {canonicalSiteName} from '../masters/site-location.mjs';
import {bookShiftCode} from '../scanning/trip-card-rules.mjs';
import {displaySiteName} from '../masters/region-scope.mjs';

const invalid=message=>{throw Object.assign(new Error(message),{status:400})};
export function vlbBatchSelection(input={}){
 const site=canonicalSiteName(String(input.site||'').trim());
 const date=String(input.date||'');
 const shift=bookShiftCode(input.shift);
 if(!site||site.length>200)invalid('Select a site name.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)invalid('Select a valid report date.');
 requireOperationalDate(date);
 if(!shift)invalid('Select a shift.');
 return {site,date,shift};
}
export function vlbBatchPrefix(input){
 const {site,date,shift}=vlbBatchSelection(input),[year,month,day]=date.split('-'),n=Number(day);
 const suffix=n>=11&&n<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');
 const siteSegment=displaySiteName(site).toUpperCase().replace(/[\/\\\x00-\x1f\x7f]/g,'-');
 return `CMLL/${siteSegment}/${day}${suffix} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]} ${year}/${shift}`;
}
export const vlbBatchName=(selection,sequence)=>`${vlbBatchPrefix(selection)}/B${String(sequence).padStart(3,'0')}`;
export const vlbRecordShift=data=>bookShiftCode(data.bookShiftCode)||bookShiftCode(data.cardShift)||bookShiftCode(data.shiftName);
export const vlbRecordSource=record=>record.data?.scanCardId?'VLB Scan':'VLB Manual';
