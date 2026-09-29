/** 口語詞 → 公文用語建議。只收誤判機率低的詞。 */
export const COLLOQUIAL: Array<{ word: string; suggest: string }> = [
  { word: '然後', suggest: '並、續' },
  { word: '可是', suggest: '惟、但' },
  { word: '所以', suggest: '故、爰' },
  { word: '還有', suggest: '暨、以及' },
  { word: '因為', suggest: '因、緣' },
  { word: '大概', suggest: '約、概' },
  { word: '謝謝', suggest: '申謝、致謝' },
  { word: '麻煩', suggest: '煩請、惠請' },
  { word: '馬上', suggest: '立即、即刻' },
];
