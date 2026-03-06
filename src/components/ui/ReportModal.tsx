import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';

const REASON_KEYS = [
  'ui.reasonSpam',
  'ui.reasonInappropriate',
  'ui.reasonHarassment',
  'ui.reasonMisinformation',
  'ui.reasonOther',
] as const;

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'review' | 'comment' | 'discussion_message';
  contentId: string;
}

export function ReportModal({ visible, onClose, contentType, contentId }: ReportModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setSelectedReason(null);
    setNote('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      const fns = getFunctions();
      const submitReport = httpsCallable(fns, 'submitReport');
      await submitReport({ contentType, contentId, reason: selectedReason, note: note.trim() });
      Alert.alert(t('ui.reportSubmitted'), t('ui.reportSubmittedBody'));
      handleClose();
    } catch {
      Alert.alert(t('common.error'), t('ui.failedToSubmitReport'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl + 16,
            paddingHorizontal: spacing.md,
          }}
        >
          {/* Handle bar */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md }} />

          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17, marginBottom: spacing.xs }}>
            {contentType === 'review' ? t('ui.reportReview') : contentType === 'comment' ? t('ui.reportComment') : t('ui.reportMessage')}
          </Text>
          <Text style={{ ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg }}>
            {t('ui.whyReporting')}
          </Text>

          {REASON_KEYS.map((reasonKey) => (
            <Pressable
              key={reasonKey}
              onPress={() => setSelectedReason(reasonKey)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm + 4,
                paddingHorizontal: spacing.sm,
                backgroundColor: pressed
                  ? colors.muted
                  : selectedReason === reasonKey
                  ? colors.primaryLight
                  : 'transparent',
                borderRadius: borderRadius.sm,
                marginBottom: 4,
              })}
            >
              <Text style={{ ...typography.body, color: selectedReason === reasonKey ? colors.primary : colors.foreground }}>
                {t(reasonKey)}
              </Text>
              {selectedReason === reasonKey && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </Pressable>
          ))}

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('ui.addDetails')}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={300}
            style={{
              marginTop: spacing.sm,
              backgroundColor: colors.muted,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              color: colors.foreground,
              ...typography.body,
              minHeight: 72,
              textAlignVertical: 'top',
            }}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={!selectedReason || submitting}
            style={({ pressed }) => ({
              marginTop: spacing.lg,
              backgroundColor: selectedReason ? colors.primary : colors.muted,
              borderRadius: borderRadius.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ ...typography.bodyBold, color: selectedReason ? '#fff' : colors.textSecondary }}>
                {t('ui.submitReport')}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
