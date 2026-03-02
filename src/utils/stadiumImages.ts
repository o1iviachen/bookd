// Maps home team ID (API-Football IDs) to their stadium image URL
// Uses verified Wikimedia Commons thumbnails (1280px wide, landscape)
// All images are INTERIOR views (taken from inside the stadium looking at the pitch/stands)
const STADIUM_IMAGES: Record<string, string> = {
  // Premier League (API-Football IDs)
  '42': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Emirates_Stadium_-_East_stand_Club_Level.jpg/1280px-Emirates_Stadium_-_East_stand_Club_Level.jpg', // Arsenal
  '66': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/-2007-05-05_Aston_Villa_v_Sheffield_United%2C_Villa_Park_from_the_Holt_End_%281%29.JPG/1280px--2007-05-05_Aston_Villa_v_Sheffield_United%2C_Villa_Park_from_the_Holt_End_%281%29.JPG', // Aston Villa
  '55': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Line-up_at_the_Brentford_v_Nottingham_Forest_football_match_on_21_December_2024_at_Brentford_Community_Stadium.jpg/1280px-Line-up_at_the_Brentford_v_Nottingham_Forest_football_match_on_21_December_2024_at_Brentford_Community_Stadium.jpg', // Brentford
  '51': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/American_Express_Community_Stadium_on_09-08-2011_%28BHAFC_v_Gillingham%2C_League_Cup_First_Round%29_%281%29.JPG/1280px-American_Express_Community_Stadium_on_09-08-2011_%28BHAFC_v_Gillingham%2C_League_Cup_First_Round%29_%281%29.JPG', // Brighton
  '49': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Chelsea_2_Arsenal_0_%2815272717097%29.jpg/1280px-Chelsea_2_Arsenal_0_%2815272717097%29.jpg', // Chelsea
  '52': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Crystal_Palace_vs._Norwich_City_%282019%29.jpg/1280px-Crystal_Palace_vs._Norwich_City_%282019%29.jpg', // Crystal Palace
  '45': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/GoodisonMay2025.jpg/1280px-GoodisonMay2025.jpg', // Everton
  '63': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Leeds_United_-_31559864360.jpg/1280px-Leeds_United_-_31559864360.jpg', // Leeds
  '40': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Panorama_of_Anfield_with_new_main_stand_%2829676137824%29.jpg/1280px-Panorama_of_Anfield_with_new_main_stand_%2829676137824%29.jpg', // Liverpool
  '50': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/City_v_United_2020.jpg/1280px-City_v_United_2020.jpg', // Man City
  '33': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Inside_Old_Trafford_Football_Stadium_-_geograph.org.uk_-_1777320.jpg/1280px-Inside_Old_Trafford_Football_Stadium_-_geograph.org.uk_-_1777320.jpg', // Man Utd
  '34': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Newcastle_United_vs_Wolverhampton_Wanderers%2C_25_February_2012.jpg/1280px-Newcastle_United_vs_Wolverhampton_Wanderers%2C_25_February_2012.jpg', // Newcastle
  '65': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Trent_End_City_Ground_August_2022.jpeg/1280px-Trent_End_City_Ground_August_2022.jpeg', // Nottingham Forest
  '71': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Stadium_Light_Sunderland_1.jpg/1280px-Stadium_Light_Sunderland_1.jpg', // Sunderland
  '41': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/South_stand_of_Tottenham_Hotspur_Stadium%2C_December_2020.jpg/1280px-South_stand_of_Tottenham_Hotspur_Stadium%2C_December_2020.jpg', // Tottenham
  '48': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/West_Ham_London_Stadium_Panorama.jpg/1280px-West_Ham_London_Stadium_Panorama.jpg', // West Ham
  '39': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/MolineuxStadium2022.jpg/1280px-MolineuxStadium2022.jpg', // Wolves
  '44': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Turf_Moor_panorama.jpg/1280px-Turf_Moor_panorama.jpg', // Burnley

  // La Liga (API-Football IDs)
  '530': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Atleti_vs_Villarreal_-_September_2025.jpg/1280px-Atleti_vs_Villarreal_-_September_2025.jpg', // Atletico Madrid
  '529': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Camp_Nou_%282%29.jpg/1280px-Camp_Nou_%282%29.jpg', // Barcelona
  '541': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Santiagobernabeupanorama.jpg/1280px-Santiagobernabeupanorama.jpg', // Real Madrid
  '532': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/CAMP_DE_MESTALLA_GRADA_DE_LA_MAR_2014.JPG/1280px-CAMP_DE_MESTALLA_GRADA_DE_LA_MAR_2014.JPG', // Valencia

  // Bundesliga (API-Football IDs)
  '157': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Allianz_Arena_%2822916770899%29.jpg/1280px-Allianz_Arena_%2822916770899%29.jpg', // Bayern Munich
  '168': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/BayArena_from_Grass_Level.jpg/1280px-BayArena_from_Grass_Level.jpg', // Bayer Leverkusen
  '165': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Auftakt_Westfalenstadion_2010_Panorama_Gro%C3%9F.jpg/1280px-Auftakt_Westfalenstadion_2010_Panorama_Gro%C3%9F.jpg', // Borussia Dortmund
  '173': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Leipzig_stadium.jpg/1280px-Leipzig_stadium.jpg', // RB Leipzig
  '169': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Deutsche_bank_park.jpg/1280px-Deutsche_bank_park.jpg', // Eintracht Frankfurt
  '172': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Stuttgart_stadium.jpg/1280px-Stuttgart_stadium.jpg', // VfB Stuttgart

  // Serie A (API-Football IDs)
  '505': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/The_San_Siro_stadium_during_a_Inter_match_in_2019.jpg/1280px-The_San_Siro_stadium_during_a_Inter_match_in_2019.jpg', // Inter Milan
  '489': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_San_Siro_Stadium_before_a_match_between_AC_Milan_and_SSC_Napoli_in_December_2021.jpg/1280px-The_San_Siro_Stadium_before_a_match_between_AC_Milan_and_SSC_Napoli_in_December_2021.jpg', // AC Milan
  '496': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Inside_Juventus_Stadium.jpg/1280px-Inside_Juventus_Stadium.jpg', // Juventus
  '492': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Stadio_Maradona_Serie_A.jpg/1280px-Stadio_Maradona_Serie_A.jpg', // Napoli
  '497': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg/1280px-Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg', // Roma
  '487': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg/1280px-Stadio_Olimpico_%28Rome%29_-_2014_-_AS_Roma_v_Juventus_FC.jpg', // Lazio

  // Ligue 1 (API-Football IDs)
  '85': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Parc_des_Princes_Paris_Saint_Germain_z_07.jpg/1280px-Parc_des_Princes_Paris_Saint_Germain_z_07.jpg', // PSG
  '80': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Int%C3%A9rieur_POL.JPG/1280px-Int%C3%A9rieur_POL.JPG', // Lyon
};

/**
 * Get the stadium image URL for a team, or null if not mapped.
 * Uses the home team's ID since home team plays at their venue.
 */
export function getStadiumImageUrl(teamId: number): string | null {
  return STADIUM_IMAGES[String(teamId)] || null;
}
