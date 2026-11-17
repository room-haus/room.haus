import {records, releases, routeOf} from './catalog.mjs';

// Deploy the same lookup used by the local static server as a CloudFront viewer-request function.
// Rewriting to distinct object keys makes the cached HTML independent of the query-string policy.
export function cloudFrontSource(prefix = '') {
  if (prefix && !/^\/_releases\/[a-f0-9]{40}$/.test(prefix)) throw Error('Expected a release commit SHA');
  const pages = ['/mixes/', '/releases/', ...records.map(routeOf)].map((path) => path.slice(0, -1));
  return `var prefix = ${JSON.stringify(prefix)};
var aliases = ${JSON.stringify(Object.fromEntries(releases.map((record) => [record.id, routeOf(record).slice(0, -1)])))};
var pages = ${JSON.stringify(Object.fromEntries(pages.map((path) => [path, 1])))};
function handler(event) {
  var request = event.request;
  var path = request.uri.replace(/\\/$/, '');
  if (path === '' || path === '/index.html') {
    request.uri = prefix + '/index.html';
    return request;
  }
  if (path === '/mixes' && request.querystring.mx) {
    path += '/' + request.querystring.mx.value.toUpperCase();
  }
  if (path.indexOf('/releases/') === 0) {
    var id = path.slice(10);
    if (Object.prototype.hasOwnProperty.call(aliases,id)) path = aliases[id];
  }
  if (Object.prototype.hasOwnProperty.call(pages, path)) {
    request.uri = prefix + path + '/index.html';
    return request;
  }
  if (!/\\.[^/]+$/.test(path)) {
    return {statusCode: 404, statusDescription: 'Not Found', headers: {'content-type': {value:'text/html; charset=utf-8'}},
      body:'<!doctype html><html lang="en"><title>Record unavailable | ROOM</title><h1>Record unavailable</h1><a href="/mixes/">Browse the ROOM archive</a></html>'};
  }
  if (path.indexOf('/worklets/') === 0 || path.indexOf('/models/') === 0 || path === '/favicon.png') request.uri = prefix + request.uri;
  return request;
}
`;
}
