// Civil dates in the shop's IANA zone. Preferences are never calendar bookings.
function resolveCivilTime(raw,{now=new Date(),timeZone='America/Chicago'}={}){
 const text=String(raw||'').trim();if(!text||/^(?:no preference|any time|anytime)$/i.test(text))return {display:text};
 let parts;try{parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'long'}).formatToParts(new Date(now));}catch{return {question:'The shop time zone is unavailable. Please ask the shop to verify its time zone.'};}
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));const today=new Date(Date.UTC(+values.year,+values.month-1,+values.day));
 const iso=d=>d.toISOString().slice(0,10),valid=(y,m,d)=>{const x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d?x:null;};
 const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];let date=null,match;
 const isoMatches=[...text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)],dayMatches=[...text.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)];
 if(isoMatches.length>1||new Set(dayMatches.map(m=>m[1].toLowerCase())).size>1)return {question:'Which one date should I use? Please enter YYYY-MM-DD and a time with AM or PM.'};
 if(isoMatches.length){match=isoMatches[0];date=valid(+match[1],+match[2],+match[3]);if(!date)return {question:'That calendar date is invalid. Please enter a valid YYYY-MM-DD.'};}
 else if(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(text))return {question:'Please confirm that numeric date as YYYY-MM-DD so month and day are unambiguous.'};
 else if(/\bday after tomorrow\b/i.test(text)){date=new Date(today);date.setUTCDate(date.getUTCDate()+2);}
 else if(/\btomorrow\b/i.test(text)){date=new Date(today);date.setUTCDate(date.getUTCDate()+1);}
 else if(/\btoday|\btonight/i.test(text))date=new Date(today);
 else if(/next weekday/i.test(text)){date=new Date(today);do{date.setUTCDate(date.getUTCDate()+1);}while([0,6].includes(date.getUTCDay()));}
 else if(dayMatches.length){let delta=(days.indexOf(dayMatches[0][1].toLowerCase())-today.getUTCDay()+7)%7;if(delta===0&&!/\bnext\b/i.test(text))return {question:'Do you mean today ('+iso(today)+') or the following week? Please confirm YYYY-MM-DD.'};if(!delta)delta=7;date=new Date(today);date.setUTCDate(date.getUTCDate()+delta);}
 else if(match=text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(20\d{2}))?/i)){if(!match[3])return {question:'Which year do you mean? Please confirm the date as YYYY-MM-DD.'};let month=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(match[1].toLowerCase())+1;date=valid(+match[3],month,+match[2]);if(!date)return {question:'That calendar date is invalid. Please enter a valid YYYY-MM-DD.'};}
 else return {question:'Which date do you mean? Please enter YYYY-MM-DD, today, tomorrow, or a weekday, with AM or PM if giving a time.'};
 if(date<today)return {question:'That date is in the past in '+timeZone+'. Which future date should I use?'};
 const clock=text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);let time='';
 if(clock){const h=+clock[1],min=+(clock[2]||0);if(h<1||h>12||min>59)return {question:'Please give a valid time from 1–12 with AM or PM.'};time=h+':'+String(min).padStart(2,'0')+' '+clock[3].replaceAll('.','').toUpperCase();}
 else if(match=text.match(/\b(?:at|around|after|before)\s+(\d{1,2})(?::(\d{2}))?\b|\b(\d{1,2}):(\d{2})\b/i)){if(match[3]||match[2]){const rawHour=match[1]||match[3],h=+rawHour,min=+(match[2]||match[4]);if(h>23||min>59)return {question:'Please give a valid time.'};if(h>=1&&h<=12&&!/^0/.test(rawHour))return {question:'Do you mean AM or PM on '+iso(date)+'? Please enter the date and time together.'};time=String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');}else return {question:'Do you mean AM or PM on '+iso(date)+'? Please enter the date and time together.'};}
 else time=(text.match(/\b(morning|afternoon|evening|tonight|noon|midnight)\b/i)||[])[0]||'time not specified';
 const qualifier=(text.match(/\b(around|after|before)\b/i)||[])[0];
 return {display:iso(date)+' · '+(qualifier?qualifier+' ':'')+time+' ('+timeZone+')',date:iso(date),timeZone,source:text};
}

export function resolveAppointmentTime(raw,options={}){
 const r=resolveCivilTime(raw,options);if(r.question||!r.date)return r;
 const match=r.display.match(/(?:around |after |before )?(\d{1,2}):(\d{2})(?: (AM|PM))? \(/);
 if(!match)return r;let hour=+match[1];const minute=+match[2];if(match[3])hour=(hour%12)+(match[3]==='PM'?12:0);
 const [year,month,day]=r.date.split('-').map(Number),base=Date.UTC(year,month-1,day,hour,minute);
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:r.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const wall=ms=>Object.fromEntries(fmt.formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
 const offsets=new Set();for(const sample of [base-86400000,base,base+86400000]){const p=wall(sample);offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-sample);}
 const candidates=[...offsets].map(offset=>base-offset).filter(ms=>{const p=wall(ms);return p.year===year&&p.month===month&&p.day===day&&p.hour===hour&&p.minute===minute;});
 if(!candidates.length)return {question:'That local time does not exist because the clocks change in '+r.timeZone+'. Please choose another time.'};
 if(candidates.length>1)return {question:'That local time occurs twice because the clocks change in '+r.timeZone+'. Please choose an unambiguous time or ask the shop to confirm.'};
 return r;
}
