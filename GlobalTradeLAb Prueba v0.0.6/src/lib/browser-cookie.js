export const readCookie = (name) => {
  if (typeof document === "undefined") {
    return "";
  }

  const cookiePrefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(cookiePrefix));

  return match ? decodeURIComponent(match.slice(cookiePrefix.length)) : "";
};

