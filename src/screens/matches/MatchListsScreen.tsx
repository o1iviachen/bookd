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

export function MatchListsScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const { matchId } = route.params;
  const { data: lists, isLoading } = useListsForMatch(matchId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Lists" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <LoadingSpinner />
      ) : !lists || lists.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="No lists yet"
          subtitle="This match hasn't been added to any lists yet"
        />
      ) : (
        <FlatList
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
