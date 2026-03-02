"use strict";

module.exports = {
  query(sql, params = []) {
    return Promise.resolve({
      ok: false,
      message: "DB disabled in SNAPSHOT mode",
      sql,
      params,
    });
  },
};
