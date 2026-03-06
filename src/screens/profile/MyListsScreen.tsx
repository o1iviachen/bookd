import React from 'react';
import { Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useListsForUser } from '../../hooks/useLists';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';
import { MatchList } from '../../types/list';

export function MyListsScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const targetUserId = route.params?.userId || user?.uid || '';
  const isOwnProfile = targetUserId === user?.uid;
  const { data: lists, isLoading } = useListsForUser(targetUserId);

  if (isLoading) return <LoadingSpinner />;

  const renderItem = ({ item }: { item: MatchList }) => (
    <ListPreviewCard
      list={item}
      onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
      onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title={t('common.lists')}
        onBack={() => navigation.goBack()}
        rightElement={isOwnProfile ?
          <Pressable onPress={() => navigation.navigate('CreateList')} hitSlop={8}>
            <Ionicons name="add" size={24} color={colors.foreground} />
          </Pressable>
        : undefined}
      />

      {!lists || lists.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={t('profile.noListsYet')}
          subtitle={isOwnProfile ? t('profile.createYourFirstList') : t('profile.noListsYet')}
        >
          {isOwnProfile && (
            <Pressable
              onPress={() => navigation.navigate('CreateList')}
              style={{
                marginTop: spacing.lg,
                backgroundColor: colors.primary,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.md,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: '#fff' }}>{t('profile.createYourFirstList')}</Text>
            </Pressable>
          )}
        </EmptyState>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 60 }}
        />
      )}
    </SafeAreaView>
  );
}
