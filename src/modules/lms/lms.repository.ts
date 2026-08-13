import { PrismaClient } from "@prisma/client";
import { notificationService } from "../notifications/notification.service";

const prisma = new PrismaClient();

export class LmsRepository {
  async createCourse(data: any) {
    const { modules, ...courseData } = data;
    
    return await prisma.lmsCourse.create({
      data: {
        ...courseData,
        modules: modules ? {
          create: modules.map((mod: any) => ({
            title: mod.title,
            order: mod.order || 0,
            contents: mod.contents ? {
              create: mod.contents.map((content: any) => ({
                title: content.title,
                content_type: content.content_type,
                content_body: content.content_body,
                content_url: content.content_url,
                order: content.order || 0
              }))
            } : undefined
          }))
        } : undefined
      },
    });
  }

  async getCourses(filters: any) {
    return await prisma.lmsCourse.findMany({
      where: {
        ...filters,
        is_deleted: false,
      },
      include: {
        instructor: {
          select: {
            id: true,
            email: true,
            details: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        modules: {
          select: {
            id: true,
            _count: {
              select: {
                contents: true,
              },
            },
          },
        },
        _count: {
          select: {
            modules: true,
            assignments: true,
          },
        },
      },
    });
  }

  async getCourseById(id: number) {
    return await prisma.lmsCourse.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            contents: {
              orderBy: { order: "asc" },
            },
          },
        },
        quizzes: true,
      },
    });
  }

  async updateCourse(id: number, data: any) {
    return await prisma.lmsCourse.update({
      where: { id },
      data,
    });
  }

  async deleteCourse(id: number) {
    return await prisma.lmsCourse.update({
      where: { id },
      data: { is_deleted: true },
    });
  }

  async duplicateCourse(id: number) {
    const source = await prisma.lmsCourse.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            contents: true,
          },
        },
        quizzes: {
          include: {
            questions: true,
          },
        },
      },
    }) as any;

    if (!source) throw new Error("Source course not found");

    const { id: _, created_at: __, updated_at: ___, modules, quizzes, ...courseData } = source as any;

    return await prisma.lmsCourse.create({
      data: {
        ...courseData,
        title: `${source.title} (Copy)`,
        status: 'DRAFT',
        course_type: source.course_type,
        learning_objectives: source.learning_objectives as any,
        prerequisites: source.prerequisites as any,
        modules: {
          create: modules.map((mod: any) => ({
            title: mod.title,
            description: mod.description,
            order: mod.order,
            contents: {
              create: mod.contents.map((content: any) => ({
                title: content.title,
                content_type: content.content_type,
                content_url: content.content_url,
                content_body: content.content_body,
                meeting_config: content.meeting_config as any,
                order: content.order,
              })),
            },
          })),
        },
        quizzes: {
          create: quizzes.map((quiz: any) => ({
            title: quiz.title,
            description: quiz.description,
            passing_score: quiz.passing_score,
            max_attempts: quiz.max_attempts,
            time_limit: quiz.time_limit,
            questions: {
              create: quiz.questions.map((q: any) => ({
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options as any,
                correct_answer: q.correct_answer as any,
                explanation: q.explanation,
              })),
            },
          })),
        },
      },
    });
  }

  // Module methods
  async createModule(data: any) {
    return await prisma.lmsModule.create({
      data,
    });
  }

  async updateModule(id: number, data: any) {
    return await prisma.lmsModule.update({
      where: { id },
      data,
    });
  }

  async deleteModule(id: number) {
    return await prisma.lmsModule.delete({
      where: { id },
    });
  }
  async getModuleById(id: number) {
    return await prisma.lmsModule.findUnique({
      where: { id },
    });
  }

  async ensureAssignment(userId: number, courseId: number) {
    const existing = await prisma.lmsAssignment.findFirst({
      where: { user_id: userId, course_id: courseId },
    });

    if (!existing) {
      const assignment = await prisma.lmsAssignment.create({
        data: {
          user_id: userId,
          course_id: courseId,
          status: 'IN_PROGRESS',
        },
        include: { course: true }
      });
      
      // Notify user of enrollment
      await notificationService.create({
        user_id: userId,
        title: 'New Course Enrollment',
        message: `You have been enrolled in the course: ${assignment.course?.title || 'Unknown Course'}`,
        type: 'INFO',
        related_module: 'lms',
        related_id: courseId
      });

      return assignment;
    }
    return existing;
  }

  // Content methods
  async createContent(data: any) {
    return await prisma.lmsContent.create({
      data,
    });
  }

  async updateContent(id: number, data: any) {
    return await prisma.lmsContent.update({
      where: { id },
      data,
    });
  }

  async deleteContent(id: number) {
    return await prisma.lmsContent.delete({
      where: { id },
    });
  }

  // Assignment methods
  async assignToUser(data: any) {
    return await prisma.lmsAssignment.create({
      data,
    });
  }

  async getAutoAssignTargets(rules: any) {
    const { department_ids, role_ids } = rules;
    return await prisma.user.findMany({
      where: {
        is_deleted: false,
        details: {
          OR: [
            department_ids ? { department_id: { in: department_ids } } : {},
            role_ids ? { role_id: { in: role_ids } } : {},
          ],
        },
      },
      select: { id: true },
    });
  }

  async getAssignments(userId: number) {
    return await prisma.lmsAssignment.findMany({
      where: { user_id: userId },
      include: {
        course: true,
        learning_path: {
          include: {
            courses: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });
  }

  // Learning Path methods
  async createLearningPath(data: any) {
    const { courses, ...pathData } = data;
    return await prisma.lmsLearningPath.create({
      data: {
        ...pathData,
        courses: courses ? {
          create: courses.map((c: any) => ({
            course_id: c.course_id,
            order: c.order || 0
          }))
        } : undefined
      },
      include: {
        courses: {
          include: { course: true }
        }
      }
    });
  }

  async getLearningPaths(filters: any) {
    return await prisma.lmsLearningPath.findMany({
      where: filters,
      include: {
        courses: {
          include: { course: true }
        },
        _count: {
          select: { assignments: true }
        }
      }
    });
  }

  async getLearningPathById(id: number) {
    return await prisma.lmsLearningPath.findUnique({
      where: { id },
      include: {
        courses: {
          orderBy: { order: 'asc' },
          include: { course: true }
        }
      }
    });
  }

  async updateLearningPath(id: number, data: any) {
    const { courses, ...pathData } = data;

    if (courses) {
      await prisma.lmsLearningPathCourse.deleteMany({
        where: { learning_path_id: id }
      });
    }

    return await prisma.lmsLearningPath.update({
      where: { id },
      data: {
        ...pathData,
        courses: courses ? {
          create: courses.map((c: any) => ({
            course_id: c.course_id,
            order: c.order || 0
          }))
        } : undefined
      },
      include: {
        courses: {
          include: { course: true }
        }
      }
    });
  }

  async deleteLearningPath(id: number) {
    return await prisma.lmsLearningPath.delete({
      where: { id }
    });
  }

  // Progress methods
  async updateProgress(userId: number, contentId: number, moduleId: number, completed: boolean, timeSpent: number, engagementData?: any) {
    const progress = await prisma.lmsProgress.upsert({
      where: {
        user_id_content_id: {
          user_id: userId,
          content_id: contentId,
        },
      },
      update: {
        completed,
        time_spent: { increment: timeSpent },
        engagement_data: engagementData || undefined,
        completed_at: completed ? new Date() : undefined,
      } as any,
      create: {
        user_id: userId,
        content_id: contentId,
        module_id: moduleId,
        completed,
        time_spent: timeSpent,
        engagement_data: engagementData || null,
        completed_at: completed ? new Date() : null,
      } as any,
    });

    // Auto-update assignment status if course is finished
    const module = await this.getModuleById(moduleId);
    if (module) {
      const courseProgress = await this.getCourseProgress(userId, module.course_id);
      if (courseProgress && courseProgress.percentage === 100) {
        await prisma.lmsAssignment.updateMany({
          where: { user_id: userId, course_id: module.course_id },
          data: { status: 'COMPLETED' },
        });
        // Issue certificate on completion
        await this.issueCertificate(userId, module.course_id);
      } else {
        await prisma.lmsAssignment.updateMany({
          where: { user_id: userId, course_id: module.course_id, status: 'ASSIGNED' },
          data: { status: 'IN_PROGRESS' },
        });
      }
    }

    return progress;
  }

  async getCourseProgress(userId: number, courseId: number) {
    const course = await prisma.lmsCourse.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            contents: true,
          },
        },
      },
    });

    if (!course) return null;

    const allContentIds = course.modules.flatMap(m => m.contents.map(c => c.id));
    if (allContentIds.length === 0) {
      return {
        total_contents: 0,
        completed_contents: 0,
        percentage: 0,
      };
    }

    const completedProgress = await prisma.lmsProgress.findMany({
      where: {
        user_id: userId,
        content_id: { in: allContentIds },
        completed: true,
      },
    });

    return {
      total_contents: allContentIds.length,
      completed_contents: completedProgress.length,
      percentage: allContentIds.length > 0 ? (completedProgress.length / allContentIds.length) * 100 : 0,
    };
  }

  async getLearningPathProgress(userId: number, pathId: number) {
    const path = await prisma.lmsLearningPath.findUnique({
      where: { id: pathId },
      include: {
        courses: {
          include: {
            course: {
              include: {
                modules: {
                  include: {
                    contents: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!path) return null;

    const results = await Promise.all(
      path.courses.map(async (pc) => {
        const progress = await this.getCourseProgress(userId, pc.course_id);
        return {
          course_id: pc.course_id,
          title: pc.course.title,
          progress: progress?.percentage || 0
        };
      })
    );

    const overall = results.reduce((acc, curr) => acc + curr.progress, 0) / results.length;

    return {
      path_id: pathId,
      title: path.title,
      overall_percentage: results.length > 0 ? Math.round(overall) : 0,
      course_results: results
    };
  }

  async getAdminStats(organizationId: number) {
    const [totalCourses, totalEnrollments, totalCompletions, totalLearners, activeUsersCount] = await Promise.all([
      prisma.lmsCourse.count({ where: { organization_id: organizationId, is_deleted: false } }),
      prisma.lmsAssignment.count({ where: { course: { organization_id: organizationId } } }),
      prisma.lmsAssignment.count({ where: { course: { organization_id: organizationId }, status: 'COMPLETED' } }),
      prisma.user.count({ where: { lmsAssignments: { some: { course: { organization_id: organizationId } } } } }),
      prisma.lmsProgress.groupBy({
        by: ['user_id'],
        where: { module: { course: { organization_id: organizationId } } },
        _count: true
      })
    ]);

    return {
      totalCourses,
      totalEnrollments,
      totalCompletions,
      totalLearners,
      activeUsers: activeUsersCount.length,
      completionRate: totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0
    };
  }

  async getManagerStats(managerId: number, organizationId: number) {
    // Find all users reporting to this manager
    const teamMembers = await prisma.userDetail.findMany({
      where: { reporting_manager_id: managerId },
      select: { user_id: true }
    });
    const teamUserIds = teamMembers.map(m => m.user_id);

    const [totalEnrollments, totalCompletions, activeLearners] = await Promise.all([
      prisma.lmsAssignment.count({ 
        where: { user_id: { in: teamUserIds }, course: { organization_id: organizationId } } 
      }),
      prisma.lmsAssignment.count({ 
        where: { user_id: { in: teamUserIds }, course: { organization_id: organizationId }, status: 'COMPLETED' } 
      }),
      prisma.lmsProgress.groupBy({
        by: ['user_id'],
        where: { user_id: { in: teamUserIds }, module: { course: { organization_id: organizationId } } },
      })
    ]);

    return {
      teamSize: teamUserIds.length,
      totalEnrollments,
      totalCompletions,
      activeLearners: activeLearners.length,
      completionRate: totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0
    };
  }

  // Quiz methods
  async createQuiz(data: any) {
    return await prisma.lmsQuiz.create({
      data,
    });
  }

  async addQuestion(data: any) {
    return await prisma.lmsQuestion.create({
      data,
    });
  }

  async getQuizById(id: number) {
    return await prisma.lmsQuiz.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    });
  }

  async submitAttempt(userId: number, quizId: number, score: number, status: string) {
    const attempt = await prisma.lmsQuizAttempt.create({
      data: {
        user_id: userId,
        quiz_id: quizId,
        score,
        status,
      },
    });

    // If passed, check if we should issue a certificate
    if (status === 'PASS') {
      const quiz = await this.getQuizById(quizId);
      if (quiz) {
        await this.issueCertificate(userId, quiz.course_id);
      }
    }

    return attempt;
  }

  async issueCertificate(userId: number, courseId: number) {
    const existing = await prisma.lmsCertificate.findFirst({
      where: { user_id: userId, course_id: courseId },
    });

    if (existing) return existing;

    const certId = `CERT-${courseId}-${userId}-${Date.now().toString().slice(-6)}`;
    const certificate = await prisma.lmsCertificate.create({
      data: {
        user_id: userId,
        course_id: courseId,
        certificate_id: certId,
        expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year validity
      },
      include: { course: true }
    });

    // Notify user of certificate issuance
    await notificationService.create({
      user_id: userId,
      title: 'Certificate Earned!',
      message: `Congratulations! You have earned a certificate for: ${certificate.course?.title || 'Course Completion'}`,
      type: 'SUCCESS',
      related_module: 'lms',
      related_id: courseId
    });

    return certificate;
  }

  async getCertificates(userId: number) {
    return await prisma.lmsCertificate.findMany({
      where: { user_id: userId },
      include: {
        course: true,
      },
    });
  }
}
