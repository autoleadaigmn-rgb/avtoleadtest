// Populated from the validated public config before the dialogue module is loaded.
export const SHOP={services:[]};
export function configure(c){const services=SHOP.services;services.splice(0,services.length,...c.services);Object.assign(SHOP,c,{services});}
