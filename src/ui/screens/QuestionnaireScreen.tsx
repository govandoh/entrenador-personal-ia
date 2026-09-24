import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  suggestProgram, type ExperienceLevel, type ProgramType, type Questionnaire, type TrainingGoal, type TrainingLocation,
} from '../../domain/routineGenerator';
import type { EquipmentTag } from '../../domain/catalog';
import { appActions, useAppState } from '../state/appStore';
import {
  IconBack, IconBolt, IconCheck, IconClose, IconDumbbell, IconFigure, IconFlame, IconTarget, IconToday, IconUser,
} from '../components/icons';

interface Option<T> { id: T; title: string; desc: string; icon: ReactNode }

const GOALS: Option<TrainingGoal>[] = [
  { id: 'muscle_gain', title: 'Ganar músculo', desc: '8 a 12 repeticiones, más volumen', icon: <IconDumbbell /> },
  { id: 'weight_loss', title: 'Perder peso', desc: '12 a 15 repeticiones, descansos cortos', icon: <IconFlame /> },
  { id: 'strength_gain', title: 'Ganar fuerza', desc: '3 a 6 repeticiones, descansos largos', icon: <IconBolt /> },
];

const LEVELS: Option<ExperienceLevel>[] = [
  { id: 'beginner', title: 'Principiante', desc: 'Menos de 6 meses entrenando', icon: <IconUser /> },
  { id: 'intermediate', title: 'Intermedio', desc: 'Entre 6 meses y 2 años', icon: <IconTarget /> },
  { id: 'advanced', title: 'Avanzado', desc: 'Más de 2 años, con buena técnica', icon: <IconBolt /> },
];

const LOCATIONS: Option<TrainingLocation>[] = [
  { id: 'gym_full', title: 'Gimnasio', desc: 'Máquinas, barras, poleas y mancuernas', icon: <IconDumbbell /> },
  { id: 'home_none', title: 'Casa sin equipo', desc: 'Solo tu peso corporal', icon: <IconFigure /> },
  { id: 'home_limited', title: 'Casa con algo de equipo', desc: 'Marca lo que tienes', icon: <IconToday /> },
];

const HOME_EQUIPMENT: { id: EquipmentTag; label: string }[] = [
  { id: 'dumbbell', label: 'Mancuernas' },
  { id: 'band', label: 'Bandas' },
  { id: 'kettlebell', label: 'Pesa rusa' },
  { id: 'pullup_bar', label: 'Barra de dominadas' },
  { id: 'bench', label: 'Banco' },
  { id: 'barbell', label: 'Barra y discos' },
  { id: 'jump_rope', label: 'Cuerda' },
  { id: 'ab_wheel', label: 'Rueda abdominal' },
];

const PROGRAMS: { id: ProgramType; label: string }[] = [
  { id: 'full_body', label: 'Cuerpo completo' },
  { id: 'upper_lower', label: 'Torso / pierna' },
  { id: 'ppl', label: 'Empuje / tracción / pierna' },
];

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 90];

function Options<T extends string>({ options, value, onChange, label }: {
  options: Option<T>[]; value: T | null; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="option-list" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} className="option" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          <span className="option__icon">{o.icon}</span>
          <span className="option__text">
            <span className="option__title">{o.title}</span>
            <span className="option__desc">{o.desc}</span>
          </span>
          <span className="option__radio">{value === o.id && <IconCheck />}</span>
        </button>
      ))}
    </div>
  );
}

const TITLES = ['¿Qué quieres lograr?', '¿Cuánta experiencia tienes?', '¿Dónde vas a entrenar?', '¿Cuánto tiempo tienes?'];
const LEADS = [
  'Con esto armamos tu programa. Lo puedes cambiar cuando quieras.',
  'Define el volumen y qué métodos usamos.',
  'Solo te proponemos ejercicios que puedes hacer con lo que tienes.',
  'Te sugerimos una división según tu nivel; puedes cambiarla.',
];

export function QuestionnaireScreen() {
  const navigate = useNavigate();
  const saved = useAppState().questionnaire;
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<TrainingGoal | null>(saved?.goal ?? null);
  const [level, setLevel] = useState<ExperienceLevel | null>(saved?.level ?? null);
  const [location, setLocation] = useState<TrainingLocation | null>(saved?.location ?? null);
  const [equipment, setEquipment] = useState<EquipmentTag[]>(saved?.equipment ?? []);
  const [days, setDays] = useState(saved?.daysPerWeek ?? 3);
  const [minutes, setMinutes] = useState(saved?.sessionMinutes ?? 45);
  const [program, setProgram] = useState<ProgramType | null>(saved?.programType ?? null);

  const suggested = level ? suggestProgram(level, days) : 'full_body';
  const canContinue = [goal !== null, level !== null, location !== null, true][step];

  function finish() {
    if (!goal || !level || !location) return;
    const q: Questionnaire = {
      goal, level, location, daysPerWeek: days, sessionMinutes: minutes,
      ...(location === 'home_limited' ? { equipment } : {}),
      ...(program && program !== suggested ? { programType: program } : {}),
    };
    appActions.saveQuestionnaire(q, new Date());
    navigate('/rutinas', { replace: true });
  }

  return (
    <div className="flow">
      <div className="flow__top">
        {step === 0 ? (
          <button className="icon-btn" aria-label="Cerrar cuestionario" onClick={() => navigate(-1)}><IconClose /></button>
        ) : (
          <button className="icon-btn" aria-label="Paso anterior" onClick={() => setStep(step - 1)}><IconBack /></button>
        )}
        <div className="steps" aria-label={`Paso ${step + 1} de 4`}>
          {[0, 1, 2, 3].map(i => <span key={i} className={i <= step ? 'done' : ''} />)}
        </div>
      </div>

      <div className="flow__intro">
        <p className="eyebrow">Paso {step + 1} de 4</p>
        <h1 className="flow__title">{TITLES[step]}</h1>
        <p className="flow__lead">{LEADS[step]}</p>
      </div>

      {step === 0 && <Options options={GOALS} value={goal} onChange={setGoal} label="Objetivo" />}
      {step === 1 && <Options options={LEVELS} value={level} onChange={setLevel} label="Nivel" />}
      {step === 2 && (
        <>
          <Options options={LOCATIONS} value={location} onChange={setLocation} label="Lugar" />
          {location === 'home_limited' && (
            <div className="card">
              <span className="field-label">¿Qué equipo tienes?</span>
              <div className="tag-row" role="group" aria-label="Equipo disponible">
                {HOME_EQUIPMENT.map(e => {
                  const on = equipment.includes(e.id);
                  return (
                    <button key={e.id} className="chip" aria-pressed={on}
                      onClick={() => setEquipment(on ? equipment.filter(x => x !== e.id) : [...equipment, e.id])}>
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {step === 3 && (
        <>
          <div className="card">
            <span className="field-label">Días por semana</span>
            <div className="stepper" role="radiogroup" aria-label="Días por semana">
              {DAYS.map(d => <button key={d} className="chip" role="radio" aria-checked={days === d} onClick={() => setDays(d)}>{d}</button>)}
            </div>
            <span className="field-label">Minutos por sesión</span>
            <div className="stepper" role="radiogroup" aria-label="Minutos por sesión">
              {MINUTES.map(m => <button key={m} className="chip" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}>{m}</button>)}
            </div>
          </div>
          <div className="card">
            <span className="field-label">Tipo de programa</span>
            <div className="option-list" role="radiogroup" aria-label="Tipo de programa">
              {PROGRAMS.map(p => {
                const selected = (program ?? suggested) === p.id;
                return (
                  <button key={p.id} className="chip" role="radio" aria-checked={selected} onClick={() => setProgram(p.id)}>
                    {p.label}{p.id === suggested ? ' · sugerido' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flow__spacer" />
      {step < 3 && <p className="muted flow__hint">{['Después: tu nivel, dónde entrenas y cuántos días', 'Después: dónde entrenas y cuántos días', 'Último paso: cuánto tiempo tienes'][step]}</p>}
      <button className="btn btn--primary btn--block" disabled={!canContinue} onClick={() => (step < 3 ? setStep(step + 1) : finish())}>
        {step < 3 ? 'Continuar' : 'Crear mi programa'}
      </button>
    </div>
  );
}
