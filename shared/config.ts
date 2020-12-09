const DEV_PROJECT_ID = "codeapprove-dev";
const PROD_PROJECT_ID = "codeapprove-prod";

export function isProd() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.GCLOUD_PROJECT === PROD_PROJECT_ID
  );
}

export function baseUrl() {
  if (isProd()) {
    return "https://codeapprove.com";
  } else {
    return "http://localhost:8080";
  }
}
