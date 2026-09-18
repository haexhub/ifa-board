const VEO_API_BASE = 'https://app.veo.co/api/app'

export type VeoMatchListItem = {
  identifier: string
  start: string
  title: string
  opponent_team_name: string
  has_analytics_enabled: boolean
  own_team_home_or_away: 'home' | 'away'
  team__id: string
  info: { stats: { score_aggregated: { own: number | null; opponent: number | null } } }
}

const veoFetch = async <T>(accessToken: string, path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${VEO_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`Veo API request failed: ${init?.method ?? 'GET'} ${path} -> ${res.status}`)
  }
  return (await res.json()) as T
}

const MATCH_LIST_FIELDS = [
  'identifier',
  'start',
  'title',
  'opponent_team_name',
  'has_analytics_enabled',
  'own_team_home_or_away',
  'team__id',
  'info',
]

/** GET .../api/app/matches/ for one Veo club/team, newest first. */
export const listMatches = async (
  accessToken: string,
  params: { veoClubSlug: string; veoTeamSlug: string },
): Promise<VeoMatchListItem[]> => {
  const query = new URLSearchParams({
    team: params.veoTeamSlug,
    club: params.veoClubSlug,
    ordering: '-created',
    page_size: '50',
    analytics_version: '2',
  })
  for (const field of MATCH_LIST_FIELDS) query.append('fields', field)
  return veoFetch<VeoMatchListItem[]>(accessToken, `/matches/?${query.toString()}`)
}

/** POST .../api/app/analysis/stats/ for a batch of matches of one Veo team. */
export const fetchAnalysisStats = async (
  accessToken: string,
  params: { veoTeamId: string; veoMatchIds: string[] },
): Promise<unknown> =>
  veoFetch(accessToken, '/analysis/stats/', {
    method: 'POST',
    body: JSON.stringify({
      type: 'team_match',
      team_id: params.veoTeamId,
      match_ids: params.veoMatchIds,
      group_by: 'team_association',
    }),
  })
