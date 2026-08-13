import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { LmsService } from "./lms.service";

const lmsService = new LmsService();

export const getAllCourses = async (req: AuthRequest, res: Response) => {
  const organizationId = req.user?.orgId || 1;
  try {
    const courses = await lmsService.getAllCourses(organizationId, req.query);
    res.json({ success: true, data: courses });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createCourse = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const thumbnail = files?.thumbnail?.[0];
    const organizationId = req.user?.orgId;
    const instructorId = req.user?.id;

    if (!organizationId) {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const { title, description, status, curriculum_type } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Course title is required" });
    }

    const courseData: any = {
      title,
      description: description || "",
      status: status || 'DRAFT',
      curriculum_type: curriculum_type || 'VIDEO',
      organization_id: organizationId,
      instructor_id: instructorId,
    };

    if (thumbnail) {
      courseData.thumbnail_url = `/upload/${thumbnail.filename}`;
    }

    const course = await lmsService.createCourse(courseData);
    res.status(201).json({ success: true, data: course });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getCourseById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  try {
    const course = await lmsService.getCourseDetails(parseInt(id as string), userId);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json({ success: true, data: course });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const thumbnail = files?.thumbnail?.[0];

    const { title, description, status, thumbnail_url, curriculum_type } = req.body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (curriculum_type !== undefined) updateData.curriculum_type = curriculum_type;
    if (thumbnail_url === null || thumbnail_url === 'null') updateData.thumbnail_url = null;

    if (thumbnail) {
      updateData.thumbnail_url = `/upload/${thumbnail.filename}`;
    }

    const course = await lmsService.updateCourse(Number(id), updateData);
    res.json({ success: true, data: course });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await lmsService.deleteCourse(Number(id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const duplicateCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const course = await lmsService.duplicateCourse(Number(id));
    res.status(201).json({ success: true, data: course });
  } catch (error) {
    console.error("Error duplicating course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const archiveCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const course = await lmsService.archiveCourse(Number(id));
    res.json({ success: true, data: course });
  } catch (error) {
    console.error("Error archiving course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addModule = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.params;
  const { title, description, order } = req.body;
  try {
    const module = await lmsService.addModule(
      parseInt(courseId as string), 
      title, 
      order !== undefined ? parseInt(order as string) : 0,
      description
    );
    res.status(201).json({ success: true, data: module });
  } catch (error) {
    console.error("Error adding module:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addContent = async (req: AuthRequest, res: Response) => {
  const { moduleId } = req.params;
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const contentFile = files?.content_file?.[0];

    const { title, content_type, content_body, order, meeting_config } = req.body;
    const contentData: any = { 
      title, 
      content_type, 
      content_body, 
      order: order !== undefined ? parseInt(order as string) : 0,
      meeting_config: meeting_config ? (typeof meeting_config === 'string' ? JSON.parse(meeting_config) : meeting_config) : null
    };
    
    // If it's a file type (VIDEO/PDF), store the path
    if (contentFile) {
      contentData.content_url = `/upload/${contentFile.filename}`;
    }

    const content = await lmsService.addContent(parseInt(moduleId as string), contentData);
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    console.error("Error adding content:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const trackProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { contentId, moduleId, completed, timeSpent } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const progress = await lmsService.trackProgress(userId, contentId, moduleId, completed, timeSpent);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error("Error tracking progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getLearnerDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const dashboard = await lmsService.getLearnerDashboard(userId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("Error fetching learner dashboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateModule = async (req: AuthRequest, res: Response) => {
  const { moduleId } = req.params;
  const { title, description, order } = req.body;
  try {
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = parseInt(order as string);

    const module = await lmsService.updateModule(Number(moduleId), updateData);
    res.json({ success: true, data: module });
  } catch (error) {
    console.error("Error updating module:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const updateContent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const contentFile = files?.content_file?.[0];

    const { title, content_type, content_body, order, meeting_config } = req.body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content_type !== undefined) updateData.content_type = content_type;
    if (content_body !== undefined) updateData.content_body = content_body;
    if (order !== undefined) updateData.order = parseInt(order as string);
    if (meeting_config !== undefined) {
      updateData.meeting_config = meeting_config ? (typeof meeting_config === 'string' ? JSON.parse(meeting_config) : meeting_config) : null;
    }

    if (contentFile) {
      updateData.content_url = `/upload/${contentFile.filename}`;
    }

    const content = await lmsService.updateContent(Number(id), updateData);
    res.json({ success: true, data: content });
  } catch (error) {
    console.error("Error updating content:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  const organizationId = req.user?.orgId || 1;
  try {
    const stats = await lmsService.getAdminStats(organizationId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getManagerStats = async (req: AuthRequest, res: Response) => {
  const organizationId = req.user?.orgId || 1;
  const managerId = req.user?.id;
  if (!managerId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const stats = await lmsService.getManagerStats(managerId, organizationId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching manager stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Quiz Handlers
export const createQuiz = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.params;
  try {
    const quiz = await lmsService.createQuiz(Number(courseId), req.body);
    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    console.error("Error creating quiz:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addQuestion = async (req: AuthRequest, res: Response) => {
  const { quizId } = req.params;
  try {
    const question = await lmsService.addQuestion(Number(quizId), req.body);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const submitQuiz = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { quizId } = req.params;
  const { answers } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await lmsService.submitQuiz(userId, Number(quizId), answers);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getCertificates = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const certificates = await lmsService.getCertificates(userId);
    res.json({ success: true, data: certificates });
  } catch (error) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Learning Path Handlers
export const getAllLearningPaths = async (req: AuthRequest, res: Response) => {
  const organizationId = req.user?.orgId || 1;
  try {
    const paths = await lmsService.getAllLearningPaths(organizationId, req.query);
    res.json({ success: true, data: paths });
  } catch (error) {
    console.error("Error fetching learning paths:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createLearningPath = async (req: AuthRequest, res: Response) => {
  const organizationId = req.user?.orgId;
  if (!organizationId) return res.status(400).json({ error: "Organization ID required" });

  try {
    const path = await lmsService.createLearningPath({ 
      ...req.body, 
      organization_id: organizationId 
    });
    res.status(201).json({ success: true, data: path });
  } catch (error) {
    console.error("Error creating learning path:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getLearningPathById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const path = await lmsService.getLearningPathById(Number(id));
    if (!path) return res.status(404).json({ error: "Learning path not found" });
    res.json({ success: true, data: path });
  } catch (error) {
    console.error("Error fetching learning path:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateLearningPath = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const path = await lmsService.updateLearningPath(Number(id), req.body);
    res.json({ success: true, data: path });
  } catch (error) {
    console.error("Error updating learning path:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteLearningPath = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await lmsService.deleteLearningPath(Number(id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting learning path:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
