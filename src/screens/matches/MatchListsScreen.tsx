import React from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useListsForMatch } from '../../hooks/useLists';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { MatchList } from '../../types/list';
import { useTranslation } from 'react-i18next';

export function MatchListsScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const { t } = useTranslation();
  const { matchId } = route.params;
  const { data: lists, isLoading } = useListsForMatch(matchId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('common.lists')} onBack={() => navigation.goBack()} />

      {isLoading ? (
        <LoadingSpinner />
      ) : !lists || lists.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={t('matches.noListsYet')}
          subtitle={t('matches.matchNotAddedToLists')}
        />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          indicatorStyle={isDark ? 'white' : 'default'}
          data={lists}
          keyExtractor={(item: MatchList) => item.id}
          renderItem={({ item }) => (
            <ListPreviewCard
              list={item}
              onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
              onMatchPress={(mId) => navigation.navigate('MatchDetail', { matchId: mId })}
            />
          )}
          contentContainerStyle={{ paddingBottom: 60 }}
        />
      )}
    </SafeAreaView>
  );
}
