import { describe, expect, it } from 'vitest';
import { emptyDocument, newItem } from '../model/defaults';
import type { OfficialDocument } from '../model/types';
import { checkDocument } from './index';

function letter(over: Partial<OfficialDocument> = {}): OfficialDocument {
  return {
    ...emptyDocument('函'),
    date: '2026-11-09',
    sender: { name: '甲機關' },
    recipient: { name: '乙機關' },
    docNumber: 'A字第1號',
    subject: '有關提供日程一案，請查照。',
    explanation: [newItem(0, '依往例辦理。')],
    ...over,
  };
}
const ids = (d: OfficialDocument) => checkDocument(d).map((i) => i.id);
const withBody = (text: string, over: Partial<OfficialDocument> = {}) => letter({ explanation: [newItem(0, text)], ...over });

describe('稱謂語與附送語（函的概念與範例、文書處理手冊第十八點）', () => {
  it('上行稱鈞、平行與下行稱貴、斜行稱大', () => {
    expect(ids(withBody('依據貴部來函辦理。', { direction: '上行', subject: '檢陳資料一案，請鑒核。' }))).toContain('address-gui');
    expect(ids(withBody('依據鈞部來函辦理。', { direction: '上行', subject: '檢陳資料一案，請鑒核。' }))).not.toContain('address-gui');
    expect(ids(withBody('依據鈞局○字第1號函辦理。', { direction: '下行' }))).toContain('address-jun');
    expect(ids(withBody('請貴局協助。', { direction: '斜行', subject: '有關資料一案，請詧照。' }))).toContain('address-da');
    expect(ids(withBody('請大院查照。', { direction: '斜行', subject: '有關資料一案，請詧照。' }))).not.toContain('address-da');
  });
  it('不把「寶貴」「貴重」當稱謂', () => {
    expect(ids(withBody('感謝寶貴意見，並注意貴重物品。', { direction: '上行', subject: '有關資料一案，請鑒核。' }))).not.toContain('address-gui');
  });
  it('上行用檢陳、平行與下行用檢送', () => {
    expect(ids(letter({ direction: '上行', subject: '檢送資料1份，請鑒核。', attachments: '資料1份' }))).toContain('attach-word');
    expect(ids(letter({ direction: '平行', subject: '檢陳資料1份，請查照。', attachments: '資料1份' }))).toContain('attach-word');
    expect(ids(letter({ direction: '上行', subject: '檢陳資料1份，請鑒核。', attachments: '資料1份' }))).not.toContain('attach-word');
  });
  it('自稱用「本」，不直稱機關全名', () => {
    const named = { sender: { name: '甲乙丙學生會' } };
    expect(ids(withBody('甲乙丙學生會將辦理活動。', named))).toContain('self-name');
    expect(ids(withBody('本會將辦理活動。', named))).not.toContain('self-name');
  });
});

describe('期望語（文書處理手冊第十九點、公文書寫作實務）', () => {
  it('概括性期望語不在說明重複', () => {
    expect(ids(withBody('以上請查照。'))).toContain('expect-repeat');
    expect(ids(withBody('請於11月20日前回復。'))).not.toContain('expect-repeat');
  });
  it('描述性與概括性期望語擇一', () => {
    expect(ids(letter({ subject: '函請協助辦理一案，敬請惠予協助，請查照。' }))).toContain('expect-double');
    expect(ids(letter({ subject: '函請協助辦理一案，請查照。' }))).not.toContain('expect-double');
  });
  it('簽的主旨要有期望語', () => {
    const memo = { ...emptyDocument('簽'), sender: { name: '甲' }, recipient: { name: '長官' }, date: '2026-11-09' };
    expect(ids({ ...memo, subject: '為辦理活動一案。', explanation: [newItem(0, '說明。')], measures: [newItem(0, '擬辦。')] })).toContain('memo-expect');
    expect(ids({ ...memo, subject: '為辦理活動一案，簽請核示。', explanation: [newItem(0, '說明。')], measures: [newItem(0, '擬辦。')] })).not.toContain('memo-expect');
  });
  it('希照辦等下行期望語算有期望語', () => {
    expect(ids(letter({ direction: '下行', subject: '有關資料一案，希切實照辦。' }))).not.toContain('subject-expect');
  });
});

describe('限期（文書處理手冊第十九點）', () => {
  it('限期公文不填速別；限期要寫在主旨', () => {
    const subject = '有關提供日程一案，於115年11月20日前辦理，請查照。';
    expect(ids(letter({ subject, limit: '2026-11-20', urgency: '普通件' }))).toContain('limit-urgency');
    expect(ids(letter({ subject, limit: '2026-11-20', urgency: '' }))).toEqual([]);
    expect(ids(letter({ limit: '2026-11-20', urgency: '' }))).toContain('limit-unmentioned');
  });
});

describe('引敘來文', () => {
  it('復文或引述來文要寫日期與字號', () => {
    expect(ids(withBody('復貴局來函。'))).toContain('cite-number');
    expect(ids(withBody('依據貴局115年11月1日甲字第1150001234號函辦理。'))).not.toContain('cite-number');
    expect(ids(withBody('依據學生會組織章程第五條規定辦理。'))).not.toContain('cite-number');
  });
  it('「復…函」後不加「辦理」', () => {
    expect(ids(withBody('復貴局115年11月1日甲字第1號函辦理。'))).toContain('reply-banli');
  });
});

describe('本文格式（文書處理手冊第十六點、附錄 5）', () => {
  it('段名與編號由程式處理', () => {
    expect(ids(withBody('說明：依往例辦理。'))).toContain('label-in-text:說明');
    expect(ids(letter({ subject: '主旨：有關日程一案，請查照。' }))).toContain('label-in-text:主旨');
    expect(ids(withBody('一、依往例辦理。'))).toContain('manual-number:說明');
    expect(ids(withBody('(一)依往例辦理。'))).toContain('manual-number:說明');
    expect(ids(withBody('依往例辦理，共一、二項。'))).not.toContain('manual-number:說明');
  });
  it('日期、時間、份數用阿拉伯數字與規定寫法', () => {
    expect(ids(withBody('於一一五年十一月辦理。'))).toContain('num-date:說明');
    expect(ids(withBody('訂於二月三日辦理。'))).toContain('num-date:說明');
    expect(ids(withBody('訂於115年11月3日辦理。'))).not.toContain('num-date:說明');
    expect(ids(withBody('檢附資料乙份。'))).toContain('num-unit:說明');
    expect(ids(withBody('檢附資料一份。'))).toContain('num-unit:說明');
    expect(ids(withBody('檢附資料1份。'))).not.toContain('num-unit:說明');
    expect(ids(withBody('於115年11月6日（四）辦理。'))).toContain('weekday:說明');
    expect(ids(withBody('於115年11月6日（星期四）辦理。'))).not.toContain('weekday:說明');
    expect(ids(withBody('時間：上午09:30。'))).toContain('time24:說明');
    expect(ids(withBody('時間：下午14時。'))).toContain('time24:說明');
    expect(ids(withBody('時間：下午2時30分。'))).not.toContain('time24:說明');
  });
  it('中文句中不用半形標點；數字中的逗號與小數點不算', () => {
    expect(ids(withBody('請辦理,並回復.'))).toContain('half-punct:說明');
    expect(ids(withBody('金額新臺幣5,000元，利率3.5%。'))).not.toContain('half-punct:說明');
  });
  it('月日個位數不補 0；民國重複', () => {
    expect(ids(withBody('於115年11月05日辦理。'))).toContain('date-zero:說明');
    expect(ids(withBody('自民國115年1月1日至民國115年12月31日止。'))).toContain('republic-repeat');
    expect(ids(withBody('自民國115年1月1日至115年12月31日止。'))).not.toContain('republic-repeat');
  });
});

describe('用字與用語（法律統一用字表、公文寫作）', () => {
  it('錯字與建議用語', () => {
    expect(ids(withBody('請盡速回覆。'))).toEqual(expect.arrayContaining(['wording:回覆']));
    expect(ids(withBody('惠請協助。'))).toContain('wording:惠請');
    expect(ids(withBody('通知台端。'))).toContain('wording:台端');
    expect(ids(withBody('通知臺端。'))).not.toContain('wording:台端');
    expect(ids(withBody('部份條文修正，公佈施行。'))).toEqual(expect.arrayContaining(['wording:部份', 'wording:公佈']));
  });
  it('只在指定文種檢查的用語', () => {
    expect(ids(withBody('是否允當請核示。'))).toContain('wording:是否允當');
    expect(ids({ ...emptyDocument('公告'), sender: { name: '甲' }, date: '2026-11-09', docNumber: 'x', subject: '公告事項。', explanation: [newItem(0, '是否允當。')], measures: [newItem(0, '一律辦理。')] })).not.toContain('wording:是否允當');
  });
});

describe('引述法規與來文', () => {
  it('「略以」之後不加引號', () => {
    expect(ids(withBody('戶籍法第2條規定略以，「本法所稱主管機關…」。'))).toContain('lueyi:說明');
    expect(ids(withBody('戶籍法第2條規定略以，本法所稱主管機關為內政部。'))).not.toContain('lueyi:說明');
    expect(ids(withBody('戶籍法第2條規定：「本法所稱主管機關為內政部。」'))).not.toContain('lueyi:說明');
  });
});

describe('其他提醒', () => {
  it('上行文不宜發副本', () => {
    expect(ids(letter({ direction: '上行', subject: '有關資料一案，請鑒核。', ccRecipients: '本會秘書處' }))).toContain('cc-upward');
    expect(ids(letter({ direction: '平行', ccRecipients: '本會秘書處' }))).not.toContain('cc-upward');
  });
  it('說明不必重複右上角的聯絡人資料', () => {
    const contact = { person: '王小明', phone: '02-12345678', email: '', fax: '' };
    expect(ids(withBody('聯絡電話：02-12345678。', { contact }))).toContain('contact-dup');
    expect(ids(withBody('依往例辦理。', { contact }))).not.toContain('contact-dup');
  });
  it('開會地點不用「假」', () => {
    const meeting = { ...emptyDocument('開會通知單'), sender: { name: '甲' }, recipient: { name: '乙' }, date: '2026-11-09', docNumber: 'x' };
    meeting.meeting = { ...meeting.meeting, reason: '討論', time: '115年11月16日上午9時', place: '假學生會辦公室' };
    expect(ids(meeting)).toContain('place-jia');
  });
});

describe('草案標題（中央行政機關法制作業應注意事項）', () => {
  const motion = (draftTitle: string, mode: '修正' | '新訂', rows: number): OfficialDocument => {
    const d = emptyDocument('議案關係文書');
    d.motion = { ...d.motion, term: '十四', proposer: '王小明', draftTitle, mode, rows: Array.from({ length: rows }, (_, i) => ({ id: `r${i}`, amended: `第${i + 1}條　內容。`, current: mode === '修正' ? `第${i + 1}條　舊。` : '', reason: '說明。', proposals: [] })) };
    d.sender = { name: '甲議會' };
    d.subject = '修正○○案，是否有當？敬請公決。';
    return d;
  };
  it('標題要以「草案」結尾、依類型有「修正」', () => {
    expect(ids(motion('學生會組織章程修正', '修正', 1))).toContain('draft-title-form');
    expect(ids(motion('學生會組織章程草案', '修正', 1))).toContain('draft-title-form');
    expect(ids(motion('學生會組織章程修正草案', '新訂', 1))).toContain('draft-title-form');
    expect(ids(motion('學生會組織章程草案', '新訂', 1))).not.toContain('draft-title-form');
  });
  it('3 條以下列條次，4 條以上用「部分條文」', () => {
    expect(ids(motion('學生會組織章程部分條文修正草案', '修正', 2))).toContain('draft-title-count');
    expect(ids(motion('學生會組織章程第二條修正草案', '修正', 2))).not.toContain('draft-title-count');
    expect(ids(motion('學生會組織章程第一條、第二條、第三條、第四條修正草案', '修正', 4))).toContain('draft-title-count');
    expect(ids(motion('學生會組織章程部分條文修正草案', '修正', 4))).not.toContain('draft-title-count');
  });
});
