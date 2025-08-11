import { Registry } from '../packages/noren-core/dist/index.js';
import * as jp from '../packages/noren-plugin-jp/dist/index.js';
import * as us from '../packages/noren-plugin-us/dist/index.js';

const reg = new Registry({
  defaultAction: 'mask',
  contextHints: ['TEL','電話','〒','住所','Zip','Address','SSN','Social Security']
});

reg.use(jp.detectors, jp.maskers, ['〒','住所','TEL','Phone']);
reg.use(us.detectors, us.maskers, ['Zip','Address','SSN','Phone']);

const input = `
mix: 192.168.0.1 email bob@example.org SSN 987-65-4320
JP: 〒160-0022 TEL 03-1234-5678
`;

const { hits } = await reg.detect(input);
console.log(JSON.stringify(hits, null, 2));
