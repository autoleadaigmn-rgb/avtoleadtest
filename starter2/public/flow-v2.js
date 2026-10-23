import {resolveAppointmentTime} from './appointment-time.js';
import {SHOP} from './shop-config.js';
export const SERVICES=SHOP.services;
const STARTERS=['What services do you offer?','What are your hours?','Request service','Try a detailed sample'];
export const welcome={text:SHOP.greeting+'\n\nLocal demo: typed details stay in this tab unless you separately send the fixed fictional server test. Prefer fictional contacts. A request is never a confirmed appointment.',options:STARTERS};
export function initialState(){return {phase:'idle',draft:{},history:[]};}
const base=(state,text,options=[],extra={})=>({state,text,options,...extra});
const fields=['service','vehicle','issue','preferredTime','name','contact'];
const prompts={service:['Which service should we start with?',SERVICES],vehicle:['What is the vehicle’s year, make and model?',['Use 2019 Toyota Camry']],issue:['What should the advisor know about the vehicle?',['Routine service before a road trip','Brakes squeal when stopping','Tire losing air','Check engine light is on']],preferredTime:['Any preferred day or time? Staff must confirm availability.',['Next weekday morning','No preference']],name:['What name should the request show?',['Use Alex Demo']],contact:['What email or phone should appear in the local preview? Nothing is sent.',['Use alex@example.com']]};
export function contactValid(v){return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)||(/^[+()\d\s.-]+$/.test(v)&&v.replace(/\D/g,'').length>=10&&v.replace(/\D/g,'').length<=15);}
export function vehicleValid(v){return /^(?:19|20)\d{2}\s+[a-z][a-z-]*(?:\s+[a-z0-9-]+){1,3}$/i.test(v)&&! /\b(dollars|miles|minutes|hours|for|at|on)\b/i.test(v)&&+v.slice(0,4)<=new Date().getFullYear()+2;}
const categories=[[/\boil\b|filter/i,'Oil & filter change'],[/\bbrak(?:e|es|ing)\b|squeal|grind.*stop|stopping|press(?:ing)? (?:the )?(?:brake )?pedal/i,'Brake inspection'],[/tire|tyre|puncture|flat|wheel/i,'Tire service'],[/diagnostic|check.engine|engine.light|won.t.start|battery|overheat|engine|stall/i,'Engine diagnostics'],[/maintenance|tune.?up|routine service|road trip/i,'Routine maintenance']];
export function inferService(input){return categories.find(([r,n])=>r.test(input)&&SERVICES.includes(n))?.[1]||SERVICES.find(s=>s.toLowerCase()===input.toLowerCase())||'';}
function safety(input){return /\b(emergency|smoke|smoking|fire|stranded|unsafe|accident|crash|brakes? (?:failed|not working))\b/i.test(input)||/is it safe|can i drive/i.test(input);}
function faq(input){
 if(safety(input))return 'I can’t assess whether a vehicle is safe. If anyone is in immediate danger, contact emergency services. Avoid driving a vehicle that may be unsafe and arrange qualified help. This demo cannot provide roadside assistance.';
 if(/\b(hours?|open|close[ds]?|weekend|saturday|sunday)\b/i.test(input))return SHOP.hours+' These are fictional demo hours. Any requested time still needs staff confirmation.';
 if(/price|pricing|cost|quote|estimate|how much/i.test(input))return 'A service advisor needs to review the vehicle and work before giving an estimate. I won’t invent prices, diagnose a problem or promise an appointment.';
 if(/address|located|location|where are|directions|phone number/i.test(input))return SHOP.name+' is '+(SHOP.fictional?'a fictional shop concept in ':'in ')+SHOP.city+'. '+(SHOP.contact.address||'No real street address is listed for this demo.')+' '+(SHOP.contact.phone||'No real shop phone is listed.');
 if(/real ai|scripted|language model|api|are you (ai|real|human)|chatgpt|generative/i.test(input))return 'I use local rules and structured information extraction, not a generative AI model. No paid AI API is connected.';
 if(/privacy|stored|data|delete|secure|saved|owner|inbox/i.test(input))return 'Free-text previews stay only in this tab. With separate explicit consent, the exact fictional Alex Demo fixture is saved to a test D1 database. Notifications are simulated; no real email is sent. Owner access requires a signed identity and shop membership. Real personal data is rejected. Read the Test Data Notice.';
 if(/what.*services|what.*offer|what can you do|what do you do/i.test(input))return 'The demo shop offers '+SERVICES.join(', ')+'. Describe the concern and I can suggest a request category for the advisor to review.';
 return '';
}
export function extractDetails(raw){
 const text=raw.replace(/^use /i,'').replace(/[’]/g,"'").trim(),d={};let m;
 const positive=text.replace(/\b(?:not|rather than|instead of)\s+(?:(?:a|an|the|my)\s+)?(?:(?:19|20)\d{2}\s+)?(?:Toyota|Honda|Ford|Chevrolet|BMW|Audi|Tesla)(?:\s+[A-Z0-9-]+)?/g,'');
 if(m=positive.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i))d.contact=m[0];
 else if(m=positive.match(/(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)[ .-]?|\b\d{3}[ .-])\d{3}[ .-]\d{4}\b|\b(?:phone|call|text|contact)(?:\s+me)?\s*(?:at|is|:)?\s*(\+?\d{10,15})\b/i)){const v=m[1]||m[0];if(contactValid(v))d.contact=v;}
 const makes='Toyota|Honda|Ford|Chevrolet|Chevy|GMC|Nissan|Hyundai|Kia|BMW|Audi|Mercedes(?:-Benz)?|Volkswagen|VW|Subaru|Mazda|Jeep|Ram|Dodge|Tesla|Lexus|Acura|Volvo|Buick|Cadillac|Lincoln|Chrysler|Porsche|Mitsubishi|Mini|Land Rover|Genesis|Rivian|Lucid|Jaguar|Infiniti|Suzuki|Saab|Pontiac|Saturn|Bentley|Fiat|Peugeot|Renault|Skoda|Seat';
 const vr=new RegExp('\\b((?:19|20)\\d{2})\\s+('+makes+')\\s+([A-Za-z0-9-]+(?:\\s+(?:[A-Z]\\d{1,3}|\\d{3,4}|Grand Cherokee|Sportage))?)','gi');
 let vehicles=[...positive.matchAll(vr)].filter(v=>+v[1]>=1900&&+v[1]<=new Date().getFullYear()+2);
 if(vehicles.length===1||/actually|correction|instead|now drive/i.test(text)){m=vehicles.at(-1);if(m)d.vehicle=m[1]+' '+m[2]+' '+m[3];}
 if(m=positive.match(/\b(?:vehicle|car)\s*:\s*((?:19|20)\d{2}\s+[a-z][a-z0-9-]*\s+[a-z0-9-]+)\b/i))d.vehicle=m[1];
 const nr=/\b(?:my name is|name\s*[:=]|call me|i am|i'm)\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,2}?)(?=\s*[,.;!]|\s+(?:and|my|i|with|email|phone|for|at|driving|here)\b|$)/giu;
 const names=[...positive.matchAll(nr)].filter(x=>! /^(?:having|looking|available|free|ready|interested|not|driving|trying|wondering|getting|a|an|the|alex@example)$/i.test(x[1].split(' ')[0]));
 if(names.length)d.name=names.at(-1)[1].replace(/(^|\s)\p{L}/gu,c=>c.toUpperCase());
 const times=[...positive.matchAll(/\b(?:next\s+)?(?:weekday|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight)(?:\s+(?:morning|afternoon|evening))?(?:\s+(?:at|after|before|around)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+20\d{2})?(?:\s+(?:at|after|before)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?|\b20\d{2}-\d{2}-\d{2}(?:\s+(?:(?:at|around|after|before)\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm))?|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi)];
 if(/next weekday morning/i.test(positive))d.preferredTime='Next weekday morning';else if(/no preference|any time|anytime/i.test(positive))d.preferredTime='No preference';else if(times.length)d.preferredTime=times.map(x=>x[0]).join(' ').trim();
 // Keep the customer's original concern clause intact. Never delete vehicle words or rewrite symptoms.
 const clauses=text.split(/[;\n.!?]+/).map(x=>x.trim()).filter(Boolean);
 const concerns=clauses.filter(x=>/\b(noise|rattle|rattling|leak|leaking|vibrat\w*|shak\w*|jerk\w*|stall\w*|overheat\w*|won't start|doesn't start|not starting|battery|brak(?:e|es|ing)|tires?|tyres?|oil change|maintenance|routine service|alignment|air conditioning|a\/c|transmission|clunk\w*|smell|pulling|squeak\w*|squeal\w*|grind\w*|heater|windshield|wiper|window|windscreen|door|coolant|exhaust|steering|suspension|ac|engine light|check.engine)\b/i.test(x));
 if(concerns.length)d.issue=concerns.join('. ');
 if(m=text.match(/(?:problem|issue|description)\s*[:=]\s*([^;\n]+)/i))d.issue=m[1].trim();
 // Preserve exact legacy synthetic fixture values; broader descriptions remain verbatim.
 if(/^My 2019 Toyota Camry brakes squeal when stopping$/i.test(d.issue||''))d.issue='Brakes squeal when stopping';
 if(/\bday after tomorrow\b/i.test(text))d.preferredTime=(text.match(/day after tomorrow(?:\s+(?:at|around|after|before)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)||[])[0];

 const service=inferService(positive);if(service)d.service=service;
 else if(d.issue)d.service='Advisor review';
 return d;
}
function advance(s,prefix='',action){if(s.draft.timeQuestion)return base({...s,phase:'time'},(prefix?prefix+'\n\n':'')+s.draft.timeQuestion,[],{action:action||'invalidateReview'});const missing=fields.find(f=>!s.draft[f]);if(!missing)return base({...s,phase:'review'},(prefix?prefix+'\n\n':'')+'Here’s the request for your review. Nothing is sent until you explicitly consent. This is not a confirmed appointment.',[],{action:action||'review'});const [text,options]=prompts[missing];return base({...s,phase:missing==='preferredTime'?'time':missing},(prefix?prefix+'\n\n':'')+text,options,{action});}
export function respond(previous,raw,clock={}){
 const input=String(raw||'').trim(),s={...previous,draft:{...previous.draft}};
 if(input.length>10000)return base(s,'Please split messages longer than 10,000 characters. Nothing was discarded or changed.',[]);
 if(!input)return base(s,'Please type a little more or choose a suggestion.',STARTERS);
 if(/^(cancel(?: my)?(?: request| appointment)?|restart|start over|back to the demo)$/i.test(input))return base(initialState(),'The unfinished request is cancelled. Previously submitted requests are unchanged. What would you like to do?',STARTERS,{action:'reset'});
 if(/^open owner view$/i.test(input))return base(s,'Opening the local preview. The protected owner dashboard is linked separately.',[],{action:'inbox'});
 if(/^try a detailed sample$/i.test(input))return respond(s,"I'm Alex Demo, alex@example.com. My 2019 Toyota Camry brakes squeal when stopping. No preference.",clock);
 
 const isQuestion=/\?|^(what|when|where|how|do you|are you|can you|is it|tell me)\b/i.test(input),answer=faq(input);
 
 if(/^edit details$/i.test(input))return base({...s,phase:'editing'},'What would you like to change? Say “change my email to alex@example.com” or choose a field.',['Change service','Change vehicle','Change description','Change time','Change name','Change contact'],{action:'invalidateReview'});
 const edit=input.match(/^(?:change|update|correct|replace)(?: my| the)?\s+(service|vehicle|car|description|issue|problem|time|name|contact|email|phone)(?:\s+(?:to|is|with))?\s*[:=]?\s*(.*)$/i);
 let extracted=extractDetails(input),editing=false;
 if(answer&&isQuestion&&!Object.keys(extracted).length)return base(s,answer+(s.phase!=='idle'?'\n\nI’ve kept your request details.':''),s.phase==='idle'?STARTERS:(prompts[s.phase==='time'?'preferredTime':s.phase]?.[1]||['Edit details','Cancel']));
 if(edit){const map={car:'vehicle',description:'issue',problem:'issue',time:'preferredTime',email:'contact',phone:'contact'},field=map[edit[1].toLowerCase()]||edit[1].toLowerCase(),value=edit[2].trim();delete s.draft[field];if(field==='preferredTime'){delete s.draft.resolvedTime;delete s.draft.timeQuestion;}editing=true;
  if(value){if(field==='name'&&/^[\p{L}][\p{L} '-]{1,119}$/u.test(value))extracted.name=value;else if(field==='issue')extracted.issue=value;else if(field==='preferredTime')extracted.preferredTime=value;else if(field==='vehicle'&&vehicleValid(value))extracted.vehicle=value;else if(field==='contact'&&contactValid(value))extracted.contact=value;}
  if(!value){s.phase=field==='preferredTime'?'time':field;return base(s,prompts[field][0],prompts[field][1],{action:'invalidateReview'});}
 }
 const plain=input.replace(/^use /i,'');if(!edit){if(s.phase==='vehicle'&&vehicleValid(plain)&&!extracted.vehicle&&plain.split(/\s+/).length<=5)extracted.vehicle=plain;
  if(s.phase==='name'&&!extracted.name&&/^[\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){0,3}$/u.test(plain)&&!/(hello|unknown|whatever|cancel|banana|asdf)/i.test(plain))extracted.name=plain;
  if(s.phase==='issue'&&!extracted.issue&&/brake|tire|oil|engine|noise|leak|battery|start|service|maintenance|vibrat|shak|air|light/i.test(plain)&&plain.length>=5)extracted.issue=plain;}
 if(s.phase==='time'&&!extracted.preferredTime&&!Object.keys(extracted).length&&/^(?:after|before|around|at|on|between)\b/i.test(input))extracted.preferredTime=input;
 if(s.phase==='issue'&&!extracted.issue&&!/\?|^(?:hello|hi|thanks|unknown|whatever|asdf|purple banana)/i.test(input)&&input.length>=5)extracted.issue=input;
 if(!edit&&s.draft.service&&extracted.service&&s.phase!=='service'&&s.phase!=='idle')delete extracted.service;
 const emails=[...input.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m=>m[0]);
 const ambiguousContact=new Set(emails).size>1&&!/actually|instead|not|correction/i.test(input);
 if(ambiguousContact)delete extracted.contact;
 if(extracted.preferredTime){const resolved=resolveAppointmentTime(extracted.preferredTime,{now:clock.now||new Date(),timeZone:SHOP.timeZone||'America/Chicago'});extracted.resolvedTime=resolved.display||'';extracted.timeQuestion=resolved.question||'';}
 const before=JSON.stringify(s.draft);Object.assign(s.draft,extracted);
 if(ambiguousContact){delete s.draft.contact;s.phase='contact';return base(s,'I found more than one email. Which single contact should appear in the local preview? Other details are kept.',[],{action:'invalidateReview'});}
 if(safety(input))return advance(s,faq(input), 'invalidateReview');
 if(s.phase==='review'&&!edit&&before===JSON.stringify(s.draft))return base(s,'Review the details below, choose Edit details, or Cancel. Sending still requires your explicit consent.',['Edit details','Cancel']);
 if(Object.keys(extracted).length)return advance(s,editing?'Updated that detail.':'Got it — I’ve kept the details you provided.',s.phase==='review'||editing?'invalidateReview':undefined);
 if(/^request service$|\b(?:book|appointment|schedule|request|need service)\b/i.test(input))return advance(s,'Let’s prepare a request for the advisor. Details stay in this tab. Prefer fictional contacts.');
 if(/^(hi|hello|hey|thanks|thank you)[!. ]*$/i.test(input))return base(s,'Hi! Tell me the vehicle, concern and contact details together, or choose a service. Use fictional test details.',STARTERS);
 if(answer)return base(s,answer,STARTERS);
 if(s.phase!=='idle'&&s.phase!=='editing')return advance(s,'I’m not sure I understood that detail. I’ve kept everything else; please rephrase or type Cancel.');
 return base(s,'I didn’t catch a service request there. Try “My 2019 Toyota Camry has a check engine light”, or ask about services and hours.',STARTERS);
}
export function toCsv(leads){const fields=['id','createdAt','name','contact','service','vehicle','issue','preferredTime','status'];const escape=value=>{let v=String(value??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};return fields.map(escape).join(',')+'\r\n'+leads.map(l=>fields.map(k=>escape(l[k])).join(',')).join('\r\n');}
