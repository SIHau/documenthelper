import type { OfficialDocument } from '../model/types';
import type { NumberedItem } from '../model/numbering';
import { numberItems } from '../model/numbering';
import { toMinguoText } from '../model/date';

function Outline({ items }: { items: NumberedItem[] }) {
  return (
    <>
      {items
        .filter((it) => it.text.trim())
        .map((it) => (
          <p key={it.id} className="pv-item" style={{ paddingLeft: `${it.level * 2}em` }}>
            {it.label}
            {it.text}
          </p>
        ))}
    </>
  );
}

export function Preview({ doc }: { doc: OfficialDocument }) {
  const explanation = numberItems(doc.explanation);
  const measures = numberItems(doc.measures);
  const hasMeasures = measures.some((m) => m.text.trim());
  const hasExplanation = explanation.some((m) => m.text.trim());
  const dateText = toMinguoText(doc.date);

  return (
    <article className="page">
      <header className="pv-head">
        <h1>{doc.sender.name || '（發文機關）'}　{doc.type}</h1>
        <div className="pv-meta">
          {doc.senderAddress && <div>地址：{doc.senderAddress}</div>}
          {doc.contact.person && <div>承辦人：{doc.contact.person}</div>}
          {doc.contact.phone && <div>連絡電話：{doc.contact.phone}</div>}
          {doc.contact.email && <div>電子信箱：{doc.contact.email}</div>}
          {doc.contact.fax && <div>傳真：{doc.contact.fax}</div>}
        </div>
      </header>

      <div className="pv-row">受文者：{doc.recipient.name || '（受文者）'}</div>
      {dateText && <div className="pv-row">發文日期：{dateText}</div>}
      {doc.docNumber && <div className="pv-row">發文字號：{doc.docNumber}</div>}
      {doc.urgency && <div className="pv-row">速別：{doc.urgency}</div>}
      {doc.secrecy && <div className="pv-row">密等及解密條件或保密期限：{doc.secrecy}</div>}
      {doc.attachments && <div className="pv-row">附件：{doc.attachments}</div>}

      <section className="pv-block">
        <p className="pv-item"><strong>主旨：</strong>{doc.subject || '（請填寫主旨）'}</p>
      </section>

      {hasExplanation && (
        <section className="pv-block">
          <strong>說明：</strong>
          <Outline items={explanation} />
        </section>
      )}

      {hasMeasures && (
        <section className="pv-block">
          <strong>辦法：</strong>
          <Outline items={measures} />
        </section>
      )}

      <footer className="pv-foot">
        {doc.primaryRecipients && <div>正本：{doc.primaryRecipients}</div>}
        {doc.ccRecipients && <div>副本：{doc.ccRecipients}</div>}
      </footer>

      {doc.signature.enabled && (doc.signature.title || doc.signature.name) && (
        <div className={`pv-sign pv-sign-${doc.signature.font}`}>
          <span className="pv-sign-title">{doc.signature.title}</span>
          <span className="pv-sign-name">{doc.signature.name}</span>
        </div>
      )}
    </article>
  );
}
