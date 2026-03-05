import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { SearchStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'NewHere'>;

const sections = [
  {
    title: 'Getting Started',
    body: 'Start by searching for matches you\'ve watched and rating them. Build your profile to showcase your favorite games and discover what others are watching.',
    icon: 'rocket-outline' as const,
  },
  {
    title: 'Follow Your Teams',
    body: 'Customize your feed by following leagues and teams. See reviews from matches featuring your favorite clubs first.',
    icon: 'shield-outline' as const,
  },
  {
    title: 'Create Lists',
    body: 'Organize matches into collections. Best Champions League finals, unforgettable comebacks, or matches that made you cry\u2014the choice is yours.',
    icon: 'list-outline' as const,
  },
  {
    title: 'Join the Conversation',
    body: 'Engage with other fans through reviews, upvotes, and discussion threads. Share your perspective on the beautiful game.',
    icon: 'chatbubbles-outline' as const,
  },
];

export function NewHereScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();

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
          Welcome
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero area */}
        <View style={{ height: 220, overflow: 'hidden' }}>
          <Image
            source="https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80"
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', `${colors.background}80`, colors.background]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '70%',
            }}
          />
        </View>

        {/* Welcome text */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: colors.foreground,
              textAlign: 'center',
              lineHeight: 36,
              marginBottom: spacing.lg,
            }}
          >
            Take your first step into a larger world...
          </Text>

          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: spacing.sm,
            }}
          >
            Bookd lets you keep track of every match you've seen, so you can instantly recommend
            one the moment someone asks, or check reactions to a match you've just heard about.
          </Text>

          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: spacing.lg,
            }}
          >
            We're a global community of football fans who live to discuss, rate and rank what we watch.
          </Text>
        </View>

        {/* Getting started sections */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          {sections.map((section) => (
            <View
              key={section.title}
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                marginBottom: spacing.lg,
                paddingHorizontal: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.lg,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                <Ionicons name={section.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: colors.foreground,
                    marginBottom: spacing.xs,
                  }}
                >
                  {section.title}
                </Text>
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textSecondary,
                    lineHeight: 21,
                  }}
                >
                  {section.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              backgroundColor: pressed ? `${colors.primary}dd` : colors.primary,
              paddingVertical: spacing.md,
              borderRadius: borderRadius.md,
              alignItems: 'center',
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#14181c' }}>
              Start Exploring Matches
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
