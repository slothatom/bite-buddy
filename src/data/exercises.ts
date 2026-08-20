import type { ExerciseKind } from '../types'

/**
 * The exercises you can build a session from.
 *
 * MET values from the Compendium of Physical Activities (Ainsworth et al.,
 * 2011 update), which is where every calories-burned figure in every app
 * ultimately comes from. They are averages across people doing an activity at
 * a stated intensity, so treat the resulting number as an estimate with a wide
 * spread rather than a measurement.
 *
 * This list ships with the app so the screen works offline and on the first
 * run. A wider catalogue can be searched online from the same box, the same
 * way foods are, but nothing here depends on that reaching anything.
 */
export const EXERCISES: ExerciseKind[] = [
  // ─── Cardio ────────────────────────────────────────────────────────────────
  { id: 'ex-walk-slow', name: 'Walking, slow', group: 'cardio', met: 2.8 },
  { id: 'ex-walk', name: 'Walking, brisk', group: 'cardio', met: 4.3 },
  { id: 'ex-walk-hill', name: 'Walking uphill', group: 'cardio', met: 6.0 },
  { id: 'ex-hike', name: 'Hiking', group: 'cardio', met: 6.0 },
  { id: 'ex-run-easy', name: 'Running, easy (8 km/h)', group: 'cardio', met: 8.3 },
  { id: 'ex-run', name: 'Running (10 km/h)', group: 'cardio', met: 10.0 },
  { id: 'ex-run-fast', name: 'Running, fast (12 km/h)', group: 'cardio', met: 12.5 },
  { id: 'ex-cycle-light', name: 'Cycling, gentle', group: 'cardio', met: 4.0 },
  { id: 'ex-cycle', name: 'Cycling, moderate', group: 'cardio', met: 8.0 },
  { id: 'ex-cycle-hard', name: 'Cycling, vigorous', group: 'cardio', met: 10.0 },
  { id: 'ex-spin', name: 'Spin class', group: 'cardio', met: 8.5 },
  { id: 'ex-swim', name: 'Swimming, moderate', group: 'cardio', met: 5.8 },
  { id: 'ex-swim-hard', name: 'Swimming, fast', group: 'cardio', met: 9.8 },
  { id: 'ex-row', name: 'Rowing machine', group: 'cardio', met: 7.0 },
  { id: 'ex-elliptical', name: 'Cross trainer', group: 'cardio', met: 5.0 },
  { id: 'ex-stairs', name: 'Stair machine', group: 'cardio', met: 9.0 },
  { id: 'ex-jump-rope', name: 'Skipping', group: 'cardio', met: 12.3 },
  { id: 'ex-hiit', name: 'Interval training', group: 'cardio', met: 8.0 },
  { id: 'ex-dance', name: 'Dancing', group: 'cardio', met: 5.5 },
  { id: 'ex-aerobics', name: 'Aerobics class', group: 'cardio', met: 6.5 },

  // ─── Strength ──────────────────────────────────────────────────────────────
  { id: 'ex-weights-light', name: 'Weights, light effort', group: 'strength', met: 3.5 },
  { id: 'ex-weights', name: 'Weights, moderate', group: 'strength', met: 5.0 },
  { id: 'ex-weights-hard', name: 'Weights, heavy', group: 'strength', met: 6.0 },
  { id: 'ex-squat', name: 'Squats', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-deadlift', name: 'Deadlift', group: 'strength', met: 6.0, reps: true },
  { id: 'ex-bench', name: 'Bench press', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-overhead', name: 'Overhead press', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-row-barbell', name: 'Barbell row', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-pullup', name: 'Pull-ups', group: 'strength', met: 8.0, reps: true },
  { id: 'ex-pushup', name: 'Press-ups', group: 'strength', met: 8.0, reps: true },
  { id: 'ex-lunge', name: 'Lunges', group: 'strength', met: 4.0, reps: true },
  { id: 'ex-hip-thrust', name: 'Hip thrust', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-leg-press', name: 'Leg press', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-lat-pulldown', name: 'Lat pulldown', group: 'strength', met: 5.0, reps: true },
  { id: 'ex-curl', name: 'Biceps curl', group: 'strength', met: 3.5, reps: true },
  { id: 'ex-triceps', name: 'Triceps extension', group: 'strength', met: 3.5, reps: true },
  { id: 'ex-kettlebell', name: 'Kettlebell swings', group: 'strength', met: 9.8, reps: true },
  { id: 'ex-circuit', name: 'Circuit training', group: 'strength', met: 7.5 },

  // ─── Core ──────────────────────────────────────────────────────────────────
  { id: 'ex-plank', name: 'Plank', group: 'core', met: 3.8 },
  { id: 'ex-situp', name: 'Sit-ups', group: 'core', met: 4.3, reps: true },
  { id: 'ex-crunch', name: 'Crunches', group: 'core', met: 3.8, reps: true },
  { id: 'ex-leg-raise', name: 'Leg raises', group: 'core', met: 3.8, reps: true },
  { id: 'ex-russian-twist', name: 'Russian twists', group: 'core', met: 4.0, reps: true },
  { id: 'ex-mountain-climber', name: 'Mountain climbers', group: 'core', met: 8.0, reps: true },
  { id: 'ex-burpee', name: 'Burpees', group: 'core', met: 8.0, reps: true },

  // ─── Mobility ──────────────────────────────────────────────────────────────
  { id: 'ex-yoga', name: 'Yoga', group: 'mobility', met: 3.0 },
  { id: 'ex-yoga-power', name: 'Power yoga', group: 'mobility', met: 4.0 },
  { id: 'ex-pilates', name: 'Pilates', group: 'mobility', met: 3.8 },
  { id: 'ex-stretch', name: 'Stretching', group: 'mobility', met: 2.3 },
  { id: 'ex-foam-roll', name: 'Foam rolling', group: 'mobility', met: 2.3 },
  { id: 'ex-physio', name: 'Physio exercises', group: 'mobility', met: 3.0 },

  // ─── Sport ─────────────────────────────────────────────────────────────────
  { id: 'ex-football', name: 'Football', group: 'sport', met: 7.0 },
  { id: 'ex-basketball', name: 'Basketball', group: 'sport', met: 6.5 },
  { id: 'ex-tennis', name: 'Tennis', group: 'sport', met: 7.3 },
  { id: 'ex-badminton', name: 'Badminton', group: 'sport', met: 5.5 },
  { id: 'ex-table-tennis', name: 'Table tennis', group: 'sport', met: 4.0 },
  { id: 'ex-volleyball', name: 'Volleyball', group: 'sport', met: 4.0 },
  { id: 'ex-climbing', name: 'Climbing', group: 'sport', met: 7.5 },
  { id: 'ex-skiing', name: 'Skiing', group: 'sport', met: 7.0 },
  { id: 'ex-skating', name: 'Skating', group: 'sport', met: 7.0 },
  { id: 'ex-martial-arts', name: 'Martial arts', group: 'sport', met: 10.3 },
  { id: 'ex-boxing', name: 'Boxing, bag work', group: 'sport', met: 7.8 },

  // ─── Everyday ──────────────────────────────────────────────────────────────
  { id: 'ex-housework', name: 'Housework', group: 'everyday', met: 3.3 },
  { id: 'ex-gardening', name: 'Gardening', group: 'everyday', met: 3.8 },
  { id: 'ex-diy', name: 'DIY', group: 'everyday', met: 4.5 },
  { id: 'ex-shopping', name: 'Shopping, on foot', group: 'everyday', met: 2.3 },
  { id: 'ex-childcare', name: 'Carrying a child', group: 'everyday', met: 3.5 },
  { id: 'ex-stairs-home', name: 'Stairs at home', group: 'everyday', met: 8.0 },
]

export const EXERCISE_GROUP_LABELS: Record<ExerciseKind['group'], string> = {
  cardio: 'Cardio',
  strength: 'Strength',
  core: 'Core',
  mobility: 'Mobility',
  sport: 'Sport',
  everyday: 'Everyday',
}
