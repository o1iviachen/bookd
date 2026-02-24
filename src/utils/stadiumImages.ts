// Maps home team ID to their stadium image URL
// Uses verified Wikimedia Commons thumbnails (1280px wide, landscape)
// All images are INTERIOR views (taken from inside the stadium looking at the pitch/stands)
const STADIUM_IMAGES: Record<string, string> = {
  // Premier League
  '57': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Emirates_Stadium_-_East_stand_Club_Level.jpg/1280px-Emirates_Stadium_-_East_stand_Club_Level.jpg', // Arsenal - Emirates Stadium (interior, East stand Club Level view)
  '58': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/-2007-05-05_Aston_Villa_v_Sheffield_United%2C_Villa_Park_from_the_Holt_End_%281%29.JPG/1280px--2007-05-05_Aston_Villa_v_Sheffield_United%2C_Villa_Park_from_the_Holt_End_%281%29.JPG', // Aston Villa - Villa Park (interior, from the Holte End)
  '402': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Line-up_at_the_Brentford_v_Nottingham_Forest_football_match_on_21_December_2024_at_Brentford_Community_Stadium.jpg/1280px-Line-up_at_the_Brentford_v_Nottingham_Forest_football_match_on_21_December_2024_at_Brentford_Community_Stadium.jpg', // Brentford - Gtech (interior, match day lineup view)
  '397': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/American_Express_Community_Stadium_on_09-08-2011_%28BHAFC_v_Gillingham%2C_League_Cup_First_Round%29_%281%29.JPG/1280px-American_Express_Community_Stadium_on_09-08-2011_%28BHAFC_v_Gillingham%2C_League_Cup_First_Round%29_%281%29.JPG', // Brighton - Amex (interior, match day view)
  '61': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Chelsea_2_Arsenal_0_%2815272717097%29.jpg/1280px-Chelsea_2_Arsenal_0_%2815272717097%29.jpg', // Chelsea - Stamford Bridge (interior, match day view)
  '354': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Crystal_Palace_vs._Norwich_City_%282019%29.jpg/1280px-Crystal_Palace_vs._Norwich_City_%282019%29.jpg', // Crystal Palace - Selhurst Park (interior, match day view)
  '62': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/GoodisonMay2025.jpg/1280px-GoodisonMay2025.jpg', // Everton - Goodison Park (interior, May 2025 view)
  '341': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Leeds_United_-_31559864360.jpg/1280px-Leeds_United_-_31559864360.jpg', // Leeds - Elland Road (interior, South Stand view)
  '64': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Panorama_of_Anfield_with_new_main_stand_%2829676137824%29.jpg/1280px-Panorama_of_Anfield_with_new_main_stand_%2829676137824%29.jpg', // Liverpool - Anfield (interior panorama with new Main Stand)
  '65': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/City_v_United_2020.jpg/1280px-City_v_United_2020.jpg', // Man City - Etihad (interior, Carabao Cup semi-final Man City v Man Utd 2020)
  '66': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Inside_Old_Trafford_Football_Stadium_-_geograph.org.uk_-_1777320.jpg/1280px-Inside_Old_Trafford_Football_Stadium_-_geograph.org.uk_-_1777320.jpg', // Man Utd - Old Trafford (interior view)
  '67': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Newcastle_United_vs_Wolverhampton_Wanderers%2C_25_February_2012.jpg/1280px-Newcastle_United_vs_Wolverhampton_Wanderers%2C_25_February_2012.jpg', // Newcastle - St James' Park (interior, match day view)
  '351': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Trent_End_City_Ground_August_2022.jpeg/1280px-Trent_End_City_Ground_August_2022.jpeg', // Nottingham Forest - City Ground (interior, Trent End view)
  '71': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Stadium_Light_Sunderland_1.jpg/1280px-Stadium_Light_Sunderland_1.jpg', // Sunderland - Stadium of Light (interior view)
  '73': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/South_stand_of_Tottenham_Hotspur_Stadium%2C_December_2020.jpg/1280px-South_stand_of_Tottenham_Hotspur_Stadium%2C_December_2020.jpg', // Tottenham (interior, South Stand view)
  '563': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/West_Ham_London_Stadium_Panorama.jpg/1280px-West_Ham_London_Stadium_Panorama.jpg', // West Ham - London Stadium (interior panorama)
  '76': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/MolineuxStadium2022.jpg/1280px-MolineuxStadium2022.jpg', // Wolves - Molineux (interior view)
  '328': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Turf_Moor_panorama.jpg/1280px-Turf_Moor_panorama.jpg', // Burnley - Turf Moor (interior panorama)

  // La Liga
  '78': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Atleti_vs_Villarreal_-_September_2025.jpg/1280px-Atleti_vs_Villarreal_-_September_2025.jpg', // Atletico Madrid - Metropolitano (interior, match day)
  '81': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Camp_Nou_%282%29.jpg/1280px-Camp_Nou_%282%29.jpg', // Barcelona - Camp Nou (interior view of pitch and stands)
  '86': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Santiagobernabeupanorama.jpg/1280px-Santiagobernabeupanorama.jpg', // Real Madrid - Bernabeu (interior panorama)
  '95': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/CAMP_DE_MESTALLA_GRADA_DE_LA_MAR_2014.JPG/1280px-CAMP_DE_MESTALLA_GRADA_DE_LA_MAR_2014.JPG', // Valencia - Mestalla (interior, Grada de la Mar stand view)

  // Bundesliga
  '5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Allianz_Arena_%2822916770899%29.jpg/1280px-Allianz_Arena_%2822916770899%29.jpg', // Bayern Munich - Allianz Arena (interior view)
  '3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/BayArena_from_Grass_Level.jpg/1280px-BayArena_from_Grass_Level.jpg', // Bayer Leverkusen - BayArena (interior, pitch level view)
  '4': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Auftakt_Westfalenstadion_2010_Panorama_Gro%C3%9F.jpg/1280px-Auftakt_Westfalenstadion_2010_Panorama_Gro%C3%9F.jpg', // Borussia Dortmund - Signal Iduna Park (interior panorama)
  '721': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Leipzig_stadium.jpg/1280px-Leipzig_stadium.jpg', // RB Leipzig
  '19': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Deutsche_bank_park.jpg/1280px-Deutsche_bank_park.jpg', // Eintracht Frankfurt
  '10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Stuttgart_stadium.jpg/1280px-Stuttgart_stadium.jpg', // VfB Stuttgart - MHP Arena

  // Serie A
  '108': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/The_San_Siro_stadium_during_a_Inter_match_in_2019.jpg/1280px-The_San_Siro_stadium_during_a_Inter_match_in_2019.jpg', // Inter Milan - San Siro (interior, match day)
  '98': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_San_Siro_Stadium_before_a_match_between_AC_Milan_and_SSC_Napoli_in_December_2021.jpg/1280px-The_San_Siro_Stadium_before_a_match_between_AC_Milan_and_SSC_Napoli_in_December_2021.jpg', // AC Milan - San Siro (interior, pre-match)
  '109': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Inside_Juventus_Stadium.jpg/1280px-Inside_Juventus_Stadium.jpg', // Juventus - Allianz Stadium (interior view)
  '113': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Stadio_Maradona_Serie_A.jpg/1280px-Stadio_Maradona_Serie_A.jpg', // Napoli - Maradona (interior panorama, Serie A match)
  '100': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg/1280px-Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg', // Roma - Olimpico (interior, match day)
  '110': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg/1280px-Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg', // Lazio - Olimpico (shared, interior match day)

  // Ligue 1
  '524': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Parc_des_Princes_Paris_Saint_Germain_z_07.jpg/1280px-Parc_des_Princes_Paris_Saint_Germain_z_07.jpg', // PSG - Parc des Princes (interior, match day view)
  '523': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Int%C3%A9rieur_POL.JPG/1280px-Int%C3%A9rieur_POL.JPG', // Lyon - Groupama Stadium (interior view)
};

/**
 * Get the stadium image URL for a team, or null if not mapped.
 * Uses the home team's ID since home team plays at their venue.
 */
export function getStadiumImageUrl(teamId: number): string | null {
  return STADIUM_IMAGES[String(teamId)] || null;
}
