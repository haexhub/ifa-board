// T033: global auth guard.
// Allow: /login, /callback, /public/**, /invite/**.
// Everything else requires a Supabase session; unauthenticated → /login.

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  const path = to.path

  const isPublic =
    path === '/login' ||
    path === '/callback' ||
    path.startsWith('/public/') ||
    path.startsWith('/invite/')

  if (isPublic) return

  if (!user.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: path },
    })
  }
})
