import { getMetricsSnapshot } from './metrics-store.js'

export default async () => {
  try {
    const snapshot = await getMetricsSnapshot()

    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch {
    return new Response(
      JSON.stringify({
        site_views: 0,
        unique_site_visitors: 0,
        share_links_generated: 0,
        share_links_generated_challenge: 0,
        share_links_generated_gallery: 0,
        share_links_generated_ost: 0,
        share_links_visited: 0,
        share_links_visited_challenge: 0,
        share_links_visited_gallery: 0,
        share_links_visited_ost: 0,
        share_redirect_hits: 0,
        games_played: 0,
        games_played_standard: 0,
        games_played_ost: 0,
        updated_at: null,
      }),
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    )
  }
}
