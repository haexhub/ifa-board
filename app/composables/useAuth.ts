// T039: auth composable — magic-link only, sign-out, session getter.

export const POST_LOGIN_REDIRECT_KEY = 'ifa:postLoginRedirect'

export const useAuth = () => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()

  // The Supabase magic link MUST always land on /callback so our page can
  // finish the PKCE code exchange. The post-login destination is stashed
  // in localStorage and consumed by /callback — never passed to gotrue as
  // emailRedirectTo (gotrue strips paths and only whitelisted absolute
  // URLs are honored, so a bare "/" would defeat the callback entirely).
  const signInWithMagicLink = async (email: string, redirectTo?: string) => {
    const origin = useRequestURL().origin
    const result = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/callback`,
      },
    })

    if (import.meta.client) {
      if (!result.error && redirectTo && redirectTo !== '/') {
        localStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectTo)
      } else {
        localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
      }
    }
    return result
  }

  const signOut = async () => client.auth.signOut()

  return {
    user,
    signInWithMagicLink,
    signOut,
  }
}
