import axios from 'axios';

// Football-data.org free tier: 10 requests/minute
// Sign up at https://www.football-data.org/ and paste your token below
const FOOTBALL_API_KEY = '60f29fe942f8450aa17a04d6544509f8';

export const footballApi = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  timeout: 15000,
  headers: {
    'X-Auth-Token': FOOTBALL_API_KEY,
  },
});

// Retry on 429 rate limit — wait and try once more
footballApi.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  if (error.response?.status === 429 && !config._retried) {
    config._retried = true;
    await new Promise((r) => setTimeout(r, 6000));
    return footballApi(config);
  }
  return Promise.reject(error);
});
