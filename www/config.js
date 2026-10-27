/* Runtime API config for the Capacitor / native app.
 *
 * Leave API_BASE_URL empty for same-origin hosting (Node server serves www/).
 * Production / App Store / Play Store builds MUST set this to the hosted HTTPS API URL
 * (Railway, Render, Fly.io, etc.). Never put secrets or localhost in a store build.
 *
 * Example for a production build:
 *   API_BASE_URL: 'https://your-hosted-api.example.com'
 *
 * Optional override without rebuilding:
 *   localStorage.setItem('SISR_API_BASE_URL', 'https://...')
 */
window.SISR_CONFIG = {
  API_BASE_URL:
    (typeof localStorage !== 'undefined' && localStorage.getItem('SISR_API_BASE_URL')) ||
    ''
};
