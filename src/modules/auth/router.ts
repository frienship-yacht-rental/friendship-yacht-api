import express from "express";
import type { Router } from "express";

const router: Router = express.Router();

router.post("/sign-up");
router.post("/sign-in");
router.post("/sign-out");
