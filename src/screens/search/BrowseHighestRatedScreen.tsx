import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRecentReviews } from '../../hooks/useReviews';
import { ReviewCard } from '../../components/review/ReviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function BrowseHighestRatedScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation();
  const { data: reviews, isLoading } = useRecentReviews();

  const sortedReviews = [...(reviews || [])].sort((a, b) => b.rating - a.rating);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Highest Rated</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {isLoading ? (
          <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
        ) : sortedReviews.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Ionicons name="star-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              No reviews yet
            </Text>
          </View>
        ) : (
          sortedReviews.map((review) => (
            <ReviewCard key={review.id} review={review} onPress={() => {}} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
