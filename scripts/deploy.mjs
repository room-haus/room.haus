// Invoked by the release workflow after verifying an exact master commit.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cloudFrontSource} from './routing.mjs';
import {records, routeOf} from './catalog.mjs';

const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('Expected a full release commit SHA.');
const bucket = 'room.haus';
const distribution = 'E240MGV7PK0AIJ';
const functionName = 'room-archive-' + sha.slice(0, 16);
const prefix = '/_releases/' + sha;
const config = {Comment: 'ROOM archive ' + sha, Runtime: 'cloudfront-js-2.0'};
function aws(...args) {
  return execFileSync('aws', [...args, '--output', 'json'], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
}
function cloud(...args) {
  return JSON.parse(aws('cloudfront', ...args) || '{}');
}
const current = cloud('get-distribution-config', '--id', distribution);
const dist = current.DistributionConfig;
if (!dist.Aliases.Items.includes(bucket)) throw Error('Distribution does not serve ROOM.');
const behavior = dist.DefaultCacheBehavior;
const origin = dist.Origins.Items.find((item) => item.Id === behavior.TargetOriginId);
if (!origin || !origin.DomainName.startsWith(bucket + '.s3') || origin.OriginPath)
  throw Error('Check ROOM bucket/origin mapping before deploying.');
// An ordered behavior takes precedence over the default viewer-request handler.
const directories = [
  '/mixes/',
  '/releases/',
  ...records.map(routeOf),
  ...records.filter((record) => record.slug).map((record) => '/releases/' + record.id + '/'),
];
const publicPaths = [
  '/',
  '/index.html',
  ...directories.flatMap((uri) => [uri, uri.slice(0, -1)]),
  ...readdirSync('dist', {recursive: true, withFileTypes: true})
    .filter((file) => file.isFile())
    .map((file) => '/' + path.relative('dist', path.join(file.parentPath, file.name)).split(path.sep).join('/')),
];
for (const item of dist.CacheBehaviors?.Items || []) {
  const pattern = '/' + item.PathPattern.replace(/^\//, '');
  const regex = new RegExp(
    '^' +
      pattern
        .split('')
        .map((c) => {
          if (c === '*') return '.*';
          if (c === '?') return '.';
          return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('') +
      '$',
  );
  if (publicPaths.some((uri) => regex.test(uri)))
    throw Error('Integrate ordered CloudFront behavior before publishing: ' + pattern);
}
const associations = behavior.FunctionAssociations?.Items || [];
const previous = associations.find((f) => f.EventType === 'viewer-request');
if (previous && !previous.FunctionARN.split('/').pop().startsWith('room-archive-'))
  throw Error('Existing viewer request function needs integration.');
if (behavior.LambdaFunctionAssociations?.Items?.some((f) => f.EventType.startsWith('viewer-')))
  throw Error('Existing viewer Lambda needs integration.');

const temp = mkdtempSync(path.join(tmpdir(), 'room-release-'));
try {
  // Shared, content-addressed assets keep older open tabs valid through a release switch.
  const dest = 's3://' + bucket;
  const marker = prefix.slice(1) + '/.uploaded';
  const exists = JSON.parse(
    aws('s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', marker, '--max-keys', '1'),
  ).Contents?.some((object) => object.Key === marker);
  if (!exists) {
    aws(
      's3',
      'sync',
      'dist/assets',
      dest + '/assets',
      '--cache-control',
      'public,max-age=31536000,immutable',
      '--only-show-errors',
    );
    aws(
      's3',
      'sync',
      'dist',
      dest + prefix,
      '--exclude',
      'assets/*',
      '--exclude',
      '_redirects',
      '--cache-control',
      'public,max-age=0,must-revalidate',
      '--only-show-errors',
    );
    const receipt = path.join(temp, 'commit');
    writeFileSync(receipt, sha);
    aws('s3api', 'put-object', '--bucket', bucket, '--key', marker, '--body', receipt);
  }
  const sourcePath = path.join(temp, 'function.js');
  writeFileSync(sourcePath, cloudFrontSource(prefix));
  const existing = cloud('list-functions').FunctionList.Items?.find((f) => f.Name === functionName);
  const options = [
    '--name',
    functionName,
    '--function-config',
    JSON.stringify(config),
    '--function-code',
    'fileb://' + sourcePath,
  ];
  const staged = existing
    ? cloud('update-function', ...options, '--if-match', cloud('describe-function', '--name', functionName).ETag)
    : cloud('create-function', ...options);
  const live = cloud('publish-function', '--name', functionName, '--if-match', staged.ETag);
  const arn = live.FunctionSummary.FunctionMetadata.FunctionARN;
  const oldCompression = behavior.Compress;
  const changed = previous?.FunctionARN !== arn || !oldCompression;
  if (changed) {
    const items = [
      ...associations.filter((f) => f.EventType !== 'viewer-request'),
      {EventType: 'viewer-request', FunctionARN: arn},
    ];
    behavior.FunctionAssociations = {Quantity: items.length, Items: items};
    behavior.Compress = true;
    const cfg = path.join(temp, 'distribution.json');
    writeFileSync(cfg, JSON.stringify(dist));
    cloud(
      'update-distribution',
      '--id',
      distribution,
      '--if-match',
      current.ETag,
      '--distribution-config',
      'file://' + cfg,
    );
  }
  try {
    aws('cloudfront', 'wait', 'distribution-deployed', '--id', distribution);
    execFileSync(process.execPath, ['scripts/check-routes.mjs', 'https://room.haus'], {stdio: 'inherit'});
  } catch (error) {
    if (changed) {
      const latest = cloud('get-distribution-config', '--id', distribution);
      const currentBehavior = latest.DistributionConfig.DefaultCacheBehavior;
      const active = currentBehavior.FunctionAssociations?.Items?.find((f) => f.EventType === 'viewer-request');
      if (active?.FunctionARN !== arn)
        throw Error('Another release changed the active function; inspect the distribution.', {cause: error});
      const kept = currentBehavior.FunctionAssociations.Items.filter((f) => f.EventType !== 'viewer-request');
      if (previous) kept.push(previous);
      currentBehavior.FunctionAssociations = kept.length ? {Quantity: kept.length, Items: kept} : {Quantity: 0};
      currentBehavior.Compress = oldCompression;
      const cfg = path.join(temp, 'rollback.json');
      writeFileSync(cfg, JSON.stringify(latest.DistributionConfig));
      cloud(
        'update-distribution',
        '--id',
        distribution,
        '--if-match',
        latest.ETag,
        '--distribution-config',
        'file://' + cfg,
      );
      aws('cloudfront', 'wait', 'distribution-deployed', '--id', distribution);
      const restored = cloud('get-distribution-config', '--id', distribution).DistributionConfig.DefaultCacheBehavior;
      if (
        restored.FunctionAssociations?.Items?.find((f) => f.EventType === 'viewer-request')?.FunctionARN !==
        previous?.FunctionARN
      ) {
        throw Error('Previous viewer request association was not restored.', {cause: error});
      }
      console.error('Restored previous viewer request function after failed release verification.');
    }
    throw error;
  }
  console.log('Published ' + sha + '. Previous viewer request function: ' + (previous?.FunctionARN || 'none'));
} finally {
  rmSync(temp, {recursive: true, force: true});
}
