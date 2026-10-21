export function friendlyAuthError(error: { status?: number; code?: string; message?: string }): string {
  if (error.code === 'email_not_confirmed') return 'Email eka verify karala aye sign in wenna.';
  if (error.code === 'invalid_credentials') return 'Email address eka ho password eka hari naha. Nawatha check karanna.';
  if (error.code === 'weak_password') return 'Password eka thawath strong karanna. Characters 8k ho eeta wada use karanna.';
  if (error.status === 400) return 'Details tika check karala nawatha try karanna. Account ekak thiyenawanam sign in ho password reset karanna.';
  if (error.status === 429) return 'Requests godak ikmanata yawwa. Tikak inna, passe nawatha try karanna.';
  if (!error.status || /fetch|network|timeout/i.test(error.message ?? '')) return 'Internet connection eka check karala nawatha try karanna.';
  return 'Danata request eka complete karanna bari una. Tikak passe nawatha try karanna.';
}
