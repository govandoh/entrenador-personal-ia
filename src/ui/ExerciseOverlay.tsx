type FeedbackLevel = 'idle' | 'good' | 'warning' | 'bad';

interface OverlayResult {
  reps:            number;
  feedbackLevel:   FeedbackLevel;
  feedbackMessage: string;
}

interface Props {
  result:       OverlayResult;
  exerciseName: string;
  /** Unidad del contador: repeticiones o, en la plancha, segundos sostenidos. */
  unit?:        string;
}

const FEEDBACK_COLOR: Record<FeedbackLevel, string> = {
  good:    '#30D158',
  warning: '#FF9F0A',
  bad:     '#FF375F',
  idle:    'rgba(255,255,255,0.5)',
};

export function ExerciseOverlay({ result, exerciseName, unit = 'REPS' }: Props) {
  const color = FEEDBACK_COLOR[result.feedbackLevel];

  return (
    <div className="exercise-overlay">
      <div className="ex-label">{exerciseName}</div>

      <div
        className="ex-bottom-bar"
        style={{ '--feedback-color': color } as React.CSSProperties}
      >
        <p className="ex-feedback-text">{result.feedbackMessage}</p>

        <div className="ex-rep-section">
          {/* key={reps} → React remonta el span → reinicia @keyframes ex-rep-pop */}
          <span className="ex-reps" key={result.reps}>{result.reps}</span>
          <span className="ex-reps-label">{unit}</span>
        </div>
      </div>
    </div>
  );
}
