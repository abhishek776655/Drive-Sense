/**
 * Barometer elevation (spec 2026-10-25, telemetry sources, section 3): the phone's air pressure gives
 * altitude changes to about a metre, where GPS altitude wanders by tens of metres. Absolute height
 * still comes from GPS; the barometer supplies how it changes.
 */

/** Standard atmosphere: the international barometric formula. */
const SEA_LEVEL_HPA = 1013.25;

/** Altitude (m) for a pressure (hPa) in the standard atmosphere. Only differences matter here. */
export const pressureToAltitudeM = (hPa: number): number => 44330 * (1 - (hPa / SEA_LEVEL_HPA) ** (1 / 5.255));

/** The barometer's change since `base` laid onto the GPS altitude taken at the same moment. */
export const fuseAltitude = (base: {baroM: number; gpsM: number}, baroM: number): number => base.gpsM + (baroM - base.baroM);

/** Climb and descent smaller than this are pressure noise or the car's ventilation. */
export const BARO_HYSTERESIS_M = 1;

export type ElevationState = {refM: number | null; gainM: number; lossM: number};

/** One altitude reading into the running climb and descent, moving the reference only past the band. */
export const stepElevation = (s: ElevationState, altM: number, hysteresisM = BARO_HYSTERESIS_M): ElevationState => {
  if (s.refM == null) {
    return {...s, refM: altM};
  }
  const delta = altM - s.refM;
  if (Math.abs(delta) < hysteresisM) {
    return s;
  }
  return {refM: altM, gainM: s.gainM + Math.max(0, delta), lossM: s.lossM + Math.max(0, -delta)};
};
