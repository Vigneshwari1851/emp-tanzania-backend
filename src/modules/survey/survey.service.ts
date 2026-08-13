import prisma from '../../shared/prisma/client';
import { QuestionType } from '@prisma/client';
import { notificationService } from '../notifications/notification.service';
import path from 'path';
import fs from 'fs';

const logFilePath = path.join(process.cwd(), 'save_log.txt');

export class SurveyService {
  async create(userId: number, data: {
    title: string;
    description?: string;
    access?: string;
    survey_password?: string | null;
    start_date?: Date | null;
    end_date?: Date | null;
    target_department?: string;
    cloned_from_id?: string;
    is_clone?: boolean;
    questions: {
      type: QuestionType;
      label: string;
      order: number;
      required?: boolean;
      parent_question_id?: number | null;
      trigger_option_id?: number | null;
      options?: { label: string; value: string; order: number }[];
    }[];
  }) {
    const survey = await prisma.survey.create({
      data: {
        title: data.title,
        description: data.description,
        access: data.access ?? "private",
        survey_password: data.survey_password,
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        cloned_from_id: data.cloned_from_id,
        is_clone: data.is_clone ?? false,
        // @ts-ignore
        target_department: data.target_department || "All Departments",
        created_by: userId,
        questions: {
          create: data.questions.map((q) => ({
            type: q.type,
            label: q.label,
            order: q.order,
            required: q.required ?? false,
            options: q.options
              ? { create: q.options.map((o) => ({ label: o.label, value: o.value, order: o.order })) }
              : undefined,
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          }
        }
      },
    });

    // Resolve parent_question_id from order references to actual DB IDs
    for (const qInput of data.questions) {
      if (qInput.parent_question_id) {
        const parentQ = survey.questions.find(q => q.order === qInput.parent_question_id);
        const childQ = survey.questions.find(q => q.order === qInput.order);
        if (parentQ && childQ) {
          let triggerOptId: number | null = null;
          if (qInput.trigger_option_id !== null && qInput.trigger_option_id !== undefined) {
            const parentOpt = parentQ.options[qInput.trigger_option_id];
            if (parentOpt) triggerOptId = parentOpt.id;
          }
          await prisma.question.update({
            where: { id: childQ.id },
            data: { parent_question_id: parentQ.id, trigger_option_id: triggerOptId },
          });
        }
      }
    }

    // Notify targeted department users (or all active users if All Departments)
    try {
      // Find the orgId of the user creating the survey
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { details: { select: { department: { select: { branches: { select: { organization_id: true } } } } } } }
      });
      const orgId = user?.details?.department?.branches?.organization_id;

      const rawDept = survey.target_department || data.target_department || "All Departments";
      const depts = rawDept
        .split(",")
        .map((d: string) => d.trim())
        .filter((d: string) => d.length > 0);

      const isTargetingAll = depts.length === 0 || depts.includes("All Departments");

      const departmentWhere: any = {};
      if (orgId) {
        departmentWhere.branches = { organization_id: orgId };
      }
      if (!isTargetingAll) {
        departmentWhere.department_name = depts.length === 1 ? depts[0] : { in: depts };
      }

      const activeUsers = await prisma.user.findMany({ 
        where: { 
          status: true, 
          is_deleted: false,
          ...(Object.keys(departmentWhere).length > 0 ? { details: { department: departmentWhere } } : {})
        } 
      });
      for (const u of activeUsers) {
        await notificationService.create({
          user_id: u.id,
          title: 'New Survey Available',
          message: `A new survey "${data.title}" has been published.`,
          type: 'INFO',
          related_module: 'survey',
          related_id: 0, // Fallback for uuid primary keys
          metadata: { surveyId: survey.id }
        });
      }
    } catch (notifErr) {
      console.error('Failed to dispatch survey notifications:', notifErr);
    }

    return await this.getById(survey.id);
  }

  async update(id: string, data: {
    title: string;
    description?: string;
    is_active?: boolean;
    access?: string;
    survey_password?: string | null;
    theme_preset?: string | null;
    theme_config?: string | null;
    start_date?: Date | null;
    end_date?: Date | null;
    target_department?: string;
    questions?: {
      id?: number;
      type: QuestionType;
      label: string;
      order: number;
      required?: boolean;
      parent_question_id?: number | null;
      trigger_option_id?: number | null;
      options?: { id?: number; label: string; value: string; order: number }[];
    }[];
  }) {
    const existing = await prisma.survey.findUnique({
      where: { id },
      include: { responses: true }
    });

    if (!existing) throw new Error('Survey not found');

    const hasResponses = existing.responses.length > 0;

    // Update survey details
    const updatedSurvey = await prisma.survey.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        is_active: data.is_active,
        access: data.access,
        survey_password: data.survey_password,
        theme_preset: data.theme_preset,
        theme_config: data.theme_config,
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        // @ts-ignore
        target_department: data.target_department,
      },
    });

    // If questions are provided, handle updates
    if (data.questions && data.questions.length > 0) {
      if (hasResponses) {
        throw new Error('Cannot modify questions for a survey that already has responses.');
      }

      // Safe to replace questions since no responses exist
      const questions = data.questions; // narrow for TS
      // Wrap all question mutations in a transaction: if resolution fails,
      // the delete + create are rolled back too — prevents orphan questions
      // without parent_question_id.
      await prisma.$transaction(async (tx) => {
        // Delete existing questions (cascade deletes options)
        await tx.question.deleteMany({ where: { surveyId: id } });

        // Create new questions
        const createdQuestions: any[] = [];
        for (const q of questions) {
          const created = await tx.question.create({
            data: {
              surveyId: id,
              type: q.type,
              label: q.label,
              order: q.order,
              required: q.required ?? false,
              options: q.options ? {
                create: q.options.map(o => ({
                  label: o.label,
                  value: o.value,
                  order: o.order
                }))
              } : undefined
            },
            include: {
              options: {
                orderBy: { order: 'asc' }
              }
            }
          });
          createdQuestions.push(created);
        }

        // Resolve parent_question_id from order references to actual DB IDs
        fs.appendFileSync(logFilePath, new Date().toISOString() + '\n' + JSON.stringify(questions, null, 2) + '\n');
        for (const qInput of questions) {
          if (qInput.parent_question_id) {
            const parentQ = createdQuestions.find(q => q.order === qInput.parent_question_id);
            const childQ = createdQuestions.find(q => q.order === qInput.order);
            if (parentQ && childQ) {
              let triggerOptId: number | null = null;
              if (qInput.trigger_option_id !== null && qInput.trigger_option_id !== undefined) {
                const parentOpt = parentQ.options[qInput.trigger_option_id];
                if (parentOpt) triggerOptId = parentOpt.id;
              }
              await tx.question.update({
                where: { id: childQ.id },
                data: { parent_question_id: parentQ.id, trigger_option_id: triggerOptId },
              });
            }
          }
        }
      });
      fs.appendFileSync(
        logFilePath,
        `[transaction] ${new Date().toISOString()} transaction completed successfully with ${questions.filter(q => q.parent_question_id).length} rules\n`
      );
    }

    return await this.getById(id);
  }

  async clone(userId: number, surveyId: string) {
    const existing = await this.getById(surveyId);
    if (!existing) throw new Error('Survey not found');

    const clonedQuestions = existing.questions.map(q => {
      let parentOrder = null;
      let triggerOptIndex = null;

      if (q.parent_question_id) {
        const parentQ = existing.questions.find(pq => pq.id === q.parent_question_id);
        if (parentQ) {
          parentOrder = parentQ.order;
          if (q.trigger_option_id && parentQ.options) {
            const optIndex = parentQ.options.findIndex(o => o.id === q.trigger_option_id);
            if (optIndex >= 0) triggerOptIndex = optIndex;
          }
        }
      }

      return {
        type: q.type,
        label: q.label,
        order: q.order,
        required: q.required,
        parent_question_id: parentOrder,
        trigger_option_id: triggerOptIndex,
        options: q.options ? q.options.map(o => ({
          label: o.label,
          value: o.value,
          order: o.order
        })) : undefined
      };
    });

    return await this.create(userId, {
      title: `Clone of ${existing.title}`,
      description: existing.description || undefined,
      access: existing.access || "private",
      target_department: existing.target_department || "All Departments",
      is_clone: true,
      cloned_from_id: existing.id,
      questions: clonedQuestions
    });
  }

  async duplicate(userId: number, surveyId: string) {
    const existing = await this.getById(surveyId);
    if (!existing) throw new Error('Survey not found');

    const clonedQuestions = existing.questions.map(q => {
      let parentOrder = null;
      let triggerOptIndex = null;

      if (q.parent_question_id) {
        const parentQ = existing.questions.find(pq => pq.id === q.parent_question_id);
        if (parentQ) {
          parentOrder = parentQ.order;
          if (q.trigger_option_id && parentQ.options) {
            const optIndex = parentQ.options.findIndex(o => o.id === q.trigger_option_id);
            if (optIndex >= 0) triggerOptIndex = optIndex;
          }
        }
      }

      return {
        type: q.type,
        label: q.label,
        order: q.order,
        required: q.required,
        parent_question_id: parentOrder,
        trigger_option_id: triggerOptIndex,
        options: q.options ? q.options.map(o => ({
          label: o.label,
          value: o.value,
          order: o.order
        })) : undefined
      };
    });

    return await this.create(userId, {
      title: `Copy of ${existing.title}`,
      description: existing.description || undefined,
      access: existing.access || "private",
      target_department: existing.target_department || "All Departments",
      is_clone: false,
      cloned_from_id: existing.id,
      questions: clonedQuestions
    });
  }

  async list(userId: number, roles: string[] = [], filters?: { status?: string, department?: string }, orgId?: number) {
    const normalizedRoles = roles.map(r => r.toUpperCase());
    const isAdmin = normalizedRoles.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR'].includes(r));

    let whereCondition: any = { is_deleted: false };

    if (filters?.status === 'Active') {
      whereCondition.is_active = true;
    } else if (filters?.status === 'Closed') {
      whereCondition.is_active = false;
    }

    if (orgId && isAdmin) {
      // For admins, filter surveys by users in their organization
      // FIX: Prisma relation is named "creator", not "createdBy"
      whereCondition.creator = {
        details: { department: { branches: { organization_id: orgId } } }
      };
    }

    if (filters?.department && filters.department !== 'All Departments') {
      whereCondition.responses = {
        some: {
          user: {
            details: {
              department: {
                department_name: filters.department
              }
            }
          }
        }
      };
    }

    const surveys = await prisma.survey.findMany({
      where: whereCondition,
      include: {
        cloned_from: {
          select: {
            id: true,
            title: true,
          }
        },
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            },
            triggerOption: true
          },
          orderBy: { order: 'asc' }
        },
        responses: isAdmin ? {
          where: filters?.department && filters.department !== 'All Departments' ? {
            user: {
              details: {
                department: {
                  department_name: filters.department
                }
              }
            }
          } : undefined,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                details: {
                  select: {
                    first_name: true,
                    last_name: true,
                    department: {
                      select: {
                        department_name: true
                      }
                    }
                  }
                }
              }
            },
            answers: {
              include: {
                selectedOption: true
              }
            }
          }
        } : {
          where: { userId },
          include: {
            answers: {
              include: {
                selectedOption: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
    });

    // If not admin, filter out surveys that are restricted to another department
    let filteredSurveys = surveys;
    if (!isAdmin) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { details: { include: { department: true } } }
      });
      const userDept = currentUser?.details?.department?.department_name || "";
      filteredSurveys = surveys.filter((s: any) => {
        if (!s.target_department || s.target_department === "All Departments") return true;
        const depts = s.target_department.split(",").map((d: string) => d.trim());
        return depts.includes("All Departments") || depts.includes(userDept);
      });
    }

    // Populate parent responses for cloned surveys
    for (const survey of filteredSurveys) {
      if (survey.is_clone && survey.cloned_from_id) {
        const ancestors = await this.getCloneAncestors(survey.id);
        if (ancestors.length > 0) {
          const parentResponses = await prisma.surveyResponse.findMany({
            where: {
              surveyId: { in: ancestors },
              is_deleted: false,
              ...(filters?.department && filters.department !== 'All Departments' ? {
                user: {
                  details: {
                    department: {
                      department_name: filters.department
                    }
                  }
                }
              } : {})
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  details: {
                    select: {
                      first_name: true,
                      last_name: true,
                      department: {
                        select: {
                          department_name: true
                        }
                      }
                    }
                  }
                }
              },
              answers: {
                include: {
                  selectedOption: true
                }
              }
            }
          });

          const allResponses = [...(survey.responses || []), ...parentResponses];
          const mappedAllResponses = await this.mapAncestorResponses(survey.id, allResponses);
          const responseMap = new Map();
          for (const resp of mappedAllResponses) {
            responseMap.set(resp.id, resp);
          }
          survey.responses = Array.from(responseMap.values());
        }
      }
    }

    let activeUserCount;
    const orgFilter = orgId ? { details: { department: { branches: { organization_id: orgId } } } } : {};
    
    if (filters?.department && filters.department !== 'All Departments') {
      activeUserCount = await prisma.user.count({
        where: {
          status: true,
          is_deleted: false,
          ...orgFilter,
          details: {
            ...orgFilter.details,
            department: {
              ...orgFilter.details?.department,
              department_name: filters.department
            }
          }
        }
      });
    } else {
      activeUserCount = await prisma.user.count({
        where: { status: true, is_deleted: false, ...orgFilter }
      });
    }

    return filteredSurveys.map((s) => ({
      ...s,
      active_user_count: activeUserCount || 1, // Avoid division by zero
    }));
  }

  async getById(id: string) {
    const result = await prisma.survey.findUnique({
      where: { id },
      include: {
        cloned_from: {
          select: {
            id: true,
            title: true,
          }
        },
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            },
            triggerOption: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (result?.questions) {
      const ruleCount = result.questions.filter((q: any) => q.parent_question_id != null).length;
      fs.appendFileSync(
        logFilePath,
        `\n[getById] ${new Date().toISOString()} rules=${ruleCount}/${result.questions.length} q_ids=[${result.questions.map((q: any) => q.id).join(',')}] parent_ids=[${result.questions.map((q: any) => q.parent_question_id ?? 'null').join(',')}]\n`
      );
    }
    return result;
  }

  async submitResponse(userId: number | null, surveyId: string, answers: {
    questionId: number;
    valueText?: string;
    valueNumber?: number;
    selectedOptionId?: number;
  }[]) {
    return await prisma.surveyResponse.create({
      data: {
        survey: { connect: { id: surveyId } },
        user: userId ? { connect: { id: userId } } : undefined,
        answers: {
          create: answers.map((a) => ({
            question: { connect: { id: a.questionId } },
            valueText: a.valueText,
            valueNumber: a.valueNumber,
            selectedOption: a.selectedOptionId ? { connect: { id: a.selectedOptionId } } : undefined,
          }))
        }
      },
      include: { answers: true }
    });
  }

  async addQuestion(surveyId: string, data: {
    type: QuestionType;
    label: string;
    order: number;
    required?: boolean;
    parent_question_id?: number | null;
    trigger_option_id?: number | null;
    options?: { label: string; value: string; order: number }[];
  }) {
    return await prisma.question.create({
      data: {
        surveyId: surveyId,
        type: data.type,
        label: data.label,
        order: data.order,
        required: data.required ?? false,
        parent_question_id: data.parent_question_id ?? null,
        trigger_option_id: data.trigger_option_id ?? null,
        options: data.options
          ? { create: data.options.map((opt) => ({ label: opt.label, value: opt.value, order: opt.order })) }
          : undefined,
      },
      include: {
        options: {
          orderBy: { order: 'asc' }
        }
      }
    });
  }

  private async getCloneAncestors(surveyId: string): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string | null = surveyId;
    while (currentId) {
      const s = (await prisma.survey.findUnique({
        where: { id: currentId },
        select: { cloned_from_id: true, is_clone: true }
      })) as { cloned_from_id: string | null; is_clone: boolean } | null;
      if (!s) break;
      if (s.is_clone && s.cloned_from_id) {
        ancestors.push(s.cloned_from_id);
        currentId = s.cloned_from_id;
      } else {
        break;
      }
    }
    return ancestors;
  }

  private async mapAncestorResponses(surveyId: string, responses: any[]) {
    if (!responses || responses.length === 0) return responses;

    const needsMapping = responses.some(resp => resp.surveyId !== surveyId);
    if (!needsMapping) return responses;

    const currentQuestions = await prisma.question.findMany({
      where: { surveyId },
      include: { options: true }
    });

    const currentQuestionsByOrder = new Map<number, typeof currentQuestions[0]>();
    for (const q of currentQuestions) {
      currentQuestionsByOrder.set(q.order, q);
    }

    const ancestorQuestionIdMap = new Map<number, number>();
    const ancestorOptionIdMap = new Map<number, number>();

    const ancestorSurveyIds = Array.from(new Set(
      responses.filter(resp => resp.surveyId !== surveyId).map(resp => resp.surveyId)
    )) as string[];

    const ancestorQuestions = await prisma.question.findMany({
      where: { surveyId: { in: ancestorSurveyIds } },
      include: { options: true }
    });

    const ancestorQuestionsBySurvey = new Map<string, typeof ancestorQuestions>();
    for (const q of ancestorQuestions) {
      if (!ancestorQuestionsBySurvey.has(q.surveyId)) {
        ancestorQuestionsBySurvey.set(q.surveyId, []);
      }
      ancestorQuestionsBySurvey.get(q.surveyId)!.push(q);
    }

    for (const [ancSurveyId, questions] of ancestorQuestionsBySurvey.entries()) {
      for (const aq of questions) {
        const cq = currentQuestionsByOrder.get(aq.order);
        if (cq) {
          ancestorQuestionIdMap.set(aq.id, cq.id);
          
          const cqOptionsByOrder = new Map<number, typeof cq.options[0]>();
          for (const opt of cq.options) {
            cqOptionsByOrder.set(opt.order, opt);
          }

          for (const aopt of aq.options) {
            const copt = cqOptionsByOrder.get(aopt.order);
            if (copt) {
              ancestorOptionIdMap.set(aopt.id, copt.id);
            }
          }
        }
      }
    }

    return responses.map(resp => {
      if (resp.surveyId === surveyId) {
        return resp;
      }

      const mappedAnswers = resp.answers.map((ans: any) => {
        const targetQuestionId = ancestorQuestionIdMap.get(ans.questionId) || ans.questionId;
        const targetOptionId = ans.selectedOptionId 
          ? (ancestorOptionIdMap.get(ans.selectedOptionId) || ans.selectedOptionId)
          : ans.selectedOptionId;

        let mappedSelectedOption = ans.selectedOption;
        if (ans.selectedOptionId && targetOptionId !== ans.selectedOptionId) {
          const matchedCurrentQ = currentQuestions.find(cq => cq.id === targetQuestionId);
          const matchedCurrentOpt = matchedCurrentQ?.options.find(opt => opt.id === targetOptionId);
          if (matchedCurrentOpt) {
            mappedSelectedOption = matchedCurrentOpt as any;
          }
        }

        return {
          ...ans,
          questionId: targetQuestionId,
          selectedOptionId: targetOptionId,
          selectedOption: mappedSelectedOption
        };
      });

      return {
        ...resp,
        surveyId,
        answers: mappedAnswers
      };
    });
  }

  async getResponses(surveyId: string) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { id: true }
    });
    if (!survey) return [];

    const ancestors = await this.getCloneAncestors(surveyId);
    const idsToFetch = [surveyId, ...ancestors];

    const rawResponses = await prisma.surveyResponse.findMany({
      where: { surveyId: { in: idsToFetch }, is_deleted: false },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            details: {
              select: {
                first_name: true,
                last_name: true,
                department: {
                  select: {
                    department_name: true
                  }
                }
              }
            }
          }
        },
        answers: {
          include: {
            selectedOption: true
          }
        }
      },
      orderBy: { submitted_at: 'desc' }
    });

    return await this.mapAncestorResponses(surveyId, rawResponses);
  }

  async close(id: string) {
    return await prisma.survey.update({
      where: { id },
      data: { is_active: false },
    });
  }
}

export const surveyService = new SurveyService();
