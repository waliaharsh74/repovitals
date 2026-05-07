export function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return "";
}

export function getAuthSecret() {
  const configuredSecret = envValue("NEXTAUTH_SECRET", "AUTH_SECRET");

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "repovitals-local-development-secret";
  }

  return undefined;
}
