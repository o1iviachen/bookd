# Bookd

Letterboxd for football. Track matches you've watched, write reviews, create curated lists, and connect with other fans.

**Stack:** Expo 54 / React Native 0.81 / React 19 / Firebase / TypeScript

## Features

- **Match browsing** — browse fixtures and results by date, league, or team across 26 competitions
- **Reviews** — rate matches (1-5 stars), write reviews with text, tags, photos/GIFs, spoiler toggle, and MOTM voting
- **Lists** — create ranked or unranked match collections (e.g. "Best Champions League Finals")
- **Social** — follow users, upvote/downvote reviews, comment on reviews and lists
- **Search & discovery** — search matches, teams, players, users, reviews, and lists
- **Notifications** — push notifications via Expo for follows, likes, and comments
- **Deep linking** — `bookd://match/:id`, `bookd://review/:id`, `bookd://list/:id`
- **Dark/light theme** — dark by default

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo` — no global install needed)
- [Firebase CLI](https://firebase.google.com/docs/cli) (for Cloud Functions)
- iOS Simulator (Xcode) or Android Emulator, or Expo Go on a physical device

### Install

```bash
git clone <repo-url>
cd bookd
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Fill in the values from Firebase Console → Project settings → Your apps. These are read by `src/config/firebase.ts` via Expo's `EXPO_PUBLIC_` prefix.

### Run the App

```bash
# Start Expo dev server
npx expo start

# Or target a specific platform
npx expo run:ios
npx expo run:android
```

Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with Expo Go.

### Cloud Functions

```bash
cd functions
npm install

# Run locally with the Firebase emulator
firebase emulators:start --only functions

# Deploy to production
firebase deploy --only functions
```

Cloud Functions require a separate `functions/.env` file:

```
API_FOOTBALL_KEY=your-api-football-key
```

## TestFlight Deployment

TestFlight builds use [EAS Build](https://docs.expo.dev/build/introduction/), Expo's cloud build service that compiles your app into an `.ipa` and submits it to Apple.

### 1. Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 2. Create `eas.json`

Create `eas.json` in the project root:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 3. Build & Submit

```bash
# Build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight (after build completes)
eas submit --platform ios --latest
```

**Requirements:** Apple Developer account ($99/yr), app registered in App Store Connect, provisioning profiles (EAS handles these automatically on first build).

## Folder Structure

```
bookd/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/               #   Base components (Button, Avatar, StarRating, etc.)
│   │   ├── match/            #   Match cards, team logos, date picker, filters
│   │   ├── review/           #   Review cards, vote buttons, MOTM badge/picker
│   │   ├── list/             #   List preview cards, add-to-list modal
│   │   ├── feed/             #   League carousels
│   │   ├── profile/          #   Rating chart
│   │   └── diary/            #   Diary entry rows
│   ├── screens/              # Screen components (one per route)
│   │   ├── auth/             #   Login, signup, forgot password, onboarding
│   │   ├── feed/             #   Home feed (matches, reviews, lists tabs)
│   │   ├── matches/          #   Match browsing, match detail (reviews/lineup/info)
│   │   ├── review/           #   Create/edit review, review detail
│   │   ├── list/             #   Create/edit list, list detail
│   │   ├── search/           #   Search, browse popular/highest-rated, FAQ
│   │   ├── profile/          #   User profile, edit profile, games, diary, tags
│   │   ├── person/           #   Other user profiles
│   │   ├── team/             #   Team detail (matches, squad, info)
│   │   ├── league/           #   League detail (fixtures, standings, knockout)
│   │   ├── notifications/    #   Activity feed
│   │   └── settings/         #   App and notification settings
│   ├── navigation/           # React Navigation setup
│   │   ├── RootNavigator.tsx #   Auth → Onboarding → MainTabs routing
│   │   ├── MainTabs.tsx      #   5-tab bottom navigation
│   │   └── *Stack.tsx        #   Per-tab stack navigators
│   ├── services/             # Business logic & data access
│   │   ├── firestore/        #   Firestore CRUD (users, reviews, lists, comments, etc.)
│   │   ├── footballApi.ts    #   Match/team/player queries from Firestore
│   │   ├── auth.ts           #   Firebase Auth (sign in/up/out, password reset)
│   │   ├── storage.ts        #   Cloud Storage uploads (avatars, review media)
│   │   ├── tenor.ts          #   GIF search via Klipy API
│   │   └── pushNotifications.ts
│   ├── hooks/                # React Query hooks
│   │   ├── useMatches.ts     #   Match queries (by date, live polling, prefetch)
│   │   ├── useReviews.ts     #   Review queries & mutations (CRUD, voting)
│   │   ├── useLists.ts       #   List queries & mutations
│   │   ├── useComments.ts    #   Comment queries & mutations
│   │   ├── useUser.ts        #   User profile, follow/unfollow, watched/liked
│   │   ├── useNotifications.ts
│   │   ├── useTeams.ts       #   Team queries
│   │   └── usePeople.ts      #   User search
│   ├── context/              # React Context providers
│   │   ├── AuthContext.tsx    #   Auth state, sign in/up/out
│   │   └── ThemeContext.tsx   #   Dark/light theme toggle
│   ├── config/
│   │   ├── firebase.ts       #   Firebase init (auth, db, storage)
│   │   └── theme.ts          #   Theme colors, spacing, typography
│   ├── types/                # TypeScript interfaces (Match, User, Review, etc.)
│   └── utils/                # Helpers (date formatting, team colors, flags, moderation)
├── functions/                # Firebase Cloud Functions
│   └── src/
│       ├── index.ts          #   Scheduled & HTTP function exports
│       ├── config.ts         #   API-Football config, league list, collection names
│       ├── apiFootball.ts    #   API-Football HTTP client
│       ├── transforms.ts     #   API response → Firestore doc transforms
│       ├── sync/
│       │   ├── syncMatches.ts    # Daily match sync (yesterday + today + tomorrow)
│       │   ├── syncStandings.ts  # Daily league standings sync
│       │   ├── syncDetails.ts    # Match details backfill (lineups, stats, events)
│       │   ├── syncLive.ts       # Live score updates (every 2 min)
│       │   └── backfill.ts       # Historical data backfill by league/season
│       ├── notifications.ts  #   Push notification delivery
│       ├── moderateMedia.ts  #   Content moderation
│       ├── report.ts         #   User report handling
│       └── user.ts           #   Account deletion
├── assets/                   # App icons, splash screen, background images
├── App.tsx                   # Root component (providers + navigation)
├── app.json                  # Expo configuration
├── firebase.json             # Firebase project config
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Firestore composite indexes
└── tsconfig.json             # TypeScript configuration
```

## Architecture

### Data Flow

```
API-Football (external API)
       │
       ▼
Cloud Functions (scheduled sync)
       │
       ▼
   Firestore ◄──── Client writes (reviews, lists, follows, etc.)
       │
       ▼
 Service layer (src/services/)
       │
       ▼
 React Query hooks (src/hooks/)
       │
       ▼
   Components
```

Football data (matches, standings, lineups, teams, players) is synced from API-Football into Firestore by Cloud Functions on a schedule. The client app reads everything from Firestore — it never calls API-Football directly.

User-generated content (reviews, lists, comments, follows, notifications) is written directly to Firestore by the client through the service layer.

### Navigation

```
RootNavigator
├── AuthStack (not logged in)
│   └── Welcome → Login → SignUp → ForgotPassword
├── OnboardingStack (new users)
│   └── Leagues → Teams → Matches
└── MainTabs (authenticated)
    ├── Feed        — home feed with matches, reviews, lists tabs
    ├── Matches     — browse by date, match detail (reviews/lineup/info)
    ├── Search      — universal search + browse popular/highest-rated
    ├── Activity    — notification feed (with unread badge)
    └── Profile     — user profile, settings, games, diary, lists
```

### State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Server state | TanStack React Query | All Firestore data (matches, reviews, lists, users, notifications) with caching, pagination, optimistic updates, and smart refetch intervals |
| Auth state | React Context (`AuthContext`) | Current user, sign in/up/out, onboarding flag |
| Theme state | React Context (`ThemeContext`) | Dark/light theme toggle |

## Database

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `matches` | Match data synced from API-Football |
| `matchDetails` | Lineups, match stats, goals, bookings, substitutions |
| `standings` | League table standings |
| `leagues` | League/cup metadata (name, code, tier, country, emblem) |
| `teams` | Team metadata (name, crest, colors, squad, coach, venue) |
| `players` | Player data (name, position, nationality, photo, currentTeam) |
| `users` | User profiles, preferences, follow lists, watched/liked matches |
| `reviews` | Match reviews (rating, text, tags, media, votes) |
| `reviews/{id}/votes` | Subcollection tracking per-user vote on each review |
| `lists` | User-created match lists (ranked/unranked) |
| `comments` | Comments on reviews (supports GIFs, threaded replies 1 level deep) |
| `listComments` | Comments on lists |
| `matchDiscussions` | Real-time match discussion messages |
| `notifications` | In-app notifications (follows, likes, comments) |
| `reports` | User-submitted content reports |

### Data Model

```typescript
interface Match {
  id: number;
  competition: Competition;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus; // 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED'
  kickoff: string;
  venue: string | null;
  matchday: number | null;
  stage: string | null;
  ratingSum?: number;           // Pre-computed aggregate — updated atomically on review write/delete
  ratingCount?: number;
  ratingBuckets?: Record<string, number>; // Per-bucket counts: key = rating × 10 (e.g. "35" for 3.5)
  motmVotes?: Record<string, number>;     // Player ID → vote count
  legacyId?: number;            // Old football-data.org ID for migration
}

interface Team {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

interface TeamDetail extends Team {
  venue: string | null;
  founded: number | null;
  clubColors: string | null;
  country: string;
  competitionCodes: string[];
  coach: Coach | null;
  squad: { id: number; name: string; position: string; nationality: string }[];
  activeCompetitions: { id: number; name: string; code: string; emblem: string }[];
}

interface Competition {
  id: number;
  name: string;
  emblem: string;
  code: string;
}

interface League {
  code: string;
  apiId: number;
  name: string;
  country: string;
  emblem: string;
  tier: number;
  isCup: boolean;
  seasonType: 'european' | 'calendar-year';
  displayOrder: number;
  enabled: boolean;
  followable: boolean;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
  bio: string;
  location: string;
  website: string;
  favoriteTeams: string[];
  favoriteCountry: string | null;
  clubAffiliations: string[];
  followedLeagues: string[];
  followedTeamIds: string[];
  favoriteMatchIds: number[];
  watchedMatchIds: number[];
  likedMatchIds: number[];
  customTags: string[];
  following: string[];
  followers: string[];
  expoPushToken: string | null;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
}

interface Review {
  id: string;
  matchId: number;
  userId: string;
  username: string;
  userAvatar: string | null;
  rating: number;
  text: string;
  tags: string[];
  media: ReviewMedia[];
  isSpoiler: boolean;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  editedAt: Date | null;
  userVote: 'up' | 'down' | null;
  matchLabel?: string;
  flagged?: boolean;
  motmPlayerId?: number;
  motmPlayerName?: string;
}

interface ReviewMedia {
  url: string;
  type: 'image' | 'gif';
  thumbnailUrl?: string;
}

interface MatchList {
  id: string;
  userId: string;
  username: string;
  name: string;
  description: string;
  matchIds: number[];
  ranked: boolean;
  likes: number;
  createdAt: Date;
  coverImage: string | null;
}

interface Comment {
  id: string;
  reviewId: string;
  parentId: string | null;       // Top-level comment ID for replies (1 level deep)
  userId: string;
  username: string;
  userAvatar: string | null;
  text: string;
  gifUrl: string | null;         // Klipy GIF URL
  likes: number;
  likedBy: string[];
  createdAt: Date;
}

interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string | null;
  type: NotificationType; // 'follow' | 'review_like' | 'comment' | 'comment_like' | 'list_like' | 'list_comment'
  reviewId: string | null;
  commentId: string | null;
  listId: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface PersonDetail {
  id: number;
  name: string;
  photo: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  position: string | null;
  shirtNumber: number | null;
  currentTeam: { id: number; name: string; crest: string } | null;
}

interface MatchDetail {
  match: Match;
  homeLineup: MatchPlayer[];
  homeBench: MatchPlayer[];
  awayLineup: MatchPlayer[];
  awayBench: MatchPlayer[];
  homeCoach: Coach | null;
  awayCoach: Coach | null;
  homeFormation: string | null;
  awayFormation: string | null;
  goals: MatchGoal[];
  referee: string | null;
  stats: MatchStats | null;
  bookings: MatchBooking[];
  substitutions: MatchSubstitution[];
  halfTimeScore: { home: number | null; away: number | null } | null;
  attendance: number | null;
}
```

## Cloud Functions

### Scheduled Syncs

| Schedule | Function | What it does |
|----------|----------|--------------|
| Daily 06:00 UTC | `syncMatches` | Syncs yesterday's results, today's fixtures, tomorrow's fixtures |
| Daily 06:00 UTC | `syncStandings` | Updates league standings for all 26 competitions |
| Every 2 min | `syncLive` | Updates scores for in-play matches |
| Every 2 min | `syncDetails` | Backfills missing match details (lineups, stats, events) |

### HTTP Endpoints (Admin)

- `/backfill` — backfill historical match data by league and season
- `/manualSync` — trigger match sync for a specific date range
- `/syncDetailsForLeague` — sync match details for a specific league
- `/buildTeams` — generate team documents from match data
- `/buildPlayers` — generate player documents from match details
- `/enrichTeams` — fetch team colors from API-Football
- `/enrichPlayers` — fetch player photos from squad data

### Supported Leagues (26)

**Top 5:** Premier League, La Liga, Bundesliga, Serie A, Ligue 1
**European cups:** Champions League, Europa League, Conference League
**England:** Championship, FA Cup, EFL Cup
**Europe:** Eredivisie, Primeira Liga, Scottish Premiership, Super Lig, Jupiler Pro League
**Americas:** Brasileirao, Liga Profesional, MLS, Liga MX
**Other:** Saudi Pro League, J1 League, A-League
**International:** World Cup, Euro Championship, Nations League, Copa America
