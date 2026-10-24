const path = require('node:path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Per-component Paper imports instead of the whole library; applied in
    // development too so a debug build runs exactly the modules a release does.
    plugins: [['react-native-paper/babel', { mappings: path.join(__dirname, 'paperImportMappings.js') }]],
  };
};
