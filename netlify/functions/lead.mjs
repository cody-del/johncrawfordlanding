import {createLeadHandler} from '../lib/lead-http.mjs';

export default createLeadHandler();
// Netlify counts these requests itself, for every copy of the function and across restarts,
// and answers a visitor over the limit with a 429 (app.js then asks them to call). The
// in-memory limit in lead-http.mjs stays as a second, longer window.
export const config = {path: '/api/lead', rateLimit: {windowLimit: 10, windowSize: 180, aggregateBy: ['ip', 'domain']}};
