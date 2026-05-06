import type { SquatResult, FeedbackLevel } from '../exercises/squat';

interface Props {
  result: SquatResult;
}

const FEEDBACK_COLOR: Record<FeedbackLevel, string> = {
  good:    '#30D158',
  warning: '#FF9F0A',
  bad:     '#FF375F',
  idle:    'rgba(255,255,255,0.5)',
};

export function ExerciseOverlay({ result }: Props) {
  const color   = FEEDBACK_COLOR[result.feedbackLevel];
  const message = result.feedbackMessage || '▼  Baja para hacer la sentadilla';

  return (
    <div className="exercise-overlay">
      <div className="ex-label">Sentadillas</div>

      <div
        className="ex-bottom-bar"
        style={{ '--feedback-color': color } as React.CSSProperties}
      >
        <p className="ex-feedback-text">{message}</p>

        <div className="ex-rep-section">
          {/* key cambia cuando el rep sube → React remonta el span → CSS pop-animation se reinicia */}
          <span className="ex-reps" key={result.reps}>{result.reps}</span>
          <span className="ex-reps-label">REPS</span>
        </div>
      </div>
    </div>
  );
}
