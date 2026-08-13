import { Router } from 'express';
import { JobController } from './job.controller';
import { CandidateController } from './candidate.controller';
import { ApplicationController } from './application.controller';
import { OfferController } from './offer.controller';
import { AuditController } from './audit.controller';
import { verifyCandidateToken } from '../../middlewares/candidate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';

import { CareersController } from './careers.controller';

const router = Router();

// Careers public endpoints
router.get('/careers/jobs', CareersController.getPublicJobs);
router.get('/careers/jobs/:id', CareersController.getPublicJobById);
router.post('/applications/upload-resume', CareersController.uploadResume);
router.post('/applications', CareersController.submitApplication);

// Job endpoints
router.post('/jobs', JobController.createJob);
router.get('/jobs', JobController.getJobs);
router.get('/jobs/:id', JobController.getJobById);
router.put('/jobs/:id', JobController.updateJob);
router.post('/jobs/save-draft', JobController.saveNewDraft);
router.post('/jobs/:id/publish', JobController.publishJob);
router.post('/jobs/:id/archive', JobController.archiveJob);
router.post('/jobs/:id/save-draft', JobController.saveDraft);
router.get('/jobs/:id/candidates', JobController.getJobApplications);

// Candidate endpoints
router.post('/candidates', CandidateController.createCandidate);
router.post('/candidates/save-draft', CandidateController.saveDraft);
router.get('/candidates', CandidateController.getAllCandidates);
router.get('/candidates/:id', CandidateController.getCandidateById);
router.put('/candidates/:id', CandidateController.updateCandidate);

// Application endpoints
router.post('/admin/applications', ApplicationController.createApplication);
router.get('/applications', ApplicationController.getApplications);
router.get('/applications/:id', ApplicationController.getApplicationById);
router.patch('/applications/:id/status', ApplicationController.updateStatus);
router.put('/applications/:id/status', ApplicationController.updateStatus);
router.post('/applications/:id/reject', ApplicationController.rejectApplication);
router.post('/applications/:id/withdraw', ApplicationController.withdrawApplication);

// Offer endpoints
router.post('/offers', authenticate as any, OfferController.createOffer);
router.put('/offers/:id', authenticate as any, OfferController.updateOffer);
router.get('/offers/:id', authenticate as any, OfferController.getOfferById);
router.get('/offers', authenticate as any, OfferController.getOffers);
router.post('/offers/:id/publish', authenticate as any, OfferController.publishOffer);
router.post('/offers/:id/approve', authenticate as any, OfferController.approveOffer);
router.post('/offers/:id/release', authenticate as any, OfferController.releaseOffer);
router.post('/offers/:id/revise', authenticate as any, OfferController.reviseOffer);
router.post('/offers/expire', authenticate as any, OfferController.triggerExpiry);
router.get('/offers/:id/pdf', authenticate as any, OfferController.getPdf);

// Candidate Offer Portal
router.get('/portal/offers/:id', verifyCandidateToken, OfferController.getOfferById);
router.post('/portal/offers/:id/view', verifyCandidateToken, OfferController.viewOffer);
router.post('/portal/offers/:id/accept', verifyCandidateToken, OfferController.acceptOffer);
router.post('/portal/offers/:id/reject', verifyCandidateToken, OfferController.rejectOffer);
router.post('/portal/offers/:id/negotiate', verifyCandidateToken, OfferController.negotiateOffer);
router.get('/portal/offers/:id/pdf', verifyCandidateToken, OfferController.getPdf);

import { BgvController } from './bgv.controller';

// BGV & Onboarding
router.post('/bgv/initiate', authenticate as any, BgvController.initiateCase);
router.get('/bgv/case/:id', authenticate as any, BgvController.getCaseDetails);
router.post('/bgv/document/upload', authenticate as any, BgvController.uploadDocument);
router.post('/bgv/verification/update', authenticate as any, BgvController.updateVerification);
router.post('/bgv/review', authenticate as any, BgvController.addReview);
// Maintain backwards compatibility for existing simpler route if necessary
router.put('/bgv/update', CandidateController.updateBGVStatus);
router.post('/candidates/:id/documents', verifyCandidateToken, CandidateController.uploadDocument);
router.post('/candidates/:id/convert', CandidateController.convertToEmployee);
router.put('/candidates/:id/onboarding', verifyCandidateToken, CandidateController.updateOnboardingData);

// OTP Auth endpoints
router.post('/otp/generate', CandidateController.generateOTP);
router.post('/otp/verify', CandidateController.verifyOTP);

// External Candidate Portal endpoints
router.get('/portal/:id', verifyCandidateToken, CandidateController.getPortalDetails);

// Audit endpoints
router.get('/audit/events', AuditController.getEvents);

export default router;
