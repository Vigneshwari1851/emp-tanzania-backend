import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { surveyService } from './survey.service';
import { sendResponse } from '../../utils/response.util';
import { auditService } from '../audit/audit.service';

// Standalone audit helper (fire-and-forget)
function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
  auditService.log({
    module: 'SURVEY',
    action,
    entityId: entityId.toString(),
    actorId: req.user?.id || 0,
    newValue,
    oldValue,
    ipAddress: req.ip,
  }).catch((err) => { 
    console.error('Audit Log Error:', err); 
  });
}

/** Build a full audit snapshot from a survey */
function _surveySnapshot(survey: any) {
  if (!survey) return null;
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    is_active: survey.is_active,
    access: survey.access,
    start_date: survey.start_date,
    end_date: survey.end_date,
    target_department: survey.target_department,
    is_clone: survey.is_clone,
    cloned_from_id: survey.cloned_from_id,
    theme_preset: survey.theme_preset,
    created_by: survey.created_by,
    creator_name: survey.creator ? `${survey.creator.details?.first_name || ''} ${survey.creator.details?.last_name || ''}`.trim() : null,
    question_count: survey.questions?.length || 0,
  };
}

export const createSurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    const survey = await surveyService.create(userId, req.body);
    _audit(req, 'SURVEY_CREATED', survey.id, _surveySnapshot(survey));
    sendResponse(res, 201, true, 'Survey created and published successfully', survey);
  } catch (err) {
    next(err);
  }
};

export const updateSurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const oldSurvey = await surveyService.getById(id);
    const survey = await surveyService.update(id, req.body);
    _audit(req, 'SURVEY_UPDATED', id, _surveySnapshot(survey), _surveySnapshot(oldSurvey));
    sendResponse(res, 200, true, 'Survey updated successfully', survey);
  } catch (err: any) {
    // Treat "Cannot modify questions" as a bad request rather than generic 500 if we want, but letting standard error handler catch it is fine for now
    next(err);
  }
};

export const cloneSurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const userId = Number(req.user?.id);
    const survey = await surveyService.clone(userId, id);
    _audit(req, 'SURVEY_CLONED', survey.id, _surveySnapshot(survey), { source_survey_id: id });
    sendResponse(res, 201, true, 'Survey cloned successfully', survey);
  } catch (err) {
    next(err);
  }
};

export const copySurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const userId = Number(req.user?.id);
    const survey = await surveyService.duplicate(userId, id);
    _audit(req, 'SURVEY_COPIED', survey.id, _surveySnapshot(survey), { source_survey_id: id });
    sendResponse(res, 201, true, 'Survey copied successfully', survey);
  } catch (err) {
    next(err);
  }
};

export const shareSurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const survey = await surveyService.getById(id);
    if (!survey) {
      return sendResponse(res, 404, false, 'Survey not found', null);
    }
    const { method } = req.body; // e.g. "link" or "embed"
    _audit(req, 'SURVEY_SHARED', id, { share_method: method, title: survey.title });
    sendResponse(res, 200, true, 'Survey share logged successfully');
  } catch (err) {
    next(err);
  }
};

export const listSurveys = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    const roles = req.user?.roles || [];
    const orgId = req.user?.orgId;
    
    const filters = {
      status: req.query.status as string,
      department: req.query.department as string,
    };
    
    const surveys = await surveyService.list(userId, roles, filters, orgId || undefined);
    sendResponse(res, 200, true, 'Surveys retrieved successfully', surveys);
  } catch (err) {
    next(err);
  }
};

export const getSurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const survey = await surveyService.getById(id);
    if (!survey) {
      return sendResponse(res, 404, false, 'Survey not found', null);
    }
    // _audit(req, 'SURVEY_VIEWED', id, { title: survey.title });
    sendResponse(res, 200, true, 'Survey details retrieved successfully', survey);
  } catch (err) {
    next(err);
  }
};

export const submitResponse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    const { surveyId, answers } = req.body;
    const response = await surveyService.submitResponse(userId, String(surveyId), answers);
    _audit(req, 'SURVEY_RESPONSE_SUBMITTED', response.id, { survey_id: surveyId, answer_count: answers?.length || 0 });
    sendResponse(res, 201, true, 'Survey feedback submitted successfully', response);
  } catch (err) {
    next(err);
  }
};

export const addQuestion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const surveyId = String(req.params.surveyId);
    const question = await surveyService.addQuestion(surveyId, req.body);
    _audit(req, 'SURVEY_QUESTION_ADDED', surveyId, { question_id: question.id, question_label: question.label, type: question.type });
    sendResponse(res, 201, true, 'Question added successfully', question);
  } catch (err) {
    next(err);
  }
};

export const getSurveyResponses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const surveyId = String(req.params.surveyId);
    const responses = await surveyService.getResponses(surveyId);
    sendResponse(res, 200, true, 'Survey responses retrieved successfully', responses);
  } catch (err) {
    next(err);
  }
};

export const closeSurvey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const survey = await surveyService.close(id);
    _audit(req, 'SURVEY_CLOSED', id, _surveySnapshot(survey));
    sendResponse(res, 200, true, 'Survey campaign closed successfully', survey);
  } catch (err) {
    next(err);
  }
};

// Public endpoints (no auth required)

export const getPublicSurvey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const survey = await surveyService.getById(id);
    if (!survey) {
      return sendResponse(res, 404, false, 'Survey not found', null);
    }
    if (!survey.is_active) {
      return sendResponse(res, 403, false, 'This survey is closed.', null);
    }
    sendResponse(res, 200, true, 'Survey details retrieved successfully', survey);
  } catch (err) {
    next(err);
  }
};

export const submitPublicResponse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { surveyId, answers } = req.body;
    const response = await surveyService.submitResponse(null, String(surveyId), answers);
    _audit(req, 'SURVEY_PUBLIC_RESPONSE_SUBMITTED', response.id, { survey_id: surveyId, answer_count: answers?.length || 0 });
    sendResponse(res, 201, true, 'Survey feedback submitted successfully', response);
  } catch (err) {
    next(err);
  }
};
