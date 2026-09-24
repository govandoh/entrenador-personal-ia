import { POSE_EMBEDDING_SIZE, POSE_EMBEDDING_VERSION } from '../geometry/poseEmbedding';

/**
 * Clasificador k-NN de posturas sobre el vector de `poseEmbedding` (ver DEC-055).
 *
 * Por qué k-NN como primer modelo: se "entrena" guardando ejemplos etiquetados, funciona
 * con decenas o cientos de muestras por clase, se amplía a un ejercicio o error nuevo
 * sin reentrenar nada, y es explicable (se puede mostrar qué ejemplo se parece más). Es
 * el enfoque que documenta Google para clasificar poses sobre MediaPipe.
 *
 * Búsqueda en dos etapas, como en esa referencia:
 * 1. Se preseleccionan los `topNByMax` ejemplos con menor distancia MÁXIMA por dimensión.
 *    Descarta los que se parecen en promedio pero difieren mucho en una articulación.
 * 2. Entre ellos se eligen los `k` con menor distancia MEDIA y votan su etiqueta.
 *
 * Qué se clasifica (DEC-055): la postura del frame clave de cada repetición (fondo o
 * pico, que entrega el tracker) para detectar errores de forma, y frames sueltos con
 * `ScoreSmoother` para identificar el ejercicio. Todo en TypeScript puro, sin runtime de
 * inferencia: el modelo es un JSON con los ejemplos.
 */

export interface LabeledSample {
  label: string;
  embedding: number[];
}

export interface Prediction {
  /** Etiqueta con más votos, o `null` si no hay ejemplos. */
  label: string | null;
  /** Fracción de votos de la etiqueta ganadora, 0–1. */
  confidence: number;
  /** Fracción de votos por etiqueta (suman 1). */
  scores: Record<string, number>;
}

export interface KnnOptions {
  /** Ejemplos preseleccionados por distancia máxima. */
  topNByMax: number;
  /** Vecinos que votan, elegidos por distancia media. */
  k: number;
}

const DEFAULT_OPTIONS: KnnOptions = { topNByMax: 30, k: 10 };

/** Formato serializado del modelo. */
export interface KnnModelJson {
  kind: 'knn-pose';
  embeddingVersion: number;
  options: KnnOptions;
  samples: LabeledSample[];
}

export class KnnPoseClassifier {
  private samples: LabeledSample[] = [];
  private readonly options: KnnOptions;

  constructor(options: Partial<KnnOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Agrega ejemplos etiquetados. Rechaza vectores de otra dimensión. */
  fit(samples: readonly LabeledSample[]): this {
    for (const s of samples) {
      if (s.embedding.length !== POSE_EMBEDDING_SIZE) {
        throw new Error(`embedding de ${s.embedding.length} dimensiones; se esperaban ${POSE_EMBEDDING_SIZE}`);
      }
      this.samples.push({ label: s.label, embedding: [...s.embedding] });
    }
    return this;
  }

  get size(): number {
    return this.samples.length;
  }

  get labels(): string[] {
    return [...new Set(this.samples.map(s => s.label))].sort();
  }

  predict(embedding: readonly number[]): Prediction {
    if (this.samples.length === 0) return { label: null, confidence: 0, scores: {} };

    const byMax = this.samples
      .map(s => ({ s, d: maxAbsDiff(s.embedding, embedding) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.options.topNByMax);

    const neighbors = byMax
      .map(({ s }) => ({ s, d: meanAbsDiff(s.embedding, embedding) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.options.k);

    const votes: Record<string, number> = {};
    for (const { s } of neighbors) votes[s.label] = (votes[s.label] ?? 0) + 1;

    let label: string | null = null;
    let best = 0;
    const scores: Record<string, number> = {};
    for (const [l, v] of Object.entries(votes)) {
      scores[l] = v / neighbors.length;
      // `votes` se llenó en orden de cercanía: con `>` estricto, en un empate gana la
      // etiqueta del vecino más cercano.
      if (v > best) {
        best = v;
        label = l;
      }
    }
    return { label, confidence: best / neighbors.length, scores };
  }

  toJSON(): KnnModelJson {
    return {
      kind: 'knn-pose',
      embeddingVersion: POSE_EMBEDDING_VERSION,
      options: this.options,
      samples: this.samples,
    };
  }

  static fromJSON(json: KnnModelJson): KnnPoseClassifier {
    if (json.kind !== 'knn-pose') throw new Error(`modelo de tipo ${String(json.kind)}; se esperaba knn-pose`);
    if (json.embeddingVersion !== POSE_EMBEDDING_VERSION) {
      throw new Error(
        `modelo entrenado con embedding v${json.embeddingVersion}; la app usa v${POSE_EMBEDDING_VERSION}`,
      );
    }
    return new KnnPoseClassifier(json.options).fit(json.samples);
  }
}

function maxAbsDiff(a: readonly number[], b: readonly number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

function meanAbsDiff(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

/** Constante de tiempo por defecto del suavizado de puntajes, en ms. */
const DEFAULT_SMOOTHING_MS = 150;

/**
 * Suaviza los puntajes frame a frame con una media exponencial en el tiempo (no en
 * frames, para que el comportamiento no dependa de los fps). Evita que un frame ruidoso
 * cambie la clase: la etiqueta solo cambia cuando la nueva domina durante ~`tauMs`.
 */
export class ScoreSmoother {
  private scores: Record<string, number> = {};
  private lastTimeMs: number | null = null;
  private readonly tauMs: number;

  constructor(tauMs = DEFAULT_SMOOTHING_MS) {
    this.tauMs = tauMs;
  }

  push(scores: Readonly<Record<string, number>>, timeMs: number): Prediction {
    const dt = this.lastTimeMs === null ? Infinity : Math.max(0, timeMs - this.lastTimeMs);
    const k = 1 - Math.exp(-dt / this.tauMs);
    this.lastTimeMs = timeMs;

    const labels = new Set([...Object.keys(this.scores), ...Object.keys(scores)]);
    for (const l of labels) {
      const prev = this.scores[l] ?? 0;
      this.scores[l] = prev + ((scores[l] ?? 0) - prev) * k;
    }

    let label: string | null = null;
    let best = 0;
    for (const [l, v] of Object.entries(this.scores)) {
      if (v > best) {
        best = v;
        label = l;
      }
    }
    return { label, confidence: best, scores: { ...this.scores } };
  }

  reset(): void {
    this.scores = {};
    this.lastTimeMs = null;
  }
}
