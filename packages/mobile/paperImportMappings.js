/**
 * Import mappings for react-native-paper's babel plugin (see babel.config.js).
 *
 * The plugin rewrites `import { Text } from 'react-native-paper'` into a deep
 * import of just that component. Metro does not tree-shake, so without it the
 * barrel pulls the whole library into the bundle - about 250 KB of JS, most of
 * it components the app never renders.
 *
 * Paper's shipped table leaves out MD3LightTheme and MD3DarkTheme. The plugin
 * imports any unmapped name from the library index, which would bring every
 * component straight back, so those two are added here. Everything else comes
 * from Paper's own table and follows it across upgrades.
 */
const shipped = require('react-native-paper/lib/mappings.json');

module.exports = {
  ...shipped,
  mappings: {
    ...shipped.mappings,
    MD3LightTheme: { path: 'lib/module/styles/themes/v3/LightTheme', name: 'MD3LightTheme' },
    MD3DarkTheme: { path: 'lib/module/styles/themes/v3/DarkTheme', name: 'MD3DarkTheme' },
  },
};
