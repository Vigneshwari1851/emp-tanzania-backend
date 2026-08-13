import { z } from 'zod';
import { QuestionType } from '@prisma/client';

export const createSurveySchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Survey title is required'),
    description: z.string().trim().optional(),
    start_date: z.preprocess((val) => (val ? new Date(val as string) : null), z.date().nullable().optional()),
    end_date: z.preprocess((val) => (val ? new Date(val as string) : null), z.date().nullable().optional()),
    target_department: z.string().optional(),
    questions: z.array(
      z.object({
        type: z.nativeEnum(QuestionType),
        label: z.string().trim().min(1, 'Question label is required'),
        order: z.number().int(),
        required: z.boolean().optional().default(false),
        parent_question_id: z.number().int().nullable().optional(),
        trigger_option_id: z.number().int().nullable().optional(),
        options: z.array(
          z.object({
            label: z.string().trim().min(1, 'Option label is required'),
            value: z.string().trim().min(1, 'Option value is required'),
            order: z.number().int(),
          })
        ).optional(),
      })
    ).min(1, 'At least one question is required'),
  }),
});

export const updateSurveySchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Survey title is required'),
    description: z.string().trim().optional(),
    is_active: z.boolean().optional(),
    access: z.enum(['public', 'private', 'password']).optional(),
    survey_password: z.string().nullable().optional(),
    theme_preset: z.string().nullable().optional(),
    theme_config: z.string().nullable().optional(),
    start_date: z.preprocess((val) => (val ? new Date(val as string) : null), z.date().nullable().optional()),
    end_date: z.preprocess((val) => (val ? new Date(val as string) : null), z.date().nullable().optional()),
    target_department: z.string().optional(),
    questions: z.array(
      z.object({
        id: z.number().optional(), // Can have ID if existing, otherwise new
        type: z.nativeEnum(QuestionType),
        label: z.string().trim().min(1, 'Question label is required'),
        order: z.number().int(),
        required: z.boolean().optional().default(false),
        parent_question_id: z.number().int().nullable().optional(),
        trigger_option_id: z.number().int().nullable().optional(),
        options: z.array(
          z.object({
            id: z.number().optional(),
            label: z.string().trim().min(1, 'Option label is required'),
            value: z.string().trim().min(1, 'Option value is required'),
            order: z.number().int(),
          })
        ).optional(),
      })
    ).min(1, 'At least one question is required').optional(),
  }),
});

export const submitResponseSchema = z.object({
  body: z.object({
    surveyId: z.string().uuid('Invalid survey ID format'),
    answers: z.array(
      z.object({
        questionId: z.number().int(),
        valueText: z.string().trim().optional(),
        valueNumber: z.number().optional(),
        selectedOptionId: z.number().int().optional(),
      })
    ).min(1, 'At least one answer is required'),
  }),
});

export const addQuestionSchema = z.object({
  body: z.object({
    type: z.nativeEnum(QuestionType),
    label: z.string().trim().min(1, 'Question label is required'),
    order: z.number().int(),
    required: z.boolean().optional().default(false),
    parent_question_id: z.number().int().nullable().optional(),
    trigger_option_id: z.number().int().nullable().optional(),
    options: z.array(
      z.object({
        label: z.string().trim().min(1, 'Option label is required'),
        value: z.string().trim().min(1, 'Option value is required'),
        order: z.number().int(),
      })
    ).optional(),
  }),
});
