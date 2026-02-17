import EmptyState from '../../components/EmptyState';

export default function PcomPage() {
  return (
    <div className="panel pcom-placeholder">
      <div className="panel-header">
        <h2>PCOM</h2>
      </div>
      <EmptyState>
        PCOM editor coming next. FCOM tooling will be reused for the PCOM flow.
      </EmptyState>
    </div>
  );
}
