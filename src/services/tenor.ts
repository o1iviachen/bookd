function getBaseUrl() {
  const key = process.env.EXPO_PUBLIC_KLIPY_API_KEY || '';
  return `https://api.klipy.com/api/v1/${key}`;
}

export interface TenorGif {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

function mapGif(item: any): TenorGif {
  const hd = item.file?.hd;
  const sm = item.file?.sm || item.file?.md || hd;
  const gif = hd?.gif || hd?.mp4;
  const preview = sm?.gif || sm?.mp4 || gif;
  return {
    id: String(item.id),
    url: gif?.url || '',
    previewUrl: preview?.url || '',
    width: preview?.width || gif?.width || 200,
    height: preview?.height || gif?.height || 200,
  };
}

export async function searchGifs(query: string, limit = 30, page?: string): Promise<{ gifs: TenorGif[]; next: string }> {
  const params = new URLSearchParams({
    q: query,
    per_page: String(limit),
    content_filter: 'medium',
    customer_id: 'bookd_user',
  });
  if (page) params.set('page', page);

  const url = `${getBaseUrl()}/gifs/search?${params}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.result) {
    console.error('[Klipy] search error:', json);
  }
  const data = json.data || {};
  return {
    gifs: (data.data || []).map(mapGif),
    next: data.has_next ? String((data.current_page || 1) + 1) : '',
  };
}

export async function featuredGifs(limit = 30, page?: string): Promise<{ gifs: TenorGif[]; next: string }> {
  const params = new URLSearchParams({
    per_page: String(limit),
    customer_id: 'bookd_user',
  });
  if (page) params.set('page', page);

  const url = `${getBaseUrl()}/gifs/trending?${params}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.result) {
    console.error('[Klipy] trending error:', json);
  }
  const data = json.data || {};
  return {
    gifs: (data.data || []).map(mapGif),
    next: data.has_next ? String((data.current_page || 1) + 1) : '',
  };
}
