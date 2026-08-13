import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

export const validateRequest = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            }) as any;

            if (parsed.body) req.body = parsed.body;
            if (parsed.query) Object.assign(req.query, parsed.query);
            if (parsed.params) Object.assign(req.params, parsed.params);

            return next();
        } catch (error: unknown) {

            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message
                }));

                return next(new AppError('Validation Error', 400, formattedErrors));
            }

            return next(error);
        }
    };
};