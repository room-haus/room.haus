import {createHash} from 'node:crypto';

// Expiry can change independently of the exact performance the maker heard.
export function performanceDigest({recipe, dry, take, fragments}) {
  return createHash('sha256').update(JSON.stringify({recipe, dry, take, fragments})).digest('hex');
}

export async function readPreparationProof(store, record) {
  const proof = await store.read('preparation-proofs/' + record.id);
  if (proof === null && record.performanceSha256 === undefined) return null;
  const digest = performanceDigest(record);
  if (proof?.toString() !== digest || record.performanceSha256 !== digest) throw Error('Stored preparation checksum mismatch.');
  return digest;
}
