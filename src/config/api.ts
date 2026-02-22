import axios from 'axios';

// Football-data.org free tier: 10 requests/minute
// Sign up at https://www.football-data.org/ and paste your token below
const FOOTBALL_API_KEY = '60f29fe942f8450aa17a04d6544509f8';

export const footballApi = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  timeout: 10000,
  headers: {
    'X-Auth-Token': FOOTBALL_API_KEY,
  },
});
