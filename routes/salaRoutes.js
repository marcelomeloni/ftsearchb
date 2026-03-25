const express = require("express");
const router = express.Router();
const { getSalas } = require("../controllers/salaController");

router.get("/", getSalas);

module.exports = router;
