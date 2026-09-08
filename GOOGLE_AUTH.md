# Google sign-in

The API implements the OpenID Connect authorization-code flow with PKCE, state,
nonce and a ten-minute Redis transaction bound to an HttpOnly browser cookie.
Only `openid email profile` scopes are requested. Google tokens are validated
using `google-auth-library`, never persisted, returned to JavaScript or placed
in application URLs. The resulting session uses the existing HttpOnly cookies.

## Configure

Create a **Web application** OAuth client in Google Cloud / Google Auth Platform.
Configure the consent screen with the Ninho name, support email, authorized domain,
and the public privacy policy and terms. While the consent screen is in testing,
add the accounts that will exercise the flow as test users.

Register these exact authorized redirect URIs for the environments you use:

- Local Docker: `http://localhost:3005/auth/google/callback`
- Production: `https://cygnus.samuelsantana.dev/api/auth/google/callback`

The production callback goes through the frontend proxy so the transaction and
session cookies belong to the application origin. Do not register the direct
Render hostname as the production callback. Redirects after verification always
go to `/auth/google/complete` under `CORS_ORIGIN`; no caller-supplied return URL
is accepted. This server flow does not require a Google browser SDK, JavaScript
origin registration, a frontend client secret, or additional CSP script origins.

Set all three variables on the API, in `.env` locally or Render's environment
settings in production:

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | The web OAuth client's ID |
| `GOOGLE_CLIENT_SECRET` | The web OAuth client's secret |
| `GOOGLE_REDIRECT_URI` | One exact URI registered above |

Keep the secret out of source control, logs and all `VITE_*` variables. The
frontend reads availability from `GET /auth/google/status`; no credentials need
to be compiled into it. Leaving all three unset disables Google sign-in without
affecting password or emailed-code authentication. Partial configuration fails
startup. Local Docker loads the API `.env`; rebuild/recreate the API after setting
these values. Keep `CORS_ORIGIN=http://localhost:4205` and local secure-cookie
override as already configured by Compose.

Run `npm run prisma:migrate:deploy` before starting the new API against an existing
database. The container startup already does this. The additive migration creates
`google_identities`; deleting a user cascades to its Google identity.

## Account association

Subsequent sign-ins resolve the immutable Google `sub`, even if the Google email
changes. A first sign-in creates a user with the Google name and an unusable random
password, or associates an existing account only when Google is authoritative for
the email (`@gmail.com`, or a verified Workspace `hd` claim). Existing passwords,
profile photos and session versions are preserved. A user can have one Google
identity; an already-linked account cannot be reassigned to another subject.

For an existing account with a third-party mailbox that Google does not manage,
the user is directed to the existing password/email-code sign-in. The Google
`email_verified` claim alone does not prove ongoing ownership of that mailbox.
There is no explicit link/unlink settings flow in this implementation.

## Verification

Integration tests mock Google's token exchange and verification while exercising
real HTTP routes, Redis, PostgreSQL, cookies and account association. They do not
substitute for a real consent-screen test with configured OAuth credentials.
After configuration, test new-account sign-up, an existing account, cancellation,
page reload, logout, and the same-origin production callback. Application logs
omit callback query strings and OAuth library error payloads.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Google Auth Library](https://github.com/googleapis/google-cloud-node-core/tree/main/packages/google-auth-library).
