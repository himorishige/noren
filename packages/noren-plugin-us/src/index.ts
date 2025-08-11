import type { Detector, Masker } from '@himorishige/noren-core';

export const detectors: Detector[] = [
  {
    id: 'us.phone',
    match: ({ src, push }) => {
      const re = /\b(?:\+1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g; let m;
      while ((m = re.exec(src))) push({ type:'us_phone', start:m.index, end:m.index+m[0].length, value:m[0], risk:'medium' });
    }
  },
  {
    id: 'us.zip',
    match: ({ src, push, hasCtx }) => {
      if (!hasCtx(['Zip','ZIP','Postal','Address'])) return;
      const re = /\b\d{5}(?:-\d{4})?\b/g; let m;
      while ((m = re.exec(src))) push({ type:'us_zip', start:m.index, end:m.index+m[0].length, value:m[0], risk:'low' });
    }
  },
  {
    id: 'us.ssn',
    priority: -10,
    match: ({ src, push, hasCtx }) => {
      if (!hasCtx(['SSN','Social Security'])) return;
      const re = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g; let m;
      while ((m = re.exec(src))) push({ type:'us_ssn', start:m.index, end:m.index+m[0].length, value:m[0], risk:'high' });
    }
  }
];

export const maskers: Record<string, Masker> = {
  us_phone: (h) => h.value.replace(/\d/g, '•'),
  us_zip: (h) => h.value.length > 5 ? '•••••-••••' : '•••••',
  us_ssn: (h) => `***-**-${h.value.replace(/\D/g,'').slice(-4)}`
};
