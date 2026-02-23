import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useListsForUser } from '../../hooks/useLists';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { MatchList } from '../../types/list';

export function MyListsScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: lists, isLoading } = useListsForUser(user?.uid || '');

  if (isLoading) return <LoadingSpinner />;

  const renderItem = ({ item }: { item: MatchList }) => (
    <View style={{ paddingHorizontal: spacing.md }}>
      <ListPreviewCard
        list={item}
        onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }}>
          Lists
        </Text>
        <Pressable onPress={() => navigation.navigate('CreateList')} hitSlop={8}>
          <Ionicons name="add" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      {!lists || lists.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            No lists yet
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            Organize your favourite matches into lists
          </Text>
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
            <Text style={{ ...typography.bodyBold, color: '#fff' }}>Create Your First List</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList indicatorStyle={isDark ? 'white' : 'default'}
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 60 }}
        />
      )}
    </SafeAreaView>
  );
}
