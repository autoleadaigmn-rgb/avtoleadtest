import {problem} from '../src/security.js';

// Public, deliberately fictional identities. Test mode rejects every other
// contact, vehicle and issue before writing to D1 or calling an email provider.
const fixtures={
 'bayline-pilot':{name:'Alex Fictional',email:'alex@example.com',phone:'',vehicle:'2020 Honda Civic',issue:'Fictional test: brakes make a squeaking noise when stopping.'},
 'cedar-pilot':{name:'Jordan Fictional',email:'jordan@example.com',phone:'',vehicle:'2019 Toyota Camry',issue:'Fictional test: request a routine oil change and inspection.'}
};
export function testFixture(shopId){const fixture=fixtures[shopId];if(!fixture)throw problem('TEST_FIXTURE_NOT_CONFIGURED',503);return fixture;}
export function requireTestFixture(input,shopId){const fixture=testFixture(shopId);if(Object.entries(fixture).some(([key,value])=>input?.[key]!==value))throw problem('TEST_DATA_ONLY',403);}
