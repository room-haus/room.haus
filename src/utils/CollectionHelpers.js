export const forceIterable = (input) => {
  // checks for null and undefined
  if ([undefined, null].includes(input)) {
    return [];
  }
  return typeof input[Symbol.iterator] === 'function' ? input : [input];
};

export const resolve = (thing) => (typeof thing === 'function' ? thing() : thing);
