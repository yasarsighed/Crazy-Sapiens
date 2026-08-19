// Supabase/PostgREST caps a single response at ~1000 rows by default (this
// project's live DB confirmed at 1000 — see iat_trial_log, which already
// holds 14,400+ rows and was being silently truncated on every per-instrument
// analytics fetch). Any query whose result grows with participant count or
// response count (trial logs, scored results, enrollments) must page through
// with .range() instead of a single unbounded .select(), or results are
// silently incomplete with no error — the query just succeeds with a subset.
//
// Usage:
//   const { data } = await fetchAllRows((from, to) =>
//     supabase.from('iat_trial_log').select('...').eq('iat_id', id).range(from, to)
//   )
export async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  batchSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = []
  let from = 0
  // Hard ceiling so a runaway query can't loop forever / OOM the server —
  // 500 batches * 1000 rows = 500,000 rows, far beyond any realistic single
  // study's data volume for this app.
  const MAX_BATCHES = 500

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await queryFactory(from, from + batchSize - 1)
    if (error) return { data: all, error }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < batchSize) break
    from += batchSize
  }
  return { data: all, error: null }
}
