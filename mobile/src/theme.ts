// Clean black-and-white palette: the app's chrome (backgrounds, borders,
// selected states) is monochrome; warning/danger/success stay as the only
// color left, since those are functional signals (delay/cancel/boarding),
// not decoration.
export const colors = {
  background: '#000000',
  surface: '#141414',
  surfaceAlt: '#1f1f1f',
  border: '#2c2c2c',
  textPrimary: '#ffffff',
  textSecondary: '#9a9a9a',
  accent: '#ffffff',
  warning: '#d9a441',
  danger: '#e2554f',
  success: '#4caf7d',
};

export const statusColor: Record<string, string> = {
  scheduled: colors.textSecondary,
  delayed: colors.warning,
  boarding: colors.success,
  final_call: colors.warning,
  gate_closed: colors.danger,
  departed: colors.textSecondary,
  cancelled: colors.danger,
};
