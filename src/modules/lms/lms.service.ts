import { LmsRepository } from "./lms.repository";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class LmsService {
  private repository: LmsRepository;

  constructor() {
    this.repository = new LmsRepository();
  }

  async createCourse(data: any) {
    const course = await this.repository.createCourse(data);
    if (course.auto_assign_rules) {
      await this.processCourseAutoAssignments(course.id);
    }
    return course;
  }

  async getAllCourses(organizationId: number, filters: any = {}) {
    return await this.repository.getCourses({ ...filters, organization_id: organizationId });
  }

  async getCourseDetails(id: number, userId?: number) {
    const course = await this.repository.getCourseById(id);
    if (course && userId) {
      const progress = await this.repository.getCourseProgress(userId, id);
      return { ...course, progress };
    }
    return course;
  }

  async updateCourse(id: number, data: any) {
    const course = await this.repository.updateCourse(id, data);
    if (course.auto_assign_rules) {
      await this.processCourseAutoAssignments(course.id);
    }
    return course;
  }

  async archiveCourse(id: number) {
    return await this.repository.updateCourse(id, { status: 'ARCHIVED' });
  }

  async deleteCourse(id: number) {
    return await prisma.lmsCourse.update({
      where: { id },
      data: { is_deleted: true },
    });
  }

  async duplicateCourse(id: number) {
    return await this.repository.duplicateCourse(id);
  }

  async addModule(courseId: number, title: string, order: number, description?: string) {
    return await this.repository.createModule({ course_id: courseId, title, order, description });
  }

  async addContent(moduleId: number, data: any) {
    if (data.content_type === 'LIVE_CLASS') {
      // Validate meeting config
      if (!data.meeting_config?.link) throw new Error("Live class requires a meeting link");
    }
    return await this.repository.createContent({ ...data, module_id: moduleId });
  }

  async updateModule(moduleId: number, data: any) {
    return await this.repository.updateModule(moduleId, data);
  }

  async updateContent(contentId: number, data: any) {
    return await this.repository.updateContent(contentId, data);
  }

  async assignCourse(userId: number, courseId: number, assignedBy: number, dueDate?: Date) {
    return await this.repository.assignToUser({
      user_id: userId,
      course_id: courseId,
      assigned_by: assignedBy,
      due_date: dueDate,
    });
  }

  async trackProgress(userId: number, contentId: number, moduleId: number, completed: boolean, timeSpent: number, engagementData?: any) {
    // Ensure user is assigned to the course when they start tracking progress
    const module = await this.repository.getModuleById(moduleId);
    if (module) {
      await this.repository.ensureAssignment(userId, module.course_id);
    }
    return await this.repository.updateProgress(userId, contentId, moduleId, completed, timeSpent, engagementData);
  }

  async getLearnerDashboard(userId: number) {
    const assignments = await this.repository.getAssignments(userId);
    const dashboardData = await Promise.all(
      assignments.map(async (assignment) => {
        if (assignment.course_id) {
          const progress = await this.repository.getCourseProgress(userId, assignment.course_id);
          return {
            ...assignment,
            progress,
          };
        }
        return assignment;
      })
    );
    return dashboardData;
  }

  async getAdminStats(organizationId: number) {
    return await this.repository.getAdminStats(organizationId);
  }

  async getManagerStats(managerId: number, organizationId: number) {
    return await this.repository.getManagerStats(managerId, organizationId);
  }

  // Quiz & Certificate methods
  async createQuiz(courseId: number, data: any) {
    return await this.repository.createQuiz({ ...data, course_id: courseId });
  }

  async addQuestion(quizId: number, data: any) {
    return await this.repository.addQuestion({ ...data, quiz_id: quizId });
  }

  async submitQuiz(userId: number, quizId: number, answers: any[]) {
    const quiz = await this.repository.getQuizById(quizId);
    if (!quiz) throw new Error("Quiz not found");

    let score = 0;
    const questions = quiz.questions;
    
    // Evaluation logic
    questions.forEach((q: any) => {
      const userAnswer = answers.find(a => a.questionId === q.id)?.answer;
      if (JSON.stringify(userAnswer) === JSON.stringify(q.correct_answer)) {
        score++;
      }
    });

    const percentage = Math.round((score / questions.length) * 100);
    const status = percentage >= quiz.passing_score ? 'PASS' : 'FAIL';

    return await this.repository.submitAttempt(userId, quizId, percentage, status);
  }

  async getCertificates(userId: number) {
    return await this.repository.getCertificates(userId);
  }

  // Learning Path methods
  async createLearningPath(data: any) {
    const path = await this.repository.createLearningPath(data);
    if (path.auto_assign_rules) {
      await this.processLearningPathAutoAssignments(path.id);
    }
    return path;
  }

  async getAllLearningPaths(organizationId: number, filters: any = {}) {
    return await this.repository.getLearningPaths({ ...filters, organization_id: organizationId });
  }

  async getLearningPathById(id: number) {
    return await this.repository.getLearningPathById(id);
  }

  async updateLearningPath(id: number, data: any) {
    const path = await this.repository.updateLearningPath(id, data);
    if (path.auto_assign_rules) {
      await this.processLearningPathAutoAssignments(path.id);
    }
    return path;
  }

  async deleteLearningPath(id: number) {
    return await this.repository.deleteLearningPath(id);
  }

  async processLearningPathAutoAssignments(learningPathId: number) {
    const path = await prisma.lmsLearningPath.findUnique({
      where: { id: learningPathId }
    });
    
    if (!path || !(path as any).auto_assign_rules) return;
    
    const users = await this.repository.getAutoAssignTargets((path as any).auto_assign_rules);
    
    for (const user of users) {
      await this.repository.assignToUser({
        user_id: user.id,
        learning_path_id: learningPathId,
        status: 'ASSIGNED'
      });
    }
  }

  async processCourseAutoAssignments(courseId: number) {
    const course = await prisma.lmsCourse.findUnique({
      where: { id: courseId }
    });
    
    if (!course || !(course as any).auto_assign_rules) return;
    
    const users = await this.repository.getAutoAssignTargets((course as any).auto_assign_rules);
    
    for (const user of users) {
      await this.repository.assignToUser({
        user_id: user.id,
        course_id: courseId,
        status: 'ASSIGNED'
      });
    }
  }
}
