import fs from 'fs';
import sourceMap from 'source-map';

const rawSourceMap = JSON.parse(fs.readFileSync('./dist/assets/index-9uww4C99.js.map', 'utf8'));

new sourceMap.SourceMapConsumer(rawSourceMap).then(consumer => {
  console.log("Trace 1 (11:52313) - ri:", consumer.originalPositionFor({ line: 11, column: 52313 }));
  console.log("Trace 2 (11:72813) - Ks:", consumer.originalPositionFor({ line: 11, column: 72813 }));
  console.log("Trace 3 (11:83068) - ul:", consumer.originalPositionFor({ line: 11, column: 83068 }));
  console.log("Trace 4 (11:123607) - pc:", consumer.originalPositionFor({ line: 11, column: 123607 }));
}).catch(console.error);
