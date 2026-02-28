"use strict";
// routes/players.js — Snapshot Playtest Mode
const express = require("express");
const router  = express.Router();

const PLAYERS = {
  "pool-lal-gsw-today": [
    { id:"lal-1", name:"LeBron James",      team:"LAL", position:"SF", cost:3 },
    { id:"lal-2", name:"Anthony Davis",     team:"LAL", position:"C",  cost:3 },
    { id:"lal-3", name:"Austin Reaves",     team:"LAL", position:"SG", cost:2 },
    { id:"lal-4", name:"D'Angelo Russell",  team:"LAL", position:"PG", cost:2 },
    { id:"lal-5", name:"Rui Hachimura",     team:"LAL", position:"PF", cost:1 },
    { id:"lal-6", name:"Jarred Vanderbilt", team:"LAL", position:"PF", cost:1 },
    { id:"lal-7", name:"Cam Ham",           team:"LAL", position:"SG", cost:1 },
    { id:"gsw-1", name:"Stephen Curry",     team:"GSW", position:"PG", cost:3 },
    { id:"gsw-2", name:"Draymond Green",    team:"GSW", position:"PF", cost:2 },
    { id:"gsw-3", name:"Klay Thompson",     team:"GSW", position:"SG", cost:2 },
    { id:"gsw-4", name:"Andrew Wiggins",    team:"GSW", position:"SF", cost:2 },
    { id:"gsw-5", name:"Jonathan Kuminga",  team:"GSW", position:"SF", cost:1 },
    { id:"gsw-6", name:"Moses Moody",       team:"GSW", position:"SG", cost:1 },
    { id:"gsw-7", name:"Kevon Looney",      team:"GSW", position:"C",  cost:1 },
  ],
  "pool-bos-mia-tmrw": [
    { id:"bos-1", name:"Jayson Tatum",       team:"BOS", position:"SF", cost:3 },
    { id:"bos-2", name:"Jaylen Brown",       team:"BOS", position:"SG", cost:3 },
    { id:"bos-3", name:"Kristaps Porzingis", team:"BOS", position:"C",  cost:2 },
    { id:"bos-4", name:"Jrue Holiday",       team:"BOS", position:"PG", cost:2 },
    { id:"bos-5", name:"Al Horford",         team:"BOS", position:"C",  cost:1 },
    { id:"bos-6", name:"Derrick White",      team:"BOS", position:"SG", cost:1 },
    { id:"bos-7", name:"Payton Pritchard",   team:"BOS", position:"PG", cost:1 },
    { id:"mia-1", name:"Jimmy Butler",       team:"MIA", position:"SF", cost:3 },
    { id:"mia-2", name:"Bam Adebayo",        team:"MIA", position:"C",  cost:3 },
    { id:"mia-3", name:"Tyler Herro",        team:"MIA", position:"SG", cost:2 },
    { id:"mia-4", name:"Kyle Lowry",         team:"MIA", position:"PG", cost:1 },
    { id:"mia-5", name:"Caleb Martin",       team:"MIA", position:"SF", cost:1 },
    { id:"mia-6", name:"Duncan Robinson",    team:"MIA", position:"SG", cost:1 },
    { id:"mia-7", name:"Haywood Highsmith",  team:"MIA", position:"PF", cost:1 },
  ],
};

const FALLBACK = [
  { id:"fb-1",  name:"LeBron James",   team:"LAL", position:"SF", cost:3 },
  { id:"fb-2",  name:"Stephen Curry",  team:"GSW", position:"PG", cost:3 },
  { id:"fb-3",  name:"Jayson Tatum",   team:"BOS", position:"SF", cost:3 },
  { id:"fb-4",  name:"Jimmy Butler",   team:"MIA", position:"SF", cost:3 },
  { id:"fb-5",  name:"Anthony Davis",  team:"LAL", position:"C",  cost:2 },
  { id:"fb-6",  name:"Draymond Green", team:"GSW", position:"PF", cost:2 },
  { id:"fb-7",  name:"Jaylen Brown",   team:"BOS", position:"SG", cost:2 },
  { id:"fb-8",  name:"Bam Adebayo",    team:"MIA", position:"C",  cost:2 },
  { id:"fb-9",  name:"Austin Reaves",  team:"LAL", position:"SG", cost:1 },
  { id:"fb-10", name:"Klay Thompson",  team:"GSW", position:"SG", cost:1 },
  { id:"fb-11", name:"Jrue Holiday",   team:"BOS", position:"PG", cost:1 },
  { id:"fb-12", name:"Tyler Herro",    team:"MIA", position:"SG", cost:1 },
];

router.get("/", function (req, res) {
  var poolId  = String(req.query.poolId || "").trim();
  var players = PLAYERS[poolId] || FALLBACK;
  res.json({ ok:true, dataMode:"SNAPSHOT", updatedAt:new Date().toISOString(), poolId:poolId||"fallback", players:players });
});

module.exports = router;
