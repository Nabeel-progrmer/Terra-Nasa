const GAS_CONSTANT_AIR = 287.05287;
const GRAVITY_STANDARD = 9.80665;
const MAX_GEOPOTENTIAL_ALTITUDE_KM = 84.852;

const layers = [
  { baseKm: 0, topKm: 11, baseTemperatureK: 288.15, basePressurePa: 101325, lapseRateKPerKm: -6.5 },
  { baseKm: 11, topKm: 20, baseTemperatureK: 216.65, basePressurePa: 22632.06, lapseRateKPerKm: 0 },
  { baseKm: 20, topKm: 32, baseTemperatureK: 216.65, basePressurePa: 5474.889, lapseRateKPerKm: 1 },
  { baseKm: 32, topKm: 47, baseTemperatureK: 228.65, basePressurePa: 868.0187, lapseRateKPerKm: 2.8 },
  { baseKm: 47, topKm: 51, baseTemperatureK: 270.65, basePressurePa: 110.9063, lapseRateKPerKm: 0 },
  { baseKm: 51, topKm: 71, baseTemperatureK: 270.65, basePressurePa: 66.93887, lapseRateKPerKm: -2.8 },
  { baseKm: 71, topKm: MAX_GEOPOTENTIAL_ALTITUDE_KM, baseTemperatureK: 214.65, basePressurePa: 3.956420, lapseRateKPerKm: -2 },
];

export function calculateStandardAtmosphere(altitudeKm) {
  if (!Number.isFinite(altitudeKm) || altitudeKm < 0 || altitudeKm > MAX_GEOPOTENTIAL_ALTITUDE_KM) {
    throw new RangeError(`Altitude must be between 0 and ${MAX_GEOPOTENTIAL_ALTITUDE_KM} geopotential km.`);
  }

  const layer = layers.find(({ baseKm, topKm }) => altitudeKm >= baseKm && altitudeKm < topKm)
    || layers[layers.length - 1];
  const deltaAltitudeM = (altitudeKm - layer.baseKm) * 1000;
  const temperatureK = layer.baseTemperatureK + (layer.lapseRateKPerKm * (altitudeKm - layer.baseKm));
  const pressurePa = layer.lapseRateKPerKm === 0
    ? layer.basePressurePa * Math.exp((-GRAVITY_STANDARD * deltaAltitudeM) / (GAS_CONSTANT_AIR * layer.baseTemperatureK))
    : layer.basePressurePa * (temperatureK / layer.baseTemperatureK) ** (
      (-GRAVITY_STANDARD * 1000) / (GAS_CONSTANT_AIR * layer.lapseRateKPerKm)
    );

  return {
    altitudeKm,
    layer: altitudeKm < 11 ? 'Troposphere' : altitudeKm < 50 ? 'Stratosphere' : 'Mesosphere',
    temperatureK,
    temperatureC: temperatureK - 273.15,
    pressurePa,
    pressureHpa: pressurePa / 100,
    densityKgPerM3: pressurePa / (GAS_CONSTANT_AIR * temperatureK),
  };
}

export function getStandardAtmosphereProfile(stepKm = 2) {
  const profile = [];
  for (let altitudeKm = 0; altitudeKm < MAX_GEOPOTENTIAL_ALTITUDE_KM; altitudeKm += stepKm) {
    profile.push(calculateStandardAtmosphere(altitudeKm));
  }
  profile.push(calculateStandardAtmosphere(MAX_GEOPOTENTIAL_ALTITUDE_KM));
  return profile;
}

export const STANDARD_ATMOSPHERE_LIMIT_KM = MAX_GEOPOTENTIAL_ALTITUDE_KM;
