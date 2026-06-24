export type MemberKind = "child" | "adult" | "external";

export type CallStatus = "answered" | "missed" | "declined" | "blocked" | "failed";

export interface FamilyMember {
  id: string;
  familyId: string;
  kind: MemberKind;
  displayName: string;
  avatarKey: string;
  colorKey: string;
  active: boolean;
}

export interface SipCredentials {
  domain: string;
  port: number;
  transport: string;
  username: string;
  extension: string;
  password: string;
}

export interface ContactInfo {
  memberId: string;
  displayName: string;
  avatarKey: string;
  colorKey: string;
  sipExtension: string;
  enabled: boolean;
}

export interface ChildProfile {
  memberId: string;
  displayName: string;
  avatarKey: string;
  colorKey: string;
}

export interface PairingResponse {
  profile: ChildProfile;
  sip: SipCredentials;
  contacts: ContactInfo[];
  settings: {
    showDialpad: boolean;
    allowEmergencyButton: boolean;
    theme: string;
  };
}

export interface AllowedCallRule {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  enabled: boolean;
}

export interface ParentUser {
  id: string;
  email: string;
  displayName: string;
}

export interface LoginResponse {
  token: string;
  parent: ParentUser;
}

export interface PermissionsMatrix {
  members: FamilyMember[];
  rules: AllowedCallRule[];
}
