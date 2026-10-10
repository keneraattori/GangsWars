interface ActionOutcomeProps {
  outcome: Record<string, unknown>;
  highlightExpandResult: boolean;
}

export function ActionOutcome({ outcome, highlightExpandResult }: ActionOutcomeProps) {
  return (
    <>
      {"{"}
      {Object.entries(outcome).map(([key, value], index) => (
        <span key={key}>
          {index > 0 ? "," : ""}
          {JSON.stringify(key)}:{key === "success" && highlightExpandResult && value === false
            ? <span className="action-log-failure">false</span>
            : key === "success" && highlightExpandResult && value === true
              ? <span className="action-log-success">true</span>
              : JSON.stringify(value)}
        </span>
      ))}
      {"}"}
    </>
  );
}
