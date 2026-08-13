const fs = require('fs');

const appendContent = `
// ----------------------------------------------------
// RECRUITMENT & ONBOARDING (MVP)
// ----------------------------------------------------

model RecruitmentJob {
  id             Int         @id @default(autoincrement())
  organization_id Int?
  title          String
  department     String?
  location       String?
  status         String      @default("OPEN") // OPEN, CLOSED, DRAFT
  description    String?     @db.Text
  created_at     DateTime    @default(now())
  updated_at     DateTime    @updatedAt

  candidates     Candidate[]

  @@map("recruitment_jobs")
}

model Candidate {
  id              Int         @id @default(autoincrement())
  job_id          Int
  organization_id Int?
  first_name      String
  last_name       String
  email           String      @unique
  phone           String?
  status          String      @default("APPLIED") // APPLIED, INTERVIEW_SCHEDULED, SELECTED, OFFER_SENT, BGV_IN_PROGRESS, ONBOARDING, EMPLOYEE_CREATED, REJECTED, EXPIRED, WITHDRAWN
  joining_date    DateTime?
  otp_secret      String?
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  job             RecruitmentJob             @relation(fields: [job_id], references: [id])
  offers          CandidateOffer[]
  documents       CandidateDocument[]
  history         CandidateWorkflowHistory[]

  @@index([email])
  @@index([job_id])
  @@map("candidates")
}

model CandidateOffer {
  id              Int         @id @default(autoincrement())
  candidate_id    Int
  version         Int         @default(1)
  base_salary     Decimal?    @db.Decimal(15, 2)
  currency        String      @default("INR")
  status          String      @default("SENT") // SENT, ACCEPTED, REJECTED, EXPIRED, NEGOTIATING
  expiry_date     DateTime
  offer_document  String?     @db.Text
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  candidate       Candidate   @relation(fields: [candidate_id], references: [id], onDelete: Cascade)

  @@index([candidate_id])
  @@map("candidate_offers")
}

model CandidateDocument {
  id              Int         @id @default(autoincrement())
  candidate_id    Int
  document_type   String      // ID_PROOF, ADDRESS_PROOF, EDUCATION
  file_url        String      @db.Text
  status          String      @default("PENDING_VERIFICATION") // PENDING_VERIFICATION, VERIFIED, REJECTED
  uploaded_at     DateTime    @default(now())
  verified_at     DateTime?

  candidate       Candidate   @relation(fields: [candidate_id], references: [id], onDelete: Cascade)

  @@index([candidate_id])
  @@map("candidate_documents")
}

model CandidateWorkflowHistory {
  id              Int         @id @default(autoincrement())
  candidate_id    Int
  action          String
  previous_state  String
  new_state       String
  actor_type      String      // CANDIDATE, RECRUITER, HR, SYSTEM
  actor_id        Int?        // Optional user_id if triggered by internal staff
  ip_address      String?
  comments        String?     @db.Text
  created_at      DateTime    @default(now())

  candidate       Candidate   @relation(fields: [candidate_id], references: [id], onDelete: Cascade)

  @@index([candidate_id])
  @@map("candidate_workflow_history")
}
`;

fs.appendFileSync('e:\\\\Lattium Tech\\\\EMP\\\\employee-backend\\\\prisma\\\\schema.prisma', appendContent);
console.log('Appended successfully');
