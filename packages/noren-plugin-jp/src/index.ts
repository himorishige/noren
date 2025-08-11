import type { Detector, Masker } from '@himorishige/noren-core';

export const detectors: Detector[] = [
  {
    id: 'jp.postal',
    match: ({ src, push, hasCtx }) => {
      if (!hasCtx(['〒','住所','Address','Zip'])) return;
      const re = /\b\d{3}-?\d{4}\b/g; let m;
      while ((m = re.exec(src))) push({ type:'jp_postal', start:m.index, end:m.index+m[0].length, value:m[0], risk:'low' });
    }
  },
  {
    id: 'jp.phone',
    match: ({ src, push, hasCtx }) => {
      let m;
      const reCell = /\b0(?:70|80|90)-?\d{4}-?\d{4}\b/g;
      const reLand = /\b0[1-9]\d?-?\d{3,4}-?\d{4}\b/g;
      const reIntl = /\+81-?\d{1,4}-?\d{1,4}-?\d{3,4}\b/g;
      while ((m = reCell.exec(src))) push({ type:'phone_jp', start:m.index, end:m.index+m[0].length, value:m[0], risk:'medium' });
      while ((m = reLand.exec(src))) push({ type:'phone_jp', start:m.index, end:m.index+m[0].length, value:m[0], risk:'low' });
      if (hasCtx(['TEL','電話','Phone'])) while ((m = reIntl.exec(src))) push({ type:'phone_jp', start:m.index, end:m.index+m[0].length, value:m[0], risk:'medium' });
    }
  },
  {
    id: 'jp.mynumber',
    priority: -10,
    match: ({ src, push, hasCtx }) => {
      if (!hasCtx(['マイナンバー','個人番号'])) return;
      const re = /\b\d{12}\b/g; let m;
      while ((m = re.exec(src))) push({ type:'jp_my_number', start:m.index, end:m.index+m[0].length, value:m[0], risk:'high' });
    }
  }
];

export const maskers: Record<string, Masker> = {
  jp_postal: () => '〒•••-••••',
  phone_jp: (h) => h.value.replace(/\d/g, '•'),
  jp_my_number: () => '[REDACTED:MYNUMBER]'
};
