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

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    id: 'what-is-bookd',
    category: 'ABOUT BOOKD',
    question: 'What is Bookd?',
    answer:
      'Bookd is a global social network for football discussion and discovery. Use it as a diary to record and share your opinion about matches as you watch them, or just to keep track of matches you\u2019ve seen. Showcase your favorites on your profile. Rate, review, and tag matches as you add them. Follow friends to see what they\u2019re enjoying. Create lists and collections on any topic.',
  },
  {
    id: 'how-to-review',
    category: 'USING BOOKD',
    question: 'How do I review a match?',
    answer:
      'Navigate to any match page and tap the star rating. You can add a star rating (0.5 to 5 stars), write your thoughts, and tag it with relevant themes. Your review will appear on your profile and in your followers\u2019 feeds.',
  },
  {
    id: 'what-are-lists',
    category: 'USING BOOKD',
    question: 'What are Lists?',
    answer:
      'Lists let you create curated collections of matches around any theme. Whether it\u2019s \u201cGreatest Finals Ever\u201d, \u201cUnderdog Victories\u201d, or \u201cMatches That Made Me Cry\u201d, lists help you organize and share matches with the community. Other users can like and follow your lists.',
  },
  {
    id: 'following-teams',
    category: 'PERSONALIZATION',
    question: 'How does Following work?',
    answer:
      'Go to Settings to select your favourite teams. Your feed and matches page will prioritize matches featuring your followed teams first, then from followed leagues. This helps you see the most relevant content.',
  },
  {
    id: 'rating-system',
    category: 'USING BOOKD',
    question: 'How should I rate matches?',
    answer:
      'Ratings are personal! Some rate based on entertainment value, others on historical significance or emotional impact. A 5-star match might be a tactical masterclass, an incredible comeback, or simply a game that meant something special to you. Be consistent with your own criteria and your profile will reflect your unique perspective.',
  },
  {
    id: 'privacy',
    category: 'ACCOUNT AND PRIVACY',
    question: 'Is my data private?',
    answer:
      'Your reviews and profile are public by default to foster community discussion. However, you can control what appears in your activity feed. We never share your personal information with third parties.',
  },
  {
    id: 'edit-review',
    category: 'USING BOOKD',
    question: 'Can I edit or delete reviews?',
    answer:
      'Yes! Tap on any of your reviews to access edit and delete options. You can update your rating, text, and tags at any time. Deleted reviews are permanently removed.',
  },
];

export function FAQScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

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
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>
          Frequently Asked Questions
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
            placeholder="Quick find..."
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
              No questions found matching "{searchQuery}"
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
                Still need help? Reach out to us at
              </Text>
              <Pressable
                onPress={() => Linking.openURL('mailto:olivia@bookd-app.com?subject=Bookd%20Support%20Request')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md }}
              >
                <Ionicons name="mail-outline" size={18} color="#14181c" />
                <Text style={{ ...typography.bodyBold, color: '#14181c' }}>olivia@bookd-app.com</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
