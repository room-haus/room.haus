function requireAll(r) {
  r.keys().forEach(r);
}
requireAll(require.context('./', true, /\.jpg$/));
