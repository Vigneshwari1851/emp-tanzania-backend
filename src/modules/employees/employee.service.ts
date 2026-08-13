import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import bcrypt from 'bcrypt';
import { CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeQueryFilters } from '../../types/employee.types';
import { Prisma } from '@prisma/client';
import { config } from '../../config';

export class EmployeeService {
  async create(data: CreateEmployeeDTO, files?: { [fieldname: string]: Express.Multer.File[] }, orgId?: number) {
    const { email, password, username, status, role_id, team_id, bulk_upload, ...detailsData } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && !data.is_draft) {
      throw new AppError('Email is already in use', 400);
    }

    // --- Strict Validation ---
    const education = Array.isArray(detailsData.education) ? detailsData.education : JSON.parse(detailsData.education || '[]');
    const employment_history = Array.isArray(detailsData.employment_history) ? detailsData.employment_history : JSON.parse(detailsData.employment_history || '[]');

    if (!data.is_draft && !data.bulk_upload && education.length < 3) {
        throw new AppError('Minimum 3 education records are required (10th, 12th/Diploma, and 1st Degree).', 400);
    }

    // Verify education documents
    const eduDocs = files?.['education_docs'] || [];
    // Temporarily bypassed for testing
    // if (eduDocs.length < education.length) {
    //     throw new AppError(`Missing documents for education records. Expected ${education.length}, provided ${eduDocs.length}.`, 400);
    // }

    // Verify employment history documents
    if (employment_history.length > 0) {
      const empDocs = files?.['employment_docs'] || [];
      // Temporarily bypassed for testing
      // if (empDocs.length < employment_history.length) {
      //     throw new AppError(`Missing documents for employment history. Expected ${employment_history.length}, provided ${empDocs.length}.`, 400);
      // }
    }

    // Identity Documents Validation
    /* Temporarily bypassed for testing
    if (detailsData.passport_number && !files?.['passport_doc']) {
        throw new AppError('Passport document is required when Passport Number is entered.', 400);
    }
    if (detailsData.pan_number && !files?.['pan_doc']) {
        throw new AppError('PAN document is required when PAN Number is entered.', 400);
    }
    if (detailsData.aadhaar_number && !files?.['aadhaar_doc']) {
        throw new AppError('Aadhaar document is required when Aadhaar Number is entered.', 400);
    }
    if (detailsData.driving_license_number && !files?.['dl_doc']) {
        throw new AppError('Driving License document is required when Driving License Number is entered.', 400);
    }
    */
    // ------------------------

    // FK Validations
    if (detailsData.department_id) {
      const deptExists = await prisma.department.findFirst({
        where: {
          id: detailsData.department_id,
          ...(orgId ? { branches: { organization_id: orgId } } : {})
        }
      });
      if (!deptExists) throw new AppError('Invalid department_id. The specified department does not exist.', 400);
    }

    if (detailsData.reporting_manager_id) {
      const managerExists = await prisma.user.findFirst({
        where: {
          id: detailsData.reporting_manager_id,
          ...(orgId ? {
            details: {
              department: {
                branches: {
                  organization_id: orgId
                }
              }
            }
          } : {})
        }
      });
      if (!managerExists) throw new AppError('Invalid reporting_manager_id. The specified manager does not exist.', 400);
    }

    if (detailsData.payroll_group_id) {
      const groupExists = await prisma.payrollGroup.findFirst({
        where: {
          id: detailsData.payroll_group_id,
          ...(orgId ? { organization_id: orgId } : {})
        }
      });
      if (!groupExists) throw new AppError('Invalid payroll_group_id. The specified payroll group does not exist.', 400);
    }

    if (detailsData.designation_id) {
      const designationExists = await prisma.designation.findFirst({
        where: {
          id: Number(detailsData.designation_id),
          ...(orgId ? { organization_id: orgId } : {})
        }
      });
      if (!designationExists) throw new AppError('Invalid designation_id. The specified designation does not exist.', 400);
    }

    // Convert date strings to Date objects if provided
    if (detailsData.date_of_birth) detailsData.date_of_birth = new Date(detailsData.date_of_birth);
    if (detailsData.start_date) detailsData.start_date = new Date(detailsData.start_date);
    if (detailsData.passport_expiry_date) detailsData.passport_expiry_date = new Date(detailsData.passport_expiry_date);
    if (detailsData.license_expiry_date) detailsData.license_expiry_date = new Date(detailsData.license_expiry_date);

    if (!password) {
      throw new AppError('Password is required', 400);
    }

    // Auto-generate employee ID if not provided
    if (!detailsData.employee_id || String(detailsData.employee_id).trim() === '') {
      detailsData.employee_id = await this.generateNextEmployeeId();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const isDraftBool = String(data.is_draft) === 'true';
    const statusBool = isDraftBool
      ? false
      : (status !== undefined ? (String(status) === 'true') : true);

    return await prisma.$transaction(async (tx) => {
      // 1. Create the base User
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          username,
          status: statusBool,
        }
      });

      // 2. Process Files
      if (files) {
        if (files['profile_picture']) {
          detailsData.profile_picture = `/upload/${files['profile_picture'][0].filename}`;
        }
        if (files['resume']) {
          detailsData.resume = `/upload/${files['resume'][0].filename}`;
        }
        if (files['certificate_files']) {
          const certificateUrls = files['certificate_files'].map(file => `/upload/${file.filename}`);
          detailsData.certificate_files = certificateUrls;
        }
        if (files['documents']) {
          const documentUrls = files['documents'].map(file => `/upload/${file.filename}`);
          detailsData.documents = documentUrls;
        }
        if (files['passport_doc']) {
          detailsData.passport_doc = `/upload/${files['passport_doc'][0].filename}`;
        }
        if (files['dl_doc']) {
          detailsData.dl_doc = `/upload/${files['dl_doc'][0].filename}`;
        }
        if (files['pan_doc']) {
          detailsData.pan_doc = `/upload/${files['pan_doc'][0].filename}`;
        }
        if (files['aadhaar_doc']) {
          detailsData.aadhaar_doc = `/upload/${files['aadhaar_doc'][0].filename}`;
        }

        // Map education documents to records
        if (files['education_docs']) {
          const updatedEducation = education.map((edu: any, index: number) => {
            if (edu.fileIndex !== undefined) {
              const idx = Number(edu.fileIndex);
              if (files['education_docs']![idx]) {
                const updated = { ...edu, documentUrl: `/upload/${files['education_docs']![idx].filename}` };
                delete updated.fileIndex;
                return updated;
              }
            }
            if (files['education_docs']![index]) {
              return { ...edu, documentUrl: `/upload/${files['education_docs']![index].filename}` };
            }
            return edu;
          });
          detailsData.education = updatedEducation;
        }

        // Map employment documents to records
        if (files['employment_docs']) {
          const updatedEmployment = employment_history.map((emp: any, index: number) => {
            if (emp.fileIndex !== undefined) {
              const idx = Number(emp.fileIndex);
              if (files['employment_docs']![idx]) {
                const updated = { ...emp, documentUrl: `/upload/${files['employment_docs']![idx].filename}` };
                delete updated.fileIndex;
                return updated;
              }
            }
            if (files['employment_docs']![index]) {
              return { ...emp, documentUrl: `/upload/${files['employment_docs']![index].filename}` };
            }
            return emp;
          });
          detailsData.employment_history = updatedEmployment;
        }

        // Map certification documents to records
        const certifications = Array.isArray(detailsData.certifications) ? detailsData.certifications : (detailsData.certifications ? (typeof detailsData.certifications === 'string' ? JSON.parse(detailsData.certifications) : detailsData.certifications) : []);
        if (files['certification_docs'] && Array.isArray(certifications)) {
          const updatedCertifications = certifications.map((cert: any, index: number) => {
            if (cert.fileIndex !== undefined) {
              const idx = Number(cert.fileIndex);
              if (files['certification_docs']![idx]) {
                const updated = { ...cert, documentUrl: `/upload/${files['certification_docs']![idx].filename}` };
                delete updated.fileIndex;
                return updated;
              }
            }
            if (files['certification_docs']![index]) {
              return { ...cert, documentUrl: `/upload/${files['certification_docs']![index].filename}` };
            }
            return cert;
          });
          detailsData.certifications = updatedCertifications;
        } else if (certifications) {
          detailsData.certifications = certifications;
        }
      }

      // 3. Create the UserDetail attached to the User
      const userDetail = await tx.userDetail.create({
        data: {
          user_id: user.id,
          role_id: role_id ? Number(role_id) : undefined,
          team_id: team_id === null ? null : (team_id ? Number(team_id) : undefined),
          ...detailsData,
          designation_id: detailsData.designation_id ? Number(detailsData.designation_id) : undefined,
          is_draft: isDraftBool,
          payroll_group_id: detailsData.payroll_group_id ? Number(detailsData.payroll_group_id) : undefined
        }
      });

      if (role_id) {
        await tx.userRole.create({
          data: {
            user_id: user.id,
            role_id: Number(role_id)
          }
        });
      }

      return await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          created_at: true,
          roles: {
            include: { role: { select: { role_name: true } } }
          },
          details: {
            include: {
              role: { select: { role_name: true } }
            }
          }
        }
      });
    });
  }

  async getAll(filters: EmployeeQueryFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      is_deleted: false,
    };

    // Org scoping — filter users by their department's branch's organization, or allow if department is null
    if (filters.orgId) {
      where.details = {
        ...((where.details as Record<string, any>) || {}),
        OR: [
          {
            department: {
              branches: {
                organization_id: filters.orgId
              }
            }
          },
          {
            department_id: null
          }
        ]
      };
    }

    if (filters.search) {
      const searchTerms = String(filters.search).trim().split(' ').filter(Boolean);
      where.AND = searchTerms.map(term => ({
        OR: [
          { email: { contains: term } },
          { details: { first_name: { contains: term } } },
          { details: { last_name: { contains: term } } },
          { details: { country: { contains: term } } },
          { details: { employee_id: { contains: term } } },
        ]
      }));
    }

    // Helper to parse comma-separated or array inputs
    const parseArrayInput = (input: unknown): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map(String);
      if (typeof input === 'string') return input.split(',').map(i => i.trim());
      return [String(input)];
    };


    const departmentIds = parseArrayInput(filters.department).map(id => Number(id)).filter(id => !isNaN(id));
    if (departmentIds.length > 0) {
      where.details = {
        ...((where.details as Record<string, any>) || {}),
        department_id: { in: departmentIds }
      };
    }

    const roleIds = parseArrayInput(filters.role).map(id => Number(id)).filter(id => !isNaN(id));
    if (roleIds.length > 0) {
      where.roles = {
        some: { role_id: { in: roleIds } }
      };
    }

    const locations = parseArrayInput(filters.location);
    if (locations.length > 0) {
      where.details = {
        ...((where.details as Record<string, any>) || {}),
        work_location: { in: locations }
      };
    }

    const statuses = parseArrayInput(filters.status);
    if (statuses.length > 0) {
      const statusConditions = statuses.map(s => {
        const lower = String(s).toLowerCase();
        if (lower === 'active' || lower === 'true') return true;
        if (lower === 'inactive' || lower === 'false' || lower === 'on leave') return false;
        return null;
      }).filter(s => s !== null) as boolean[];

      if (statusConditions.length > 0) {
        const hasTrue = statusConditions.includes(true);
        const hasFalse = statusConditions.includes(false);
        if (hasTrue && !hasFalse) {
          where.status = true;
        } else if (hasFalse && !hasTrue) {
          where.status = false;
        }
      }
    }

    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc'
      },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        created_at: true,
        roles: {
          select: {
            role: {
              select: {
                role_name: true
              }
            }
          }
        },
        details: {
          select: {
            id: true,
            user_id: true,
            is_draft: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            profile_picture: true,
            date_of_birth: true,
            start_date: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            country: true,
            department_id: true,
            team_id: true,
            role_id: true,
            reporting_manager_id: true,
            employee_id: true,
            sub_status: true,
            designation_id: true,
            joining_date: true,
            probation_period: true,
            gender: true,
            blood_group: true,
            employment_type: true,
            work_location: true,
            base_salary: true,
            bank_name: true,
            account_number: true,
            ifsc_code: true,
            pan_number: true,
            aadhaar_number: true,
            shift_id: true,
            nationality: true,
            marital_status: true,
            secondary_phone: true,
            secondary_email: true,
            emergency_contact: true,
            emergency_relationship: true,
            emergency_phone: true,
            emergency_email: true,
            work_schedule: true,
            currency: true,
            salary_frequency: true,
            branch_name: true,
            account_holder_name: true,
            passport_number: true,
            passport_expiry_date: true,
            driving_license_number: true,
            license_expiry_date: true,
            esi_number: true,
            pf_uan: true,
            tax_regime: true,
            is_nri: true,
            is_senior_citizen: true,
            department: { select: { id: true, department_name: true } },
            team: { select: { id: true, team_name: true } },
            payroll_group: { select: { name: true } },
            user_types: { select: { name: true } },
            designation: {
              select: {
                id: true,
                designation_name: true,
                designation_code: true,
                secondary_parent: {
                  select: { id: true, designation_name: true, designation_code: true }
                }
              }
            },
            reporting_manager: {
              select: {
                username: true,
                details: { select: { user_id: true, first_name: true, last_name: true } }
              }
            },
            role: { select: { role_name: true } }
          }
        }
      }
    });

    const totalUsers = await prisma.user.count({ where });

    return {
      data: users,
      meta: {
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit)
      }
    };
  }

  async getById(id: number, orgId?: number) {
    const whereClause: Prisma.UserWhereInput = { id, is_deleted: false };
    if (orgId) {
      whereClause.OR = [
        { id }, // Always allow fetching your own profile or explicit user ID match
        {
          details: {
            OR: [
              { department: { branches: { organization_id: orgId } } },
              { department_id: null }
            ]
          }
        }
      ];
    }
    const user = await prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        created_at: true,
        // roles: {
        //   include: {
        //     role: { select: { role_name: true } }
        //   }
        // },
        details: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            date_of_birth: true,
            gender: true,
            nationality: true,
            marital_status: true,
            blood_group: true,
            phone: true,
            secondary_phone: true,
            secondary_email: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            country: true,
            secondary_address: true,
            secondary_city: true,
            secondary_state: true,
            secondary_zip: true,
            secondary_country: true,
            emergency_contact: true,
            emergency_relationship: true,
            emergency_phone: true,
            emergency_email: true,
            employee_id: true,
            department_id: true,
            team_id: true,
            role_id: true,
            employment_type: true,
            sub_status: true,
            start_date: true,
            work_location: true,
            work_schedule: true,
            reporting_manager_id: true,
            probation_period: true,
            base_salary: true,
            currency: true,
            salary_frequency: true,
            compensation_breakdown: true,
            family_members: true,
            education: true,
            employment_history: true,
            passport_number: true,
            passport_expiry_date: true,
            driving_license_number: true,
            license_expiry_date: true,
            pan_number: true,
            aadhaar_number: true,
            bank_name: true,
            branch_name: true,
            account_holder_name: true,
            account_number: true,
            ifsc_code: true,
            skills: true,
            certifications: true,
            languages: true,
            profile_picture: true,
            resume: true,
            certificate_files: true,
            documents: true,
            passport_doc: true,
            dl_doc: true,
            pan_doc: true,
            aadhaar_doc: true,
            esi_number: true,
            pf_uan: true,
            tax_regime: true,
            is_nri: true,
            is_senior_citizen: true,
            designation_id: true,
            joining_date: true,
            department: { select: { id: true, department_name: true } },
            team: { select: { id: true, team_name: true } },
            designation: {
              select: {
                id: true,
                designation_name: true,
                designation_code: true,
                secondary_parent: {
                  select: { id: true, designation_name: true, designation_code: true }
                }
              }
            },
            reporting_manager: {
              select: {
                username: true,
                details: {
                  select: {
                    first_name: true,
                    last_name: true,
                    designation: {
                      select: { designation_name: true }
                    }
                  }
                }
              }
            },
            role: { select: { role_name: true } }
          }
        }
      }
    });

    if (!user) throw new AppError('Employee not found', 404);

    return user;
  }

  async update(id: number, data: UpdateEmployeeDTO, files?: { [fieldname: string]: Express.Multer.File[] }, orgId?: number) {
    const { email, username, status, password, role_id, team_id, ...detailsData } = data;

    const isDraftBool = data.is_draft !== undefined ? (String(data.is_draft) === 'true') : undefined;
    let statusBool: boolean | undefined = undefined;
    if (status !== undefined) {
      statusBool = String(status) === 'true';
    } else if (isDraftBool === false) {
      statusBool = true;
    }

    // Verify employee exists
    const employeeWhere: Prisma.UserWhereInput = { id, is_deleted: false };
    if (orgId) {
      employeeWhere.details = {
        OR: [
          { department: { branches: { organization_id: orgId } } },
          { department_id: null }
        ]
      };
    }
    const employee = await prisma.user.findFirst({ where: employeeWhere, include: { details: true } });
    if (!employee) throw new AppError('Employee not found', 404);

    // Verify email duplicate if email is being updated
    if (email) {
      const emailExists = await prisma.user.findFirst({
        where: { email, id: { not: id }, is_deleted: false }
      });
      if (emailExists) throw new AppError('Email is already in use by another employee', 400);
    }

    // Process password update if provided
    let hashedPassword: string | undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Process Files
    if (files) {
      if (files['profile_picture']) {
        detailsData.profile_picture = `/upload/${files['profile_picture'][0].filename}`;
      }
      if (files['resume']) {
        detailsData.resume = `/upload/${files['resume'][0].filename}`;
      }
      if (files['certificate_files']) {
        const certificateUrls = files['certificate_files'].map(file => `/upload/${file.filename}`);
        detailsData.certificate_files = certificateUrls;
      }
      if (files['documents']) {
        const documentUrls = files['documents'].map(file => `/upload/${file.filename}`);
        detailsData.documents = documentUrls;
      }
      if (files['passport_doc']) {
        detailsData.passport_doc = `/upload/${files['passport_doc'][0].filename}`;
      }
      if (files['dl_doc']) {
        detailsData.dl_doc = `/upload/${files['dl_doc'][0].filename}`;
      }
      if (files['pan_doc']) {
        detailsData.pan_doc = `/upload/${files['pan_doc'][0].filename}`;
      }
      if (files['aadhaar_doc']) {
        detailsData.aadhaar_doc = `/upload/${files['aadhaar_doc'][0].filename}`;
      }

      // Map education documents to records if provided as JSON
      const education = Array.isArray(detailsData.education) ? detailsData.education : (detailsData.education ? JSON.parse(detailsData.education) : []);
      if (files['education_docs']) {
        const updatedEducation = education.map((edu: any, index: number) => {
          if (edu.fileIndex !== undefined) {
            const idx = Number(edu.fileIndex);
            if (files['education_docs']![idx]) {
              const updated = { ...edu, documentUrl: `/upload/${files['education_docs']![idx].filename}` };
              delete updated.fileIndex;
              return updated;
            }
          }
          if (files['education_docs']![index]) {
            return { ...edu, documentUrl: `/upload/${files['education_docs']![index].filename}` };
          }
          return edu;
        });
        detailsData.education = updatedEducation;
      }

      // Map employment documents to records if provided as JSON
      const employment_history = Array.isArray(detailsData.employment_history) ? detailsData.employment_history : (detailsData.employment_history ? JSON.parse(detailsData.employment_history) : []);
      if (files['employment_docs']) {
        const updatedEmployment = employment_history.map((emp: any, index: number) => {
          if (emp.fileIndex !== undefined) {
            const idx = Number(emp.fileIndex);
            if (files['employment_docs']![idx]) {
              const updated = { ...emp, documentUrl: `/upload/${files['employment_docs']![idx].filename}` };
              delete updated.fileIndex;
              return updated;
            }
          }
          if (files['employment_docs']![index]) {
            return { ...emp, documentUrl: `/upload/${files['employment_docs']![index].filename}` };
          }
          return emp;
        });
        detailsData.employment_history = updatedEmployment;
      }

      // Map certification documents to records if provided as JSON
      const certifications = Array.isArray(detailsData.certifications) ? detailsData.certifications : (detailsData.certifications ? (typeof detailsData.certifications === 'string' ? JSON.parse(detailsData.certifications) : detailsData.certifications) : []);
      if (files['certification_docs'] && Array.isArray(certifications)) {
        const updatedCertifications = certifications.map((cert: any, index: number) => {
          if (cert.fileIndex !== undefined) {
            const idx = Number(cert.fileIndex);
            if (files['certification_docs']![idx]) {
              const updated = { ...cert, documentUrl: `/upload/${files['certification_docs']![idx].filename}` };
              delete updated.fileIndex;
              return updated;
            }
          }
          if (files['certification_docs']![index]) {
            return { ...cert, documentUrl: `/upload/${files['certification_docs']![index].filename}` };
          }
          return cert;
        });
        detailsData.certifications = updatedCertifications;
      } else if (certifications) {
        detailsData.certifications = certifications;
      }
    }

    // FK Validations
    if (detailsData.employee_id) {
      const empExists = await prisma.userDetail.findUnique({ where: { employee_id: detailsData.employee_id } });
      if (empExists && empExists.user_id !== id) throw new AppError('employee_id is already in use by another employee', 400);
    }

    if (detailsData.payroll_group_id) {
      const groupExists = await prisma.payrollGroup.findUnique({ where: { id: detailsData.payroll_group_id } });
      if (!groupExists) throw new AppError('Invalid payroll_group_id. The specified payroll group does not exist.', 400);
    }

    if (detailsData.department_id) {
      const deptExists = await prisma.department.findUnique({ where: { id: detailsData.department_id } });
      if (!deptExists) throw new AppError('Invalid department_id. The specified department does not exist.', 400);
    }

    if (detailsData.designation_id) {
      const designationExists = await prisma.designation.findUnique({ where: { id: Number(detailsData.designation_id) } });
      if (!designationExists) throw new AppError('Invalid designation_id. The specified designation does not exist.', 400);
    }

    if (detailsData.reporting_manager_id) {
      const managerExists = await prisma.user.findUnique({ where: { id: detailsData.reporting_manager_id } });
      if (!managerExists) throw new AppError('Invalid reporting_manager_id. The specified manager does not exist.', 400);
    }

    // Date casting
    if (detailsData.date_of_birth) detailsData.date_of_birth = new Date(detailsData.date_of_birth);
    if (detailsData.start_date) detailsData.start_date = new Date(detailsData.start_date);
    if (detailsData.passport_expiry_date) detailsData.passport_expiry_date = new Date(detailsData.passport_expiry_date);
    if (detailsData.license_expiry_date) detailsData.license_expiry_date = new Date(detailsData.license_expiry_date);

    return await prisma.$transaction(async (tx) => {
      // 1. Update User (if email, username, status, or password modified)
      if (email !== undefined || username !== undefined || statusBool !== undefined || hashedPassword !== undefined) {
        await tx.user.update({
          where: { id },
          data: {
            ...(email !== undefined && { email }),
            ...(username !== undefined && { username }),
            ...(statusBool !== undefined && { status: statusBool }),
            ...(hashedPassword !== undefined && { password: hashedPassword })
          }
        });
      }

      // 2. Update or Create UserDetail
      if (employee.details) {
        await tx.userDetail.update({
          where: { user_id: id },
          data: {
            role_id: role_id === null ? null : (role_id ? Number(role_id) : undefined),
            team_id: team_id === null ? null : (team_id ? Number(team_id) : undefined),
            ...detailsData,
            designation_id: detailsData.designation_id === null ? null : (detailsData.designation_id ? Number(detailsData.designation_id) : undefined),
            ...(role_id && { role_id: Number(role_id) }),
            payroll_group_id: detailsData.payroll_group_id ? Number(detailsData.payroll_group_id) : undefined,
            ...(isDraftBool !== undefined && { is_draft: isDraftBool })
          }
        });
      } else {
        await tx.userDetail.create({
          data: {
            user_id: id,
            role_id: role_id ? Number(role_id) : undefined,
            team_id: team_id ? Number(team_id) : undefined,
            ...detailsData
          }
        });
      }

      // Team and Role assignments are handled via the team_id and role_id fields in UserDetail above.

      if (role_id) {
        await tx.userRole.deleteMany({ where: { user_id: id } });
        await tx.userRole.create({
          data: {
            user_id: id,
            role_id: Number(role_id)
          }
        });
      }

      return await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          roles: {
            include: { role: { select: { role_name: true } } }
          },
          details: {
            include: {
              department: { select: { id: true, department_name: true } },
              team: { select: { id: true, team_name: true } },
              role: { select: { role_name: true } }
            }
          }
        }
      });
    });
  }

  async delete(id: number, orgId?: number) {
    const employeeWhere: Prisma.UserWhereInput = { id, is_deleted: false };
    if (orgId) {
      employeeWhere.details = {
        OR: [
          { department: { branches: { organization_id: orgId } } },
          { department_id: null }
        ]
      };
    }
    const employee = await prisma.user.findFirst({ where: employeeWhere });
    if (!employee) throw new AppError('Employee not found', 404);

    return await prisma.$transaction(async (tx) => {
      // 1. Soft delete the user
      await tx.user.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date()
        }
      });

      return { message: 'Employee deleted successfully' };
    });
  }

  async generateNextEmployeeId() {
    const currentYear = new Date().getFullYear();
    const prefix = `EMP-${currentYear}-`;

    const lastEmployee = await prisma.userDetail.findFirst({
      where: {
        employee_id: {
          startsWith: prefix
        }
      },
      orderBy: {
        employee_id: 'desc'
      },
      select: {
        employee_id: true
      }
    });

    let nextSequence = 1;
    if (lastEmployee && lastEmployee.employee_id) {
      const parts = lastEmployee.employee_id.split('-');
      if (parts.length === 3) {
        const lastSequence = parseInt(parts[2], 10);
        if (!isNaN(lastSequence)) {
          nextSequence = lastSequence + 1;
        }
      }
    }

    const paddedSequence = String(nextSequence).padStart(3, '0');
    return `${prefix}${paddedSequence}`;
  }

  async getByTeamId(teamId: number) {
    const details = await prisma.userDetail.findMany({
      where: {
        team_id: teamId,
        user: {
          is_deleted: false
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            status: true
          }
        },
        role: {
          select: {
            role_name: true
          }
        }
      }
    });

    // Map the results to match the standard Employee structure expected by the frontend
    return details.map(detail => ({
      ...detail.user,
      details: {
        ...detail,
        role: detail.role // Ensure role is nested inside details for the frontend mapper
      }
    }));
  }

  async checkDuplicate(email?: string, phone?: string) {
    const results: { emailExists: boolean; phoneExists: boolean } = {
      emailExists: false,
      phoneExists: false
    };

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true }
      });
      results.emailExists = !!user;
    }

    if (phone) {
      const detail = await prisma.userDetail.findFirst({
        where: { phone },
        select: { id: true }
      });
      results.phoneExists = !!detail;
    }

    return results;
  }

  async getCelebrations(orgId?: number) {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed (Jan = 0)
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    const where: Prisma.UserWhereInput = {
      is_deleted: false,
      status: true,
    };

    if (orgId) {
      where.details = {
        OR: [
          {
            department: {
              branches: {
                organization_id: orgId
              }
            }
          },
          {
            department_id: null
          }
        ]
      };
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        details: true
      }
    });

    const celebrations: any[] = [];

    for (const u of users) {
      if (!u.details) continue;
      const details = u.details;
      const name = `${details.first_name || ''} ${details.last_name || ''}`.trim() || u.username || 'Employee';
      const initial = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

      // Birthday
      if (details.date_of_birth) {
        const dob = new Date(details.date_of_birth);
        if (dob.getMonth() === currentMonth && dob.getDate() === currentDay) {
          celebrations.push({
            id: `dob-${u.id}`,
            employeeId: u.id,
            name,
            type: 'birthday',
            label: 'Birthday',
            dateText: 'Today',
            daysRemaining: 0,
            initial,
          });
        }
      }

      // Anniversary or New Joiner
      const doj = details.joining_date || details.start_date;
      if (doj) {
        const dojDate = new Date(doj);
        if (dojDate.getMonth() === currentMonth && dojDate.getDate() === currentDay) {
          if (dojDate.getFullYear() < currentYear) {
            const years = currentYear - dojDate.getFullYear();
            celebrations.push({
              id: `anniv-${u.id}`,
              employeeId: u.id,
              name,
              type: 'anniversary',
              label: 'Work Anniversary',
              dateText: 'Today',
              daysRemaining: 0,
              initial,
              years,
            });
          } else if (dojDate.getFullYear() === currentYear) {
            celebrations.push({
              id: `new_joiner-${u.id}`,
              employeeId: u.id,
              name,
              type: 'new_joiner',
              label: 'New Joiner',
              dateText: 'Today',
              daysRemaining: 0,
              initial,
            });
          }
        }
      }
    }

    return celebrations;
  }
}

export const employeeService = new EmployeeService();
