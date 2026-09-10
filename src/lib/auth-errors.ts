/**
 * Sign-in error codes shared between the server (lib/auth.ts) and the
 * login page.
 *
 * Its own module because lib/auth.ts pulls in Prisma, bcrypt and the
 * NextAuth server config — importing the constant from there would drag
 * all of that into the client bundle.
 */

/**
 * The password was correct but the account's email address has not been
 * verified. Reaches the browser as `?error=CredentialsSignin&code=…`
 * (@auth/core copies a CredentialsSignin subclass's `code` into the
 * redirect), so the login page can offer to resend the link instead of
 * showing "wrong email or password".
 */
export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";
