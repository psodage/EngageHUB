import { Router } from "express";
import {
  createScheduledPost,
  deleteScheduledPost,
  listScheduledPosts,
} from "../controllers/schedule.controller.js";

export function createScheduleRoutes(requireAuth) {
  const router = Router();
  router.get("/", requireAuth, listScheduledPosts);
  router.post("/", requireAuth, createScheduledPost);
  router.delete("/:id", requireAuth, deleteScheduledPost);
  return router;
}
