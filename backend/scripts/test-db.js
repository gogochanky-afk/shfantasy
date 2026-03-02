"use strict";

const db = require("../lib/db");

(async function () {
  console.log("Testing DB query...");
  const result = await db.query("SELECT * FROM test_table");
  console.log(result);
})();
