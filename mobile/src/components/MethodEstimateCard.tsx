import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MethodEstimate } from '../types';
import { BoardingMethodBadge } from './BoardingMethodBadge';
import { BoardingReportPrompt } from './BoardingReportPrompt';
import { colors } from '../theme';

interface Props {
  title: string;
  estimate: MethodEstimate;
  flightNumber: string;
  airport: string;
  phase: 'board' | 'deplane';
}

/**
 * Shows a confident badge ONLY when we actually have grounds to (crowd
 * confirmation, or a strong-enough signal). When it's genuinely a toss-up,
 * this deliberately shows no single confident answer - just the reasoning
 * and a way to help resolve it, because a wrong confident answer is worse
 * than an honest "we don't know yet."
 */
export function MethodEstimateCard({ title, estimate, flightNumber, airport, phase }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {estimate.confidenceLevel === 'confirmed' && (
        <>
          <BoardingMethodBadge method={estimate.method} />
          <Text style={styles.confirmedNote}>
            ✓ Confirmed by {estimate.reportCounts[estimate.method] ?? 0} travelers on this flight
          </Text>
        </>
      )}

      {estimate.confidenceLevel === 'likely' && (
        <>
          <BoardingMethodBadge method={estimate.method} />
          <Text style={styles.likelyNote}>
            ~{Math.round(estimate.probability * 100)}% likely, not yet confirmed — {estimate.reasoning[0]}
          </Text>
          <BoardingReportPrompt flightNumber={flightNumber} airport={airport} phase={phase} />
        </>
      )}

      {estimate.confidenceLevel === 'uncertain' && (
        <View style={styles.uncertainCard}>
          <Text style={styles.uncertainTitle}>⚠ Not yet known — could be either</Text>
          {estimate.reasoning.map((reason) => (
            <Text key={reason} style={styles.reasonText}>
              • {reason}
            </Text>
          ))}
          <Text style={styles.prepTip}>
            Come prepared for a bus: wear comfortable shoes, keep essentials within reach, and budget a few extra
            minutes just in case.
          </Text>
          <BoardingReportPrompt flightNumber={flightNumber} airport={airport} phase={phase} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  confirmedNote: { color: colors.success, fontSize: 12, marginTop: 8, fontWeight: '600' },
  likelyNote: { color: colors.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 17 },
  uncertainCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uncertainTitle: { color: colors.warning, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  reasonText: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, lineHeight: 17 },
  prepTip: { color: colors.textPrimary, fontSize: 12, marginTop: 8, lineHeight: 17 },
});
