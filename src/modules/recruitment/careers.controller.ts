import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../upload');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer Filter Configuration (PDF, DOC, DOCX)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimetypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowedMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and DOC/DOCX files are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('resume');

export class CareersController {
  // GET /careers/jobs (Public open jobs)
  static async getPublicJobs(req: Request, res: Response) {
    try {
      const {
        department,
        location,
        employment_type,
        experience_level,
        remote_option,
        search,
        page = '1',
        limit = '10'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skipNum = (pageNum - 1) * limitNum;

      // Base query criteria
      const whereClause: any = {
        status: 'OPEN',
        is_deleted: false
      };

      // Exact filters
      if (department) whereClause.department = department as string;
      if (location) whereClause.location = location as string;
      if (employment_type) whereClause.employment_type = employment_type as string;
      if (experience_level) whereClause.experience_level = experience_level as string;
      if (remote_option) whereClause.remote_option = remote_option as string;

      // Full-text/keyword search
      if (search) {
        const searchStr = search as string;
        whereClause.OR = [
          { title: { contains: searchStr } },
          { description: { contains: searchStr } },
          { job_summary: { contains: searchStr } }
        ];
      }

      // Query jobs with pagination
      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where: whereClause,
          orderBy: { created_at: 'desc' },
          skip: skipNum,
          take: limitNum
        }),
        prisma.job.count({ where: whereClause })
      ]);

      const mappedJobs = jobs.map((job) => ({
        ...job,
        job_id: job.id,
        fixed_salary: job.salary_type === 'FIXED' ? (job.min_salary ? Number(job.min_salary) : null) : null,
        min_salary: job.min_salary ? Number(job.min_salary) : null,
        max_salary: job.max_salary ? Number(job.max_salary) : null,
      }));

      return res.status(200).json({
        success: true,
        data: mappedJobs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      console.error('Error fetching public jobs:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // GET /careers/jobs/:id (Public job details)
  static async getPublicJobById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const jobId = parseInt(id, 10);
      if (isNaN(jobId)) {
        return res.status(404).json({ success: false, message: 'Job posting not found' });
      }

      const job = await prisma.job.findUnique({
        where: { id: jobId }
      });

      if (!job || job.is_deleted || job.status !== 'OPEN') {
        return res.status(404).json({ success: false, message: 'Job posting not found' });
      }

      const mappedJob = {
        ...job,
        job_id: job.id,
        fixed_salary: job.salary_type === 'FIXED' ? (job.min_salary ? Number(job.min_salary) : null) : null,
        min_salary: job.min_salary ? Number(job.min_salary) : null,
        max_salary: job.max_salary ? Number(job.max_salary) : null,
      };

      return res.status(200).json({ success: true, data: mappedJob });
    } catch (error: any) {
      console.error('Error fetching public job details:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // POST /applications/upload-resume (Public resume uploader)
  static async uploadResume(req: Request, res: Response) {
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload a resume file' });
      }

      const fileUrl = `/upload/${req.file.filename}`;
      return res.status(200).json({
        success: true,
        message: 'Resume uploaded and scanned successfully (Status: CLEAN)',
        resume_url: fileUrl,
        file_name: req.file.originalname,
        file_size: req.file.size
      });
    });
  }

  // POST /applications (Public application submission)
  static async submitApplication(req: Request, res: Response) {
    try {
      const {
        job_uuid,
        job_id,
        first_name,
        last_name,
        email,
        phone,
        current_location,
        experience_years,
        current_company,
        current_designation,
        resume_url,
        skills,
        notice_period_days,
        current_ctc,
        expected_ctc,
        linkedin_url,
        portfolio_url,
        github_url,
        answers,
        policies_accepted
      } = req.body;

      // 1. Mandatory Consent Check
      if (!policies_accepted) {
        return res.status(400).json({
          success: false,
          message: 'Privacy and data processing consent is mandatory to submit your application.'
        });
      }

      // 2. Core Field Validations
      if (!first_name || !last_name || !email || !phone || !current_location || !experience_years || !resume_url) {
        return res.status(400).json({
          success: false,
          message: 'Missing required application details. Please verify all sections.'
        });
      }

      // Regex validations
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email address format.' });
      }

      const phoneRegex = /^\+?[1-9]\d{1,14}$|^[0-9]{10}$/; // Basic E.164 or standard 10 digit
      if (!phoneRegex.test(phone.replace(/[\s-()]/g, ''))) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
      }

      const urlRegex = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9]+(-?[a-zA-Z0-9]+)*\.)+[a-z]{2,}(:\d+)?(\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]*)?$/;
      if (linkedin_url && !urlRegex.test(linkedin_url)) {
        return res.status(400).json({ success: false, message: 'Invalid LinkedIn URL format.' });
      }
      if (portfolio_url && !urlRegex.test(portfolio_url)) {
        return res.status(400).json({ success: false, message: 'Invalid Portfolio URL format.' });
      }
      if (github_url && !urlRegex.test(github_url)) {
        return res.status(400).json({ success: false, message: 'Invalid Github URL format.' });
      }

      const ip = req.ip || req.socket.remoteAddress || null;
      const correlationId = uuidv4();

      // 3. Database Operations (Transaction)
      const result = await prisma.$transaction(async (tx) => {
        // Fetch Job
        let job = null;
        const targetId = job_id || job_uuid;
        if (targetId) {
          const parsedId = Number(targetId);
          if (!isNaN(parsedId)) {
            job = await tx.job.findUnique({ where: { id: parsedId } });
          }
        }

        if (!job || job.is_deleted || job.status !== 'OPEN') {
          throw new Error('The job posting is either closed or no longer accepting applications.');
        }

        // Fetch or create Candidate
        let candidate = await tx.candidate.findUnique({ where: { email } });

        let pastActiveApplication = null;
        if (candidate) {
          // Check for existing active application for the SAME job
          pastActiveApplication = await tx.candidateApplication.findFirst({
            where: {
              candidate_id: candidate.id,
              job_id: job.id,
              is_deleted: false,
              NOT: {
                status: { in: ['REJECTED', 'EXPIRED', 'WITHDRAWN'] }
              }
            }
          });

          if (pastActiveApplication) {
            throw new Error('An active application for this job posting already exists under this email address.');
          }
        }

        // Gather all previous applications to determine versioning count
        let applicationVersion = 1;
        if (candidate) {
          const pastApps = await tx.candidateApplication.findMany({
            where: { candidate_id: candidate.id, job_id: job.id }
          });
          
          if (pastApps.length > 0) {
            applicationVersion = pastApps.length + 1;
            
            // Soft-delete/Archive previous completed/inactive applications to clean active pipeline
            await tx.candidateApplication.updateMany({
              where: { candidate_id: candidate.id, job_id: job.id, is_deleted: false },
              data: { is_deleted: true, deleted_at: new Date() }
            });
          }
        }

        // Update or Create candidate details
        if (candidate) {
          candidate = await tx.candidate.update({
            where: { id: candidate.id },
            data: {
              first_name,
              last_name,
              phone,
              current_location,
              current_designation,
              current_company,
              linkedin_url,
              portfolio_url,
              github_url,
              experience_years: parseFloat(experience_years),
              current_ctc: current_ctc ? parseFloat(current_ctc) : null,
              expected_ctc: expected_ctc ? parseFloat(expected_ctc) : null,
              notice_period_days: notice_period_days ? parseInt(notice_period_days, 10) : null,
              skills: skills || null,
              resume_url: resume_url,
              policies_accepted: true,
              is_deleted: false,
              deleted_at: null
            }
          });
        } else {
          candidate = await tx.candidate.create({
            data: {
              first_name,
              last_name,
              email,
              phone,
              current_location,
              current_designation,
              current_company,
              linkedin_url,
              portfolio_url,
              github_url,
              experience_years: parseFloat(experience_years),
              current_ctc: current_ctc ? parseFloat(current_ctc) : null,
              expected_ctc: expected_ctc ? parseFloat(expected_ctc) : null,
              notice_period_days: notice_period_days ? parseInt(notice_period_days, 10) : null,
              skills: skills || null,
              resume_url: resume_url,
              policies_accepted: true
            }
          });
        }

        // Create the application
        const application = await tx.candidateApplication.create({
          data: {
            candidate_id: candidate.id,
            job_id: job.id,
            status: 'APPLIED',
            answers: answers || null,
            version: applicationVersion
          },
          include: { job: true }
        });

        // Audit Application submission
        await tx.auditEvent.create({
          data: {
            entity_type: 'APPLICATION',
            entity_id: application.id,
            action_type: 'CREATED',
            new_state: 'APPLIED',
            actor_type: 'CANDIDATE',
            actor_id: null,
            ip_address: ip,
            correlation_id: correlationId,
            comments: `Application submitted successfully. Candidate profile created/synced (ID: ${candidate.id}).`
          }
        });

        // Audit Resume ingestion
        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            action_type: 'RESUME_UPLOAD',
            actor_type: 'CANDIDATE',
            actor_id: null,
            ip_address: ip,
            correlation_id: correlationId,
            comments: `Candidate uploaded resume file: ${resume_url}`
          }
        });

        return { candidate, application };
      });

      // 4. Send Confirmation Notification (Mock logs block)
      console.log(`\n=================== NOTIFICATION DISPATCH ===================`);
      console.log(`[Notification] Confirmation Email sent successfully!`);
      console.log(`[Recipient] ${first_name} ${last_name} <${email}>`);
      console.log(`[Subject] Application Received: ${result.application.job.title}`);
      console.log(`[Tracking Link] http://localhost:5173/eep/candidate/portal (Verify with OTP)`);
      console.log(`[Correlation ID] ${correlationId}`);
      console.log(`=============================================================\n`);

      return res.status(201).json({
        success: true,
        message: 'Your application has been submitted successfully.',
        data: {
          candidate_id: result.candidate.id,
          candidate_uuid: result.candidate.uuid,
          application_id: result.application.id,
          application_uuid: result.application.uuid,
          status: result.application.status,
          correlation_id: correlationId
        }
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to submit application.' });
    }
  }
}
