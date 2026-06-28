export type Role = "citizen" | "lawyer" | "admin";

export interface PublicUser {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  status: "active" | "suspended" | "banned" | "pending";
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

/** Shape returned by token-issuing endpoints (refresh token is in the cookie). */
export interface AuthSession {
  accessToken: string;
  redirectTo: string;
  user: PublicUser;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

// ---- Feature response types -------------------------------------------------
export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  citations: string[];
  feedback?: "up" | "down" | null;
  createdAt: string;
}

export interface ChatSendResult {
  sessionId: string;
  title: string | null;
  userMessage: { id: string; text: string; createdAt: string };
  aiMessage: { id: string; text: string; citations: string[]; createdAt: string };
  practiceArea: string;
}

export interface LawyerCard {
  id: string;
  fullName: string;
  photoUrl: string | null;
  verified: boolean;
  practiceAreas: string[];
  languages: string[];
  city: string;
  province: string;
  ratingAvg: number;
  reviewCount: number;
  consultationFeePkr: number;
  availability: "online" | "busy" | "offline";
  experienceLabel: string;
}

export interface LawyerListResult {
  items: LawyerCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReviewItem {
  id: string;
  rating: number;
  text: string | null;
  caseType: string;
  date: string;
}

export interface LawyerDetail {
  id: string;
  fullName: string;
  photoUrl: string | null;
  verified: boolean;
  bio: string;
  practiceAreas: string[];
  languages: string[];
  city: string;
  province: string;
  experienceLabel: string;
  barCouncilNumberMasked: string;
  consultationFeePkr: number;
  availability: "online" | "busy" | "offline";
  ratingAvg: number;
  reviewCount: number;
  showWinLossStats: boolean;
  winLoss: { total: number; won: number; lost: number; ongoing: number } | null;
  reviewsRemoved: number;
}

export interface LawyerDetailResult {
  lawyer: LawyerDetail;
  reviews: { items: ReviewItem[]; total: number; page: number; pageSize: number; totalPages: number };
}

export interface NotificationItem {
  id: string;
  type: string;
  text: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
}

export interface FullProfile {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  province: string | null;
  profilePhotoUrl: string | null;
  twoFactorEnabled: boolean;
  status: string;
}

// ---- Lawyer portal types ----------------------------------------------------
export interface LawyerRequest {
  id: string;
  clientFirstName: string;
  caseType: string;
  description: string;
  status: string;
  declineReason: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface LawyerDashboard {
  metrics: { consultationsThisWeek: number; totalEarningsPkr: number; profileViews30: number; avgRating: number };
  availability: "online" | "busy" | "offline";
  pendingRequests: Omit<LawyerRequest, "status" | "declineReason">[];
  pendingCount: number;
  activeCases: { id: string; clientFirstName: string; caseType: string; startedAt: string }[];
  activeCount: number;
  recentReviews: { id: string; rating: number; text: string | null; date: string }[];
}

export interface LawyerCaseItem {
  id: string;
  clientFirstName: string;
  caseType: string;
  startedAt: string;
  closedAt: string | null;
  review: { rating: number } | null;
}

export interface LawyerConsultation {
  id: string;
  status: "active" | "closed";
  clientFirstName: string;
  caseType: string;
  description: string | null;
  startedAt: string;
  closedAt: string | null;
  caseNotes: string;
  sharedDocuments: unknown[];
}

export interface LawyerEarnings {
  summary: { thisMonth: number; lastMonth: number; allTime: number; pendingPayout: number };
  chart: { month: string; total: number }[];
  transactions: {
    id: string; consultationId: string; client: string; date: string;
    feePkr: number; platformFeePercent: number; netEarnedPkr: number; status: string;
  }[];
  methods: { id: string; type: string; details: Record<string, string>; isDefault: boolean }[];
  payouts: { id: string; amountPkr: number; method: string | null; status: string; requestedAt: string; processedAt: string | null }[];
}

export interface LawyerDoc {
  id: string;
  docType: string;
  status: "submitted" | "verified" | "issue_found";
  issueNote: string | null;
  uploadedAt: string;
}

// ---- Consultation chat types -----------------------------------------------
export interface ConsultationHeader {
  id: string;
  status: "active" | "closed";
  caseType: string;
  startedAt: string;
  closedAt: string | null;
  viewerRole: "citizen" | "lawyer";
  otherParty: { id: string; name: string; photoUrl: string | null; availability: string | null };
  reviewSubmitted: boolean;
}

export interface ChatMessageDTO {
  id: string;
  consultationId: string;
  senderId: string;
  text: string | null;
  attachments: { documentId: string; fileName: string }[];
  deliveryStatus: "sent" | "delivered" | "read";
  createdAt: string;
}

export interface MyConsultationItem {
  id: string;
  lawyerName: string;
  lawyerPhotoUrl: string | null;
  caseType: string;
  startedAt: string;
  closedAt: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
  reviewSubmitted: boolean;
}

export interface MyRequestItem {
  id: string;
  lawyerName: string;
  lawyerPhotoUrl: string | null;
  caseType: string;
  description: string;
  createdAt: string;
  expiresAt: string;
}

// ---- Document analysis types ------------------------------------------------
export type DocumentEntityType =
  | "Person"
  | "Organization"
  | "Date"
  | "MonetaryAmount"
  | "LegalSection"
  | "Location";

export interface DocumentEntity {
  type: DocumentEntityType;
  value: string;
  confidence: number;
}

export interface DocumentAnalysisDTO {
  caseType: string | null;
  summary: string | null;
  entities: DocumentEntity[];
  overallConfidence: number | null;
  createdAt: string;
}

export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "analysis_complete"
  | "processing_failed"
  | "low_confidence";

export interface DocumentDTO {
  id: string;
  fileName: string;
  fileType: string;
  objectKey: string;
  status: DocumentStatus;
  uploadDate: string;
  analysis: DocumentAnalysisDTO | null;
}

export interface LawyerOwnProfile {
  fullLegalName: string;
  cnicLast4: string | null;
  barCouncilNumber: string;
  email: string;
  verificationStatus: "pending" | "verified" | "rejected" | "suspended" | "banned";
  submittedAt: string;
  bio: string;
  practiceAreas: string[];
  languages: string[];
  consultationFeePkr: number;
  availability: "online" | "busy" | "offline";
  showWinLossStats: boolean;
  profilePhotoUrl: string | null;
  province: string;
  city: string;
  yearsExperienceBand: string;
  winLoss: { total: number; won: number; lost: number; ongoing: number };
  ratingAvg: number;
  reviewCount: number;
  maxActiveConsultations: number;
  autoDeclineWhenOffline: boolean;
  documents: LawyerDoc[];
}
