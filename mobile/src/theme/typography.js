import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  fontFamily,

  // Sizes
  hero: 32,
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  body: 16,
  bodySmall: 14,
  caption: 13,
  small: 12,
  tiny: 11,

  // Weights
  bold: '700',
  semibold: '600',
  medium: '500',
  regular: '400',

  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.7,
};
