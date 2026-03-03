const NATIONALITY_FLAGS: Record<string, string> = {
  // Europe
  Albania: '🇦🇱', Andorra: '🇦🇩', Armenia: '🇦🇲', Austria: '🇦🇹', Azerbaijan: '🇦🇿',
  Belarus: '🇧🇾', Belgium: '🇧🇪', 'Bosnia and Herzegovina': '🇧🇦', Bulgaria: '🇧🇬',
  Croatia: '🇭🇷', Cyprus: '🇨🇾', 'Czech Republic': '🇨🇿', Czechia: '🇨🇿',
  Denmark: '🇩🇰', England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Estonia: '🇪🇪', Finland: '🇫🇮',
  France: '🇫🇷', Georgia: '🇬🇪', Germany: '🇩🇪', Greece: '🇬🇷',
  Hungary: '🇭🇺', Iceland: '🇮🇸', Ireland: '🇮🇪', Italy: '🇮🇹',
  Kosovo: '🇽🇰', Latvia: '🇱🇻', Liechtenstein: '🇱🇮', Lithuania: '🇱🇹',
  Luxembourg: '🇱🇺', Malta: '🇲🇹', Moldova: '🇲🇩', Monaco: '🇲🇨',
  Montenegro: '🇲🇪', Netherlands: '🇳🇱', 'North Macedonia': '🇲🇰',
  Norway: '🇳🇴', Poland: '🇵🇱', Portugal: '🇵🇹', Romania: '🇷🇴',
  Russia: '🇷🇺', 'San Marino': '🇸🇲', Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', Serbia: '🇷🇸',
  Slovakia: '🇸🇰', Slovenia: '🇸🇮', Spain: '🇪🇸', Sweden: '🇸🇪',
  Switzerland: '🇨🇭', Turkey: '🇹🇷', Ukraine: '🇺🇦',
  'United Kingdom': '🇬🇧', Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',

  // Americas
  Argentina: '🇦🇷', Bolivia: '🇧🇴', Brazil: '🇧🇷', Canada: '🇨🇦', Chile: '🇨🇱',
  Colombia: '🇨🇴', 'Costa Rica': '🇨🇷', Cuba: '🇨🇺', Ecuador: '🇪🇨',
  'El Salvador': '🇸🇻', Guatemala: '🇬🇹', Haiti: '🇭🇹', Honduras: '🇭🇳',
  Jamaica: '🇯🇲', Mexico: '🇲🇽', Nicaragua: '🇳🇮', Panama: '🇵🇦',
  Paraguay: '🇵🇾', Peru: '🇵🇪', 'Trinidad and Tobago': '🇹🇹',
  'United States': '🇺🇸', USA: '🇺🇸', Uruguay: '🇺🇾', Venezuela: '🇻🇪',

  // Africa
  Algeria: '🇩🇿', Angola: '🇦🇴', Cameroon: '🇨🇲', 'Cape Verde': '🇨🇻',
  'Ivory Coast': '🇨🇮', "Côte d'Ivoire": '🇨🇮', 'DR Congo': '🇨🇩', Congo: '🇨🇬',
  Egypt: '🇪🇬', Ethiopia: '🇪🇹', Gabon: '🇬🇦', Ghana: '🇬🇭',
  Guinea: '🇬🇳', 'Guinea-Bissau': '🇬🇼', Kenya: '🇰🇪', Libya: '🇱🇾',
  Mali: '🇲🇱', Morocco: '🇲🇦', Mozambique: '🇲🇿', Namibia: '🇳🇦',
  Nigeria: '🇳🇬', Senegal: '🇸🇳', 'Sierra Leone': '🇸🇱',
  Somalia: '🇸🇴', 'South Africa': '🇿🇦', Sudan: '🇸🇩', Tanzania: '🇹🇿',
  Togo: '🇹🇬', Tunisia: '🇹🇳', Uganda: '🇺🇬', Zambia: '🇿🇲', Zimbabwe: '🇿🇼',

  // Asia & Oceania
  Australia: '🇦🇺', Bahrain: '🇧🇭', China: '🇨🇳', 'Hong Kong': '🇭🇰',
  India: '🇮🇳', Indonesia: '🇮🇩', Iran: '🇮🇷', Iraq: '🇮🇶',
  Israel: '🇮🇱', Japan: '🇯🇵', Jordan: '🇯🇴', 'South Korea': '🇰🇷',
  Korea: '🇰🇷', Kuwait: '🇰🇼', Lebanon: '🇱🇧', Malaysia: '🇲🇾',
  'New Zealand': '🇳🇿', Pakistan: '🇵🇰', Philippines: '🇵🇭', Qatar: '🇶🇦',
  'Saudi Arabia': '🇸🇦', Singapore: '🇸🇬', Syria: '🇸🇾', Thailand: '🇹🇭',
  'United Arab Emirates': '🇦🇪', Uzbekistan: '🇺🇿', Vietnam: '🇻🇳',
};

export function nationalityFlag(nationality: string | null | undefined): string {
  if (!nationality) return '';
  return NATIONALITY_FLAGS[nationality] ?? '';
}
