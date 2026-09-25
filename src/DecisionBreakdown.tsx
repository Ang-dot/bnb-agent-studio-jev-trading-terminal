import type { Decision, EvidenceAssessment, Judgment } from "./types.js";

export function executionLabel(decision: Decision) {
  if (decision.status === "executed") return "Paper fill";
  if (decision.status === "not_evaluated") return "Skipped";
  if (
    decision.snapshot?.monitoring &&
    decision.executionContext?.inspectionOnly
  )
    return "Auto-monitor · no trade";
  if (decision.executionContext?.inspectionOnly) return "Inspection only";
  if (decision.executionContext?.halted) return "Stop latched";
  if (decision.judgment?.action === "hold") return "JEV hold";
  if (decision.checks.some((check) => !check.pass)) return "Policy prevented";
  if (decision.executionContext && !decision.executionContext.running)
    return "Paused";
  return "No fill recorded";
}

export function DecisionSummary({ decision }: { decision?: Decision }) {
  if (!decision)
    return (
      <p>
        Inspect a decision to see its evidence, JEV assessments and execution
        rules.
      </p>
    );
  const research = decision.research;
  return (
    <div className="decision-summary">
      <strong>
        {decision.status === "executed"
          ? `Paper ${decision.action.toUpperCase()} recorded`
          : "No trade placed"}
      </strong>
      <dl>
        <div>
          <dt>Model</dt>
          <dd>
            {decision.judgment
              ? `JEV selected ${decision.judgment.action.toUpperCase()}`
              : decision.ruleExit ? "Code exit · "+decision.ruleExit.replaceAll("-"," ") : "JEV not evaluated"}
          </dd>
        </div>
        <div>
          <dt>X input</dt>
          <dd>
            {!research
              ? "Not collected"
              : research.status === "no_results"
                ? "No matching posts returned"
                : research.status === "ready"
                  ? `${research.sources.length} cited posts supplied`
                  : "Unusable or unavailable"}
          </dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd>
            {decision.memories.length
              ? `${decision.memories.length} retrieved pages`
              : decision.memoryStatus.includes("cold start")
                ? "Cold start · no relevant pages"
                : decision.memoryStatus}
          </dd>
        </div>
      </dl>
      <small>
        Recorded inputs and outputs—not a reconstruction of JEV’s thoughts.
      </small>
    </div>
  );
}

export function AssessmentCard({
  assessment,
}: {
  assessment: EvidenceAssessment;
}) {
  return (
    <div className="assessment-card">
      <div className="assessment-title">
        <span>{assessment.label}</span>
        <b>{assessment.valueLabel}</b>
      </div>
      <small>
        JEV confidence {(assessment.confidence * 100).toFixed(0)}% · not a win
        probability
      </small>
      {assessment.evidenceIds.length > 0 && (
        <div
          className="evidence-refs"
          aria-label="Evidence supplied for this assessment"
        >
          <span>Inputs</span>
          {assessment.evidenceIds.map((id) => (
            <a key={id} href={`#evidence-${id}`}>
              {id === "market" ? "Market" : id}
            </a>
          ))}
        </div>
      )}
      <details className="assessment-question">
        <summary>Question & probabilities</summary>
        <p>{assessment.question}</p>
        {Object.entries(assessment.probabilities).map(([key, probability]) => (
          <div key={key} className="assessment-option">
            <span>
              {assessment.options[key]}
              <small>{assessment.criteria[key]}</small>
            </span>
            <b>{(probability * 100).toFixed(0)}%</b>
          </div>
        ))}
      </details>
    </div>
  );
}

export function AssessmentOverview({ judgment }: { judgment?: Judgment }) {
  if (!judgment) return null;
  if (!judgment.assessmentVersion)
    return (
      <p className="assessment-note">
        Source assessments were not collected for this decision. Inspect a new
        decision to collect them.
      </p>
    );
  return (
    <div className="assessment-overview">
      <p className="assessment-note">
        Independent assessments, not JEV’s reasoning trace. Informational only;
        these additional answers do not change execution rules.
      </p>
      {judgment.assessments
        ?.filter((a) => a.kind === "context")
        .map((a) => (
          <AssessmentCard key={a.id} assessment={a} />
        ))}
      {!!judgment.assessmentIssues?.length && (
        <div className="assessment-unavailable" role="status">
          <strong>Some assessments unavailable</strong>
          {judgment.assessmentIssues.map((issue, i) => (
            <p key={i}>{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecutionOutcome({ decision }: { decision?: Decision }) {
  if (!decision) return <p>No decision evaluated yet.</p>;
  const failures = decision.checks.filter((c) => !c.pass);
  return (
    <div className="execution-outcome">
      {decision.status === "executed" ? (
        <p>Paper fill recorded. No on-chain transaction.</p>
      ) : decision.status === "not_evaluated" ? (
        <p>Evaluation incomplete. No trade placed.</p>
      ) : (
        <p>
          No paper fill recorded.
          {decision.judgment?.action === "hold" ? " JEV selected Hold." : ""}
        </p>
      )}
      {decision.executionContext?.inspectionOnly && (
        <p className="execution-restriction">
          <b>
            {decision.snapshot?.monitoring
              ? "Automatic monitoring only."
              : "Inspection only."}
          </b>{" "}
          This assessment could not place a trade.
        </p>
      )}
      {decision.executionContext?.halted && (
        <p className="execution-restriction">
          <b>Stop latched at evaluation.</b> Execution disabled.
        </p>
      )}
      {decision.executionContext && !decision.executionContext.running && (
        <p className="execution-restriction">
          <b>Paused at evaluation.</b> Autonomous execution disabled.
        </p>
      )}
      {failures.length > 0 && (
        <div className="failed-checks">
          <strong>Policy requirements not met</strong>
          {failures.map((check) => (
            <p key={check.label}>
              <b>{check.label}:</b> {check.detail}
            </p>
          ))}
        </div>
      )}
      {decision.status === "not_evaluated" &&
        decision.reasons.map((reason, i) => <p key={i}>{reason}</p>)}
      {!decision.executionContext &&
        decision.status === "held" &&
        !failures.length &&
        decision.judgment?.action !== "hold" &&
        decision.reasons.map((reason, i) => <p key={i}>{reason}</p>)}
      <small>
        These are recorded code checks, not an explanation generated by JEV.
      </small>
    </div>
  );
}
