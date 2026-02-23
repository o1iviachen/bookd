// Maps home team ID to their stadium image URL
// Uses verified Wikimedia Commons thumbnails (1280px wide, landscape)
const STADIUM_IMAGES: Record<string, string> = {
  // Premier League
  '57': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/London_Emirates_Stadium_arsenal.jpg/1280px-London_Emirates_Stadium_arsenal.jpg', // Arsenal - Emirates Stadium
  '58': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Birmingham_aston_villa_park_stadium.jpg/1280px-Birmingham_aston_villa_park_stadium.jpg', // Aston Villa - Villa Park
  '402': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Brentford_Gtech_Community_Stadium.jpg/1280px-Brentford_Gtech_Community_Stadium.jpg', // Brentford - Gtech
  '397': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Amex_Community_Stadium.jpg/1280px-Amex_Community_Stadium.jpg', // Brighton - Amex
  '61': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/London_Stamford_Bridge.jpg/1280px-London_Stamford_Bridge.jpg', // Chelsea - Stamford Bridge
  '354': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/2023_09_09_arne_mueseler_17_18_07_00743-Verbessert-RR_%2853283239217%29.jpg/1280px-2023_09_09_arne_mueseler_17_18_07_00743-Verbessert-RR_%2853283239217%29.jpg', // Crystal Palace - Selhurst Park
  '62': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/2023_07_31_arne_mueseler_00023-Verbessert-RR_%2853105680992%29.jpg/1280px-2023_07_31_arne_mueseler_00023-Verbessert-RR_%2853105680992%29.jpg', // Everton - Goodison Park
  '341': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Leeds_United_-_31559864360.jpg/1280px-Leeds_United_-_31559864360.jpg', // Leeds - Elland Road
  '64': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Panorama_of_Anfield_with_new_main_stand_%2829676137824%29.jpg/1280px-Panorama_of_Anfield_with_new_main_stand_%2829676137824%29.jpg', // Liverpool - Anfield
  '65': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/City_of_Manchester_Stadium_2023_cropped.jpg/1280px-City_of_Manchester_Stadium_2023_cropped.jpg', // Man City - Etihad
  '66': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/2023_07_31_arne_mueseler_00060-Verbessert-RR_%2853106651455%29.jpg/1280px-2023_07_31_arne_mueseler_00060-Verbessert-RR_%2853106651455%29.jpg', // Man Utd - Old Trafford
  '67': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Newcastle_st-james-park_stadium.jpg/1280px-Newcastle_st-james-park_stadium.jpg', // Newcastle - St James' Park
  '351': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/CityGroundFromAboveTrentBridgeCricketGround.jpg/1280px-CityGroundFromAboveTrentBridgeCricketGround.jpg', // Nottingham Forest - City Ground
  '71': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Sunderland_stadium_of_light.jpg/1280px-Sunderland_stadium_of_light.jpg', // Sunderland - Stadium of Light
  '73': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/London_Tottenham_Hotspur_Stadium.jpg/1280px-London_Tottenham_Hotspur_Stadium.jpg', // Tottenham
  '563': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/London_Olympic_Stadium_West_Ham.jpg/1280px-London_Olympic_Stadium_West_Ham.jpg', // West Ham - London Stadium
  '76': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/MolineuxStadium2022.jpg/1280px-MolineuxStadium2022.jpg', // Wolves - Molineux
  '328': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Turf_Moor_-_Harry_Potts_Way_%28east%29.jpg/1280px-Turf_Moor_-_Harry_Potts_Way_%28east%29.jpg', // Burnley - Turf Moor

  // La Liga
  '78': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Atleti_vs_Villarreal_-_September_2025.jpg/1280px-Atleti_vs_Villarreal_-_September_2025.jpg', // Atletico Madrid - Metropolitano
  '81': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Camp_Nou_aerial.jpg/1280px-Camp_Nou_aerial.jpg', // Barcelona - Camp Nou
  '86': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Estadio_Santiago_Bernab%C3%A9u_%282014%29.JPG/1280px-Estadio_Santiago_Bernab%C3%A9u_%282014%29.JPG', // Real Madrid - Bernabéu
  '95': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/CAMP_DE_MESTALLA_GRADA_DE_LA_MAR_2014.JPG/1280px-CAMP_DE_MESTALLA_GRADA_DE_LA_MAR_2014.JPG', // Valencia - Mestalla

  // Bundesliga
  '5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Allianz_Arena_2008-02-09.jpg/1280px-Allianz_Arena_2008-02-09.jpg', // Bayern Munich - Allianz Arena
  '3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bayarena_Leverkusen_2020.jpg/1280px-Bayarena_Leverkusen_2020.jpg', // Bayer Leverkusen - BayArena
  '4': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Signal_iduna_park_stadium_dortmund_4.jpg/1280px-Signal_iduna_park_stadium_dortmund_4.jpg', // Borussia Dortmund - Signal Iduna
  '721': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Leipzig_stadium.jpg/1280px-Leipzig_stadium.jpg', // RB Leipzig
  '19': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Deutsche_bank_park.jpg/1280px-Deutsche_bank_park.jpg', // Eintracht Frankfurt
  '10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Stuttgart_stadium.jpg/1280px-Stuttgart_stadium.jpg', // VfB Stuttgart - MHP Arena

  // Serie A
  '108': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Stadio_Meazza_2021_3.jpg/1280px-Stadio_Meazza_2021_3.jpg', // Inter Milan - San Siro
  '98': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Stadio_Meazza_2021_3.jpg/1280px-Stadio_Meazza_2021_3.jpg', // AC Milan - San Siro (shared)
  '109': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Allianz_Stadium_dal_Colle_della_Maddalena.jpg/1280px-Allianz_Stadium_dal_Colle_della_Maddalena.jpg', // Juventus - Allianz Stadium
  '113': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Stadio_Maradona_Serie_A.jpg/1280px-Stadio_Maradona_Serie_A.jpg', // Napoli - Maradona
  '100': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Stadio_Olimpico_2024.jpg/1280px-Stadio_Olimpico_2024.jpg', // Roma - Olimpico
  '110': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Stadio_Olimpico_2024.jpg/1280px-Stadio_Olimpico_2024.jpg', // Lazio - Olimpico (shared)

  // Ligue 1
  '524': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Paris_Le_Parc_des_Princes.jpg/1280px-Paris_Le_Parc_des_Princes.jpg', // PSG - Parc des Princes
  '523': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Groupama_Stadium%2C_Lyon%2C_sans_la_pelouse_%28juin_2024%29.jpg/1280px-Groupama_Stadium%2C_Lyon%2C_sans_la_pelouse_%28juin_2024%29.jpg', // Lyon - Groupama
};

/**
 * Get the stadium image URL for a team, or null if not mapped.
 * Uses the home team's ID since home team plays at their venue.
 */
export function getStadiumImageUrl(teamId: number): string | null {
  return STADIUM_IMAGES[String(teamId)] || null;
}
