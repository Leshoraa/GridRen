export const configuration = {
  port: parseInt(process.env.PORT || "3000", 10),
  environment: process.env.NODE_ENV || "development",
  apiPrefix: "/api/v1",
  jwtSecret: process.env.JWT_SECRET || "default_security_secret_key_change_me"
};
