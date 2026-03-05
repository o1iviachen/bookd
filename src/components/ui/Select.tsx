import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  title?: string;
}

export function Select({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
  title,
}: SelectProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const [isOpen, setIsOpen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption?.label || 'Select...';

  const maxPopupHeight = Math.min(options.length * 48 + 56, screenHeight * 0.5);

  return (
    <View>
      {label && (
        <Text
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
      )}
      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: disabled ? colors.muted : colors.card,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: spacing.sm,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...typography.small,
            color: selectedOption ? colors.foreground : colors.textSecondary,
            flex: 1,
          }}
        >
          {displayText}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={colors.textSecondary}
          style={{ marginLeft: 4 }}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        {/* Backdrop */}
        <Pressable
          onPress={() => setIsOpen(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
        >
          {/* Popup container — stop propagation so tapping inside doesn't close */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: maxPopupHeight,
              backgroundColor: colors.card,
              borderRadius: borderRadius.lg,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 4,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
                {title || label || 'Select'}
              </Text>
            </View>

            {/* Options list */}
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {options.map((item) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      onValueChange(item.value);
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing.md,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: pressed
                        ? colors.muted
                        : isSelected
                          ? colors.primaryLight
                          : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        ...typography.body,
                        fontSize: 14,
                        color: isSelected ? colors.primary : colors.foreground,
                        fontWeight: isSelected ? '600' : '400',
                      }}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
