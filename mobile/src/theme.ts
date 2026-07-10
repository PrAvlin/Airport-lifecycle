export const colors = {
  background: '#0b1d3a',
  surface: '#122a4d',
  surfaceAlt: '#1a3660',
  border: '#2a4570',
  textPrimary: '#f4f7fb',
  textSecondary: '#9fb2d1',
  accent: '#4fd1c5',
  warning: '#f6ad55',
  danger: '#fc8181',
  success: '#68d391',
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
