import type { Issue, Severity } from '../rules';

const LABEL: Record<Severity, string> = { error: '錯誤', warn: '注意', info: '建議' };

export function CheckPanel({ issues }: { issues: Issue[] }) {
  if (!issues.length) return <p className="hint">目前沒有發現問題。</p>;
  return (
    <ul className="issues">
      {issues.map((i) => (
        <li key={i.id} className={`issue issue-${i.severity}`}>
          <span className="issue-tag">{LABEL[i.severity]}</span>
          <span className="issue-where">{i.where}</span>
          <span>{i.message}</span>
        </li>
      ))}
    </ul>
  );
}
