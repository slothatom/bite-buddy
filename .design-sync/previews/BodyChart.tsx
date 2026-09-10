import { BodyChart } from 'bite-buddy'

/**
 * A summer of weigh-ins, with a goal to aim at.
 *
 * Arany's scale, read whenever she remembered: a dozen readings across three
 * months, none of them evenly spaced. The dashed line is the goal, folded into
 * the vertical range so it cannot end up above the box.
 */
export function WeightWithAGoal() {
  const readings = [
    { date: '2026-06-14', value: 84.6 },
    { date: '2026-06-16', value: 84.2 },
    { date: '2026-06-23', value: 83.9 },
    { date: '2026-07-02', value: 83.1 },
    { date: '2026-07-09', value: 83.4 },
    { date: '2026-07-21', value: 82.5 },
    { date: '2026-08-04', value: 81.8 },
    { date: '2026-08-05', value: 82.0 },
    { date: '2026-08-19', value: 81.1 },
    { date: '2026-09-01', value: 80.4 },
    { date: '2026-09-08', value: 80.6 },
    { date: '2026-09-10', value: 80.2 },
  ]
  return (
    <div style={{ width: 520 }}>
      <BodyChart readings={readings} unit="kg" goal={78} />
    </div>
  )
}

/**
 * Four days of curiosity, then nothing until September.
 *
 * The reason this chart exists. Spaced one point per reading, these five would
 * march evenly across the box and draw a steady habit; placed by date, the
 * flurry bunches at the left and the silence is the long flat run that it was.
 */
export function AFlurryThenSilence() {
  const readings = [
    { date: '2026-06-01', value: 94.8 },
    { date: '2026-06-02', value: 94.5 },
    { date: '2026-06-03', value: 94.9 },
    { date: '2026-06-05', value: 94.1 },
    { date: '2026-09-09', value: 91.6 },
  ]
  return (
    <div style={{ width: 520 }}>
      <BodyChart readings={readings} unit="kg" goal={88} />
    </div>
  )
}

/**
 * A first entry, which is one dot and no line.
 *
 * A lone reading still gets a chart rather than an empty box, and both end
 * labels collapse to the one date. There is no change to report yet, so the
 * screen above says so in words instead.
 */
export function OneReading() {
  return (
    <div style={{ width: 400 }}>
      <BodyChart readings={[{ date: '2026-09-10', value: 88.3 }]} unit="kg" goal={82} />
    </div>
  )
}

/**
 * A tape measure rather than a scale, with nothing to aim at.
 *
 * Same component, different unit and no goal, so the dashed line and the
 * "aiming for" line both drop out. Oli's waist, measured monthly, which is
 * about the rate a tape measure gets picked up.
 */
export function WaistInCentimetres() {
  const readings = [
    { date: '2026-03-15', value: 102.5 },
    { date: '2026-04-18', value: 101.0 },
    { date: '2026-05-20', value: 99.5 },
    { date: '2026-06-28', value: 98.0 },
    { date: '2026-08-02', value: 96.5 },
    { date: '2026-09-06', value: 95.0 },
  ]
  return (
    <div style={{ width: 520 }}>
      <BodyChart readings={readings} unit="cm" height={180} />
    </div>
  )
}

/**
 * A fortnight where nothing really moved, drawn as though it did.
 *
 * Six readings inside 300 grams of each other. The vertical range is padded to
 * the data rather than fixed, so a scale that barely twitched still fills the
 * box and the shape looks dramatic. The end dates and the figure you get by
 * tapping a point are the only things that say the whole swing is 300 grams,
 * which is worth seeing before anybody reads a trend into it.
 */
export function NothingMoving() {
  const readings = [
    { date: '2026-08-28', value: 76.2 },
    { date: '2026-08-31', value: 76.4 },
    { date: '2026-09-02', value: 76.2 },
    { date: '2026-09-05', value: 76.3 },
    { date: '2026-09-08', value: 76.1 },
    { date: '2026-09-10', value: 76.3 },
  ]
  return (
    <div style={{ width: 460 }}>
      <BodyChart readings={readings} unit="kg" />
    </div>
  )
}
