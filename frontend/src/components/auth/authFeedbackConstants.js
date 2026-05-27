/** How long the auth alert stays visible before redirect (or dismiss). */
export const AUTH_FEEDBACK_REDIRECT_MS = 7000;

export const AUTH_MESSAGES = {
  loginSuccess: "Welcome back! You're signed in.",
  loginError: "Invalid email or password.",
  loginValidation: "Enter a valid email and password (min. 8 characters).",
  signupSuccess: "Account created! Taking you to sign in…",
  signupError: "Could not create your account. Please try again.",
  signupValidation: "Enter your name, a valid email, and password (min. 8 characters).",
  googleSuccess: "Signed in with Google successfully!",
  googleError: "Google sign-in was not completed.",
  googleMissingCode: "Sign-in session expired. Please try again.",
};
