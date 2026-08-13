import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { upload } from "../../middlewares/upload.middleware";
import * as LmsController from "./lms.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Course Management
router.get("/courses", LmsController.getAllCourses);
router.post("/courses", upload, LmsController.createCourse);
router.get("/courses/:id", LmsController.getCourseById);
router.put("/courses/:id", upload, LmsController.updateCourse);
router.delete("/courses/:id", LmsController.deleteCourse);
router.post("/courses/:id/duplicate", LmsController.duplicateCourse);
router.post("/courses/:id/archive", LmsController.archiveCourse);


// Module & Content Management
router.post("/courses/:courseId/modules", LmsController.addModule);
router.patch("/modules/:moduleId", LmsController.updateModule);
router.post("/modules/:moduleId/content", upload, LmsController.addContent);
router.patch("/content/:id", upload, LmsController.updateContent);

// Learner Operations
router.get("/dashboard", LmsController.getLearnerDashboard);
router.post("/progress", LmsController.trackProgress);

// Analytics
router.get("/admin/stats", LmsController.getAdminStats);
router.get("/manager/stats", LmsController.getManagerStats);

// Quizzes
router.post("/courses/:courseId/quizzes", LmsController.createQuiz);
router.post("/quizzes/:quizId/questions", LmsController.addQuestion);
router.post("/quizzes/:quizId/submit", LmsController.submitQuiz);

// Certificates
router.get("/certificates", LmsController.getCertificates);

// Learning Paths
router.get("/learning-paths", LmsController.getAllLearningPaths);
router.post("/learning-paths", LmsController.createLearningPath);
router.get("/learning-paths/:id", LmsController.getLearningPathById);
router.put("/learning-paths/:id", LmsController.updateLearningPath);
router.delete("/learning-paths/:id", LmsController.deleteLearningPath);

export default router;
