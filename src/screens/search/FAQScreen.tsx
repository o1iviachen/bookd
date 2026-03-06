import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput as RNTextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqKeys: { id: string; categoryKey: string; questionKey: string; answerKey: string }[] = [
  { id: 'what-is-bookd', categoryKey: 'faq.categoryAbout', questionKey: 'faq.whatIsBookd', answerKey: 'faq.whatIsBookdAnswer' },
  { id: 'how-to-review', categoryKey: 'faq.categoryUsing', questionKey: 'faq.howToReview', answerKey: 'faq.howToReviewAnswer' },
  { id: 'what-are-lists', categoryKey: 'faq.categoryUsing', questionKey: 'faq.whatAreLists', answerKey: 'faq.whatAreListsAnswer' },
  { id: 'following-teams', categoryKey: 'faq.categoryPersonalization', questionKey: 'faq.howDoesFollowingWork', answerKey: 'faq.howDoesFollowingWorkAnswer' },
  { id: 'rating-system', categoryKey: 'faq.categoryUsing', questionKey: 'faq.howShouldIRate', answerKey: 'faq.howShouldIRateAnswer' },
  { id: 'privacy', categoryKey: 'faq.categoryAccount', questionKey: 'faq.isMyDataPrivate', answerKey: 'faq.isMyDataPrivateAnswer' },
  { id: 'edit-review', categoryKey: 'faq.categoryUsing', questionKey: 'faq.canIEditOrDelete', answerKey: 'faq.canIEditOrDeleteAnswer' },
];

export function FAQScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const faqs = useMemo(() => faqKeys.map((fk) => ({
    id: fk.id,
    category: t(fk.categoryKey),
    question: t(fk.questionKey),
    answer: t(fk.answerKey),
  })), [t]);

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q)
    );
  }, [searchQuery, faqs]);

  const categories = [...new Set(filteredFAQs.map((f) => f.category))];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.search')}</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>
          {t('faq.title')}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.muted,
            borderRadius: borderRadius.md,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder={t('faq.quickFind')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            style={{
              flex: 1,
              paddingLeft: 10,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: spacing.md, paddingTop: spacing.lg }}
      >
        {categories.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>
              {t('faq.noQuestionsFound')}
            </Text>
          </View>
        ) : (
          <>
            {categories.map((category) => {
              const categoryFAQs = filteredFAQs.filter((f) => f.category === category);
              return (
                <View key={category} style={{ marginBottom: spacing.xl }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      marginBottom: spacing.md,
                    }}
                  >
                    {category}
                  </Text>
                  {categoryFAQs.map((faq) => {
                    const isExpanded = expandedId === faq.id;
                    return (
                      <Pressable
                        key={faq.id}
                        onPress={() => toggleQuestion(faq.id)}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                          paddingVertical: spacing.md,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: spacing.sm,
                          }}
                        >
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 17,
                              fontWeight: '600',
                              color: colors.foreground,
                            }}
                          >
                            {faq.question}
                          </Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={colors.textSecondary}
                            style={{ marginTop: 2 }}
                          />
                        </View>
                        {isExpanded && (
                          <Text
                            style={{
                              ...typography.body,
                              color: colors.textSecondary,
                              lineHeight: 22,
                              marginTop: spacing.sm,
                            }}
                          >
                            {faq.answer}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            {/* Contact */}
            <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
                {t('faq.stillNeedHelp')}
              </Text>
              <Pressable
                onPress={() => Linking.openURL('mailto:olivia@bookd-app.com?subject=Bookd%20Support%20Request')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md }}
              >
                <Ionicons name="mail-outline" size={18} color="#14181c" />
                <Text style={{ ...typography.bodyBold, color: '#14181c' }}>{t('faq.supportEmail')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
