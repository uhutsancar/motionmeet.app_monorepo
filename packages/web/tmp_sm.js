const fs = require('fs');
const { SourceMapConsumer } = require('source-map');

const rawSourceMap = JSON.parse(fs.readFileSync('./dist/assets/index-9uww4C99.js.map', 'utf8'));

SourceMapConsumer.with(rawSourceMap, null, consumer => {
  console.log("Trace 1 (11:52313):", consumer.originalPositionFor({ line: 11, column: 52313 }));
  console.log("Trace 2 (11:72813):", consumer.originalPositionFor({ line: 11, column: 72813 }));
  console.log("Trace 3 (11:83068):", consumer.originalPositionFor({ line: 11, column: 83068 }));
}).catch(console.error);
