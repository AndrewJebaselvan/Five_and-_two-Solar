export const MIN_PANEL_COUNT = 1;
export const MAX_PANEL_COUNT = 100;

export function isValidPanelCount(count) {
  return Number.isInteger(count) && count >= MIN_PANEL_COUNT && count <= MAX_PANEL_COUNT;
}

export function calculatePanelCount(targetCapacityKw, panelWattage) {
  if (!Number.isFinite(targetCapacityKw) || targetCapacityKw <= 0) {
    throw new RangeError('Target capacity must be a positive finite number.');
  }
  if (!Number.isFinite(panelWattage) || panelWattage <= 0) {
    throw new RangeError('Panel wattage must be a positive finite number.');
  }
  const count = Math.ceil((targetCapacityKw * 1000) / panelWattage);
  if (!isValidPanelCount(count)) {
    throw new RangeError('Calculated panel count is outside the supported range.');
  }
  return count;
}

export function calculateArrayCapacityKw(panelCount, panelWattage) {
  if (!isValidPanelCount(panelCount)) {
    throw new RangeError('Panel count must be a whole number from 1 to 100.');
  }
  if (!Number.isFinite(panelWattage) || panelWattage <= 0) {
    throw new RangeError('Panel wattage must be a positive finite number.');
  }
  return (panelCount * panelWattage) / 1000;
}
