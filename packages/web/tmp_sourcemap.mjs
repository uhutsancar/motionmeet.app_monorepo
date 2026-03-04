import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const rawSourceMap = JSON.parse(fs.readFileSync('./dist/assets/index-zVNW1Kax.js.map', 'utf8'));

SourceMapConsumer.with(rawSourceMap, null, consumer => {
  // First trace from user's screenshot step 1494/1527:
  // at r1 (index-zVNW1Kax.js:12:113949)
  // at o (index-zVNW1Kax.js:12:334104)
  // at Md (index-zVNW1Kax.js:2:60091)
  
  const pos1 = consumer.originalPositionFor({ line: 12, column: 113949 });
  const pos2 = consumer.originalPositionFor({ line: 12, column: 334104 });
  const pos3 = consumer.originalPositionFor({ line: 2, column: 60091 });
  
  console.log("Trace 1 (12:113949):", pos1);
  console.log("Trace 2 (12:334104):", pos2);
  console.log("Trace 3 (2:60091):", pos3);
});
