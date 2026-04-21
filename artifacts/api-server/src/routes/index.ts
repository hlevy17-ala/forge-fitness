import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import appleAuthRouter from "./apple-auth";
import workoutsRouter from "./workouts";
import settingsRouter from "./settings";
import biometricsRouter from "./biometrics";
import nutritionRouter from "./nutrition";
import { authMiddleware } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(appleAuthRouter);

router.use(authMiddleware);
router.use(workoutsRouter);
router.use(settingsRouter);
router.use(biometricsRouter);
router.use(nutritionRouter);

export default router;
