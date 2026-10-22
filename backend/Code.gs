/** AutoLead AI isolated TEST intake. No production collection path exists. */
var DR = Object.freeze({mode:'TEST',policy:'test-2026-10-22-v1',origin:'https://autoleadaigmn-rgb.github.io',path:'/avtoleadtest/',maxDaily:3,cooldown:15});
var DR_HEADERS=['Request ID','Received UTC','Mode','Name','Contact','Service','Vehicle','Description','Preferred time','Consent version','Consent UTC','Status','Notification','Payload hash'];

function showDemoAuthorization() {
  var info=ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  console.log('Authorization status: '+info.getAuthorizationStatus());
  if(info.getAuthorizationStatus()===ScriptApp.AuthorizationStatus.REQUIRED)console.log('Google consent URL: '+info.getAuthorizationUrl());
}
function setupDemoRequests() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  var p=PropertiesService.getScriptProperties(),owner=Session.getEffectiveUser().getEmail();
  if(!/^[^\s@]+@gmail\.com$/i.test(owner))throw new Error('Run setup as the confirmed Gmail owner.');
  if(p.getProperty('OWNER_EMAIL')&&p.getProperty('OWNER_EMAIL')!==owner)throw new Error('Owner mismatch.');
  p.setProperty('OWNER_EMAIL',owner);
  var id=p.getProperty('REQUESTS_SHEET_ID'),ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('AutoLead AI — Demo Requests');
  if(!id){var s=ss.getSheets()[0];s.setName('Demo Requests');s.getRange(1,1,1,DR_HEADERS.length).setValues([DR_HEADERS]).setBackground('#182321').setFontColor('#ffffff').setFontWeight('bold');s.setFrozenRows(1);s.setColumnWidths(1,DR_HEADERS.length,160);s.setColumnWidth(8,300);s.getRange('A:N').setWrap(true);s.getRange(1,1,1,DR_HEADERS.length).createFilter();p.setProperty('REQUESTS_SHEET_ID',ss.getId());}
  p.setProperty('INTAKE_MODE','TEST');
  console.log(JSON.stringify({mode:'TEST',owner:owner,sheet:ss.getUrl(),realData:'REJECTED',dailyLimit:DR.maxDaily}));
}

function doGet(){return drJson_({ok:true,mode:'TEST',realDataAccepted:false,policy:DR.policy});}
function doPost(e){
  try{
    if(!e||!e.postData||e.postData.contents.length>6000)return drJson_({ok:false,code:'INVALID_BODY'});
    var input=JSON.parse(e.postData.contents),valid=drValidate_(input,Date.now());
    if(!valid.ok)return drJson_(valid);
    return drJson_(drReceive_(valid.data));
  }catch(err){console.error('Demo intake failed; no request payload logged.');return drJson_({ok:false,code:'SERVER_ERROR',retryable:true});}
}

function drValidate_(x,now){
  var fail=function(code){return {ok:false,code:code};};
  if(!x||typeof x!=='object'||Array.isArray(x))return fail('INVALID_BODY');
  if(x.website)return fail('SPAM_REJECTED');
  if(x.mode!=='TEST'||x.policy!==DR.policy||x.consent!==true)return fail('CONSENT_REQUIRED');
  if(x.site!==DR.origin+DR.path)return fail('SITE_REJECTED');
  if(typeof x.id!=='string'||!/^[a-f0-9-]{36}$/i.test(x.id))return fail('INVALID_ID');
  if(!Number.isFinite(x.startedAt)||now-x.startedAt<3000||now-x.startedAt>3600000)return fail('TIMING_REJECTED');
  if(!Number.isFinite(x.consentedAt)||Math.abs(now-x.consentedAt)>300000)return fail('CONSENT_EXPIRED');
  var allowed={name:['Alex Demo'],contact:['alex@example.com'],service:['Oil & filter change','Brake inspection','Tire service','Engine diagnostics','Routine maintenance'],vehicle:['2019 Toyota Camry'],issue:['Routine service before a road trip'],preferredTime:['Next weekday morning','No preference']};
  var data={id:x.id,consentedAt:x.consentedAt};
  for(var key in allowed){if(typeof x[key]!=='string'||!x[key].trim())return fail('REQUIRED_FIELDS');var value=x[key].trim();if(allowed[key].indexOf(value)<0)return fail('TEST_DATA_ONLY');data[key]=value;}
  return {ok:true,data:data};
}

function drReceive_(d){
  var lock=LockService.getScriptLock();if(!lock.tryLock(10000))return {ok:false,code:'BUSY',retryable:true};
  try{
    var p=PropertiesService.getScriptProperties();
    if(p.getProperty('INTAKE_MODE')!=='TEST')return {ok:false,code:'INTAKE_DISABLED'};
    var sheetId=p.getProperty('REQUESTS_SHEET_ID'),owner=p.getProperty('OWNER_EMAIL');
    if(!sheetId||!owner)return {ok:false,code:'NOT_CONFIGURED'};
    var sheet=SpreadsheetApp.openById(sheetId).getSheetByName('Demo Requests');
    var fingerprint=drHash_([d.name,d.contact,d.service,d.vehicle,d.issue,d.preferredTime].join('\n'));
    var rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,DR_HEADERS.length).getValues():[];
    var now=Date.now(),today=new Date(now).toISOString().slice(0,10),daily=0,last=0;
    for(var i=0;i<rows.length;i++){
      var r=rows[i],received=new Date(r[1]).getTime();
      if(r[0]===d.id||(r[13]===fingerprint&&now-received<86400000))return {ok:true,mode:'TEST',receipt:r[0],duplicate:true,notification:r[12]};
      if(new Date(received).toISOString().slice(0,10)===today)daily++;
      last=Math.max(last,received);
    }
    if(daily>=DR.maxDaily)return {ok:false,code:'DAILY_LIMIT'};
    if(now-last<DR.cooldown*1000)return {ok:false,code:'RATE_LIMIT',retryable:true};
    if(MailApp.getRemainingDailyQuota()<1)return {ok:false,code:'EMAIL_QUOTA',retryable:true};
    var row=sheet.getLastRow()+1;
    sheet.getRange(row,1,1,DR_HEADERS.length).setValues([[d.id,new Date(now).toISOString(),'TEST',d.name,d.contact,d.service,d.vehicle,d.issue,d.preferredTime,DR.policy,new Date(d.consentedAt).toISOString(),'NEW','SENDING',fingerprint]]);
    SpreadsheetApp.flush();
    var notification='SENT';
    try{
      MailApp.sendEmail({to:owner,subject:'[AutoLead TEST] New demo request — '+d.service,body:'TEST ONLY — fictional details. No customer email was sent.\n\nRequest: '+d.id+'\nName: '+d.name+'\nContact: '+d.contact+'\nService: '+d.service+'\nVehicle: '+d.vehicle+'\nDescription: '+d.issue+'\nPreferred time (not confirmed): '+d.preferredTime+'\n\nPrivate owner sheet: https://docs.google.com/spreadsheets/d/'+sheetId+'/edit\nConsent: '+DR.policy+'\n\nDo not reply to the sample contact. Public collection of real data is disabled.',name:'AutoLead AI Test'});
    }catch(err){notification='FAILED_REVIEW';console.error('Owner notification requires review; automatic resend disabled.');}
    sheet.getRange(row,13).setValue(notification);SpreadsheetApp.flush();
    return {ok:true,mode:'TEST',receipt:d.id,duplicate:false,notification:notification};
  }finally{lock.releaseLock();}
}
function drHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function drJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function disableDemoIntake(){PropertiesService.getScriptProperties().setProperty('INTAKE_MODE','DISABLED');console.log('Intake disabled. Existing rows retained.');}
