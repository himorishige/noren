# Noren

Edge-native PII redaction & tokenization with country plugins (JP/US first).  
Web標準API（WHATWG Streams / WebCrypto / fetch）だけで動く。

## Packages
- `@himorishige/noren-core` … コア（世界共通の薄い原理）
- `@himorishige/noren-plugin-jp` … 日本向けDetector/Masker
- `@himorishige/noren-plugin-us` … US向けDetector/Masker
- `@himorishige/noren-dict-reloader` … ETag/If-None-Match対応の辞書ホットリロード

## Quickstart
```sh
pnpm i
pnpm build
```

```ts
import { Registry, redactText } from '@himorishige/noren-core';
import * as jp from '@himorishige/noren-plugin-jp';
import * as us from '@himorishige/noren-plugin-us';

const reg = new Registry({
  defaultAction: 'mask',
  rules: {
    credit_card: { action:'mask', preserveLast4:true },
    jp_my_number: { action:'remove' }
  },
  contextHints: ['TEL','電話','〒','住所','Zip','Address','SSN','Social Security']
});

reg.use(jp.detectors, jp.maskers, ['〒','住所','TEL','Phone']);
reg.use(us.detectors, us.maskers, ['Zip','Address','SSN','Phone']);

const input = `〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / 4242424242424242`;
const out = await redactText(reg, input, { hmacKey: 'change-me' });
console.log(out);
```
