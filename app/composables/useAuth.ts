// T039: auth composable — magic-link only, sign-out, session getter.

export const useAuth = () => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()

  const signInWithMagicLink = async (email: string, redirectTo?: string) => {
    const origin = useRequestURL().origin
    return client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}${redirectTo ?? '/callback'}`,
      },
    })
  }

  const signOut = async () => client.auth.signOut()

  return {
    user,
    signInWithMagicLink,
    signOut,
  }
}
