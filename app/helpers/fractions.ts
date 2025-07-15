export const decimalToFraction = (decimal: number): string => {
  // Handle whole numbers
  if (decimal === Math.floor(decimal)) {
    return decimal.toString();
  }
  
  // Handle common fractions
  const tolerance = 0.001;
  const commonFractions = [
    { decimal: 0.125, fraction: '1/8' },
    { decimal: 0.25, fraction: '1/4' },
    { decimal: 0.333, fraction: '1/3' },
    { decimal: 0.375, fraction: '3/8' },
    { decimal: 0.5, fraction: '1/2' },
    { decimal: 0.625, fraction: '5/8' },
    { decimal: 0.667, fraction: '2/3' },
    { decimal: 0.75, fraction: '3/4' },
    { decimal: 0.875, fraction: '7/8' }
  ];
  
  const wholePart = Math.floor(decimal);
  const fractionalPart = decimal - wholePart;
  
  // Find matching common fraction
  for (const { decimal: fracDecimal, fraction } of commonFractions) {
    if (Math.abs(fractionalPart - fracDecimal) < tolerance) {
      return wholePart > 0 ? `${wholePart} ${fraction}` : fraction;
    }
  }
  
  // Fallback to decimal with 2 decimal places
  return decimal.toFixed(2).replace(/\.?0+$/, '');
};