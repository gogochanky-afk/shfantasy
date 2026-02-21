function required(key) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
  return process.env[key];
}

module.exports = {
  PORT: process.env.PORT || 8080,
  DATA_MODE: process.env.DATA_MODE || "LIVE",
  ADMIN_TOKEN: required("ADMIN_TOKEN"),
  BUCKET_NAME: required("BUCKET_NAME"),
  SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY || "",
  SPORTRADAR_BASE: process.env.SPORTRADAR_BASE || ""
};
