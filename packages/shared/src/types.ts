export type MemberKind = "child" | "adult" | "external";

export type CallStatus = "answered" | "missed" | "declined" | "blocked" | "failed";

export type FamilyMember = {
  id: string;
  familyId: string;
  kind: MemberKind;
  displayName: string;
  avatarKey: string;
  colorKey: string;
  active: boolean;
};

export type SipCredentials = {
  domain: string;
  port: number;
  transport: string;
  username: string;
  extension: string;
  password: string;
};

export type ContactInfo = {
  memberId: string;
  displayName: string;
  avatarKey: string;
  colorKey: string;
  sipExtension: string;
  enabled: boolean;
};

export type ShortMessage = {
  id: string;
  fromMemberId: string;
  fromDisplayName: string;
  toMemberId: string;
  toDisplayName: string;
  body: string;
  createdAt: string;
};

export type ChildProfile = {
  memberId: string;
  displayName: string;
  avatarKey: string;
  colorKey: string;
};

export type PairingResponse = {
  token: string;
  profile: ChildProfile;
  sip: SipCredentials;
  contacts: ContactInfo[];
  settings: {
    showDialpad: boolean;
    allowEmergencyButton: boolean;
    theme: string;
  };
};

export type AllowedCallRule = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  enabled: boolean;
};

export type ParentUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "responsible";
};

export type LoginResponse = {
  token: string;
  parent: ParentUser;
  families: { id: string; name: string; active: boolean }[];
};

export type PermissionsMatrix = {
  members: FamilyMember[];
  rules: AllowedCallRule[];
};

export type ContactRequestStatus = "pending" | "approved" | "rejected" | "auto_approved";

export type ContactInviteQrPayload = {
  type: "telefoninho-contact";
  version: 1;
  token: string;
};

export type ContactInviteResponse = {
  token: string;
  expiresAt: string;
  qrPayload: ContactInviteQrPayload;
};

export type ContactRequestSummary = {
  id: string;
  status: ContactRequestStatus;
  requesterMemberId: string;
  requesterDisplayName: string;
  requesterKind: MemberKind;
  targetMemberId: string;
  targetDisplayName: string;
  targetKind: MemberKind;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};
