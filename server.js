// server.js - Starts the backend server

const app = require("./app");

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`SH Fantasy Backend running on port ${PORT}`);
});
