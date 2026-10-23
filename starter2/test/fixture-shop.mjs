import {configure} from '../public/shop-config.js';
import {TENANTS} from '../src/tenants.js';
configure(TENANTS.bayline.public);
const flow=await import('../public/flow-v2.js');
export const {respond,initialState,inferService,extractDetails}=flow;
